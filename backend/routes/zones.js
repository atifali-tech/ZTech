'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');

const router = express.Router();

// ── GET /api/operations/zones ─────────────────────────────────────────────────
router.get('/', [...requirePermission('zones.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = ['z.deleted_at IS NULL'];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`z.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`z.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    const { rows } = await pool.query(
      `SELECT z.id, z.park_id, p.name AS park_name, z.name, z.zone_type, z.is_active, z.created_at, z.updated_at
       FROM park_zones z
       JOIN parks p ON p.id = z.park_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.name, z.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[zones/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/zones/:id ────────────────────────────────────────────
router.get('/:id', [...requirePermission('zones.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT z.*, p.name AS park_name
       FROM park_zones z JOIN parks p ON p.id = z.park_id
       WHERE z.id = $1 AND z.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Zone not found' });
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(rows[0].park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[zones/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/zones ────────────────────────────────────────────────
router.post('/', requirePermission('zones.create'), async (req, res) => {
  const { park_id, name, zone_type = 'General' } = req.body;
  if (!park_id || !name) return res.status(400).json({ error: 'park_id and name required' });
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO park_zones (park_id, name, zone_type)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [park_id, name, zone_type]
    );
    await logAudit(pool, req.user, 'zone.create', 'zone', rows[0].id, { park_id, name, zone_type });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[zones/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/zones/:id ─────────────────────────────────────────────
router.put('/:id', requirePermission('zones.edit'), async (req, res) => {
  const { name, zone_type, is_active } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (name      !== undefined) { sets.push(`name = $${idx++}`);      vals.push(name); }
    if (zone_type !== undefined) { sets.push(`zone_type = $${idx++}`); vals.push(zone_type); }
    if (is_active !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(is_active); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE park_zones SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Zone not found' });
    await logAudit(pool, req.user, 'zone.update', 'zone', req.params.id, { name, zone_type, is_active });
    res.json(rows[0]);
  } catch (err) {
    console.error('[zones/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/operations/zones/:id (soft delete) ───────────────────────────
router.delete('/:id', requirePermission('zones.delete'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_zones SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Zone not found' });
    await logAudit(pool, req.user, 'zone.delete', 'zone', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[zones/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
