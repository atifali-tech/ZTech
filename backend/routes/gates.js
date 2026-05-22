'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const logOpEvent        = require('../lib/opEvents');

const router = express.Router();

const GATE_TYPES  = ['Entry','Exit','Mixed','VIP','Staff','Emergency','Validation Only'];
const OP_STATUSES = ['Active','Inactive','Congested','Maintenance'];

// ── GET /api/operations/gates ─────────────────────────────────────────────────
router.get('/', [...requirePermission('gates.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, zone_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = ['g.deleted_at IS NULL'];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`g.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`g.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    if (zone_id) {
      conditions.push(`g.zone_id = $${params.length + 1}`);
      params.push(zone_id);
    }

    const { rows } = await pool.query(
      `SELECT g.id, g.park_id, p.name AS park_name, g.zone_id, z.name AS zone_name,
              g.name, g.gate_type, g.occupancy_enabled, g.is_active,
              g.op_status, g.throughput_today, g.rejection_count_today,
              g.created_at, g.updated_at
       FROM park_gates g
       JOIN parks p ON p.id = g.park_id
       LEFT JOIN park_zones z ON z.id = g.zone_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.name, g.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[gates/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/gates/:id ─────────────────────────────────────────────
router.get('/:id', [...requirePermission('gates.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT g.*, p.name AS park_name, z.name AS zone_name
       FROM park_gates g
       JOIN parks p ON p.id = g.park_id
       LEFT JOIN park_zones z ON z.id = g.zone_id
       WHERE g.id = $1 AND g.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gate not found' });
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(rows[0].park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[gates/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/gates ────────────────────────────────────────────────
router.post('/', requirePermission('gates.create'), async (req, res) => {
  const { park_id, zone_id = null, name, gate_type = 'Entry', occupancy_enabled = false } = req.body;
  if (!park_id || !name) return res.status(400).json({ error: 'park_id and name required' });
  if (!GATE_TYPES.includes(gate_type)) {
    return res.status(400).json({ error: `gate_type must be one of: ${GATE_TYPES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO park_gates (park_id, zone_id, name, gate_type, occupancy_enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [park_id, zone_id, name, gate_type, occupancy_enabled]
    );
    await logAudit(pool, req.user, 'gate.create', 'gate', rows[0].id, { park_id, name, gate_type });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[gates/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/gates/:id ─────────────────────────────────────────────
router.put('/:id', requirePermission('gates.edit'), async (req, res) => {
  const { name, zone_id, gate_type, occupancy_enabled, is_active } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (name              !== undefined) { sets.push(`name = $${idx++}`);              vals.push(name); }
    if (zone_id           !== undefined) { sets.push(`zone_id = $${idx++}`);           vals.push(zone_id); }
    if (gate_type         !== undefined) { sets.push(`gate_type = $${idx++}`);         vals.push(gate_type); }
    if (occupancy_enabled !== undefined) { sets.push(`occupancy_enabled = $${idx++}`); vals.push(occupancy_enabled); }
    if (is_active         !== undefined) { sets.push(`is_active = $${idx++}`);         vals.push(is_active); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE park_gates SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gate not found' });
    await logAudit(pool, req.user, 'gate.update', 'gate', req.params.id, { name, gate_type });
    res.json(rows[0]);
  } catch (err) {
    console.error('[gates/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/gates/:id/status ─────────────────────────────────────
// Transition gate operational status.
router.post('/:id/status', requirePermission('gates.edit'), async (req, res) => {
  const { op_status, reason = null } = req.body;
  if (!OP_STATUSES.includes(op_status)) {
    return res.status(400).json({ error: `op_status must be one of: ${OP_STATUSES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_gates SET op_status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [op_status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gate not found' });

    const evtMap = {
      Active: 'gate_enabled', Inactive: 'gate_disabled',
      Congested: 'gate_congested', Maintenance: 'gate_maintenance',
    };
    await logAudit(pool, req.user, `gate.status.${op_status.toLowerCase()}`, 'gate', req.params.id, { op_status, reason });
    await logOpEvent(pool, {
      event_type: evtMap[op_status], park_id: rows[0].park_id,
      actor_id: req.user.id, target_type: 'gate', target_id: req.params.id,
      payload: { op_status, reason },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[gates/status]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/operations/gates/:id (soft delete) ───────────────────────────
router.delete('/:id', requirePermission('gates.delete'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_gates SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Gate not found' });
    await logAudit(pool, req.user, 'gate.delete', 'gate', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[gates/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
