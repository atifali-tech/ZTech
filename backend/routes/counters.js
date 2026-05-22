'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const logOpEvent        = require('../lib/opEvents');

const router = express.Router();

const COUNTER_TYPES  = ['Ticketing','Refund','VIP','Self-Service','Parking','Temporary'];
const OP_STATUSES    = ['Active','Inactive','Maintenance','Shift Open','Shift Closed'];

const COUNTER_SELECT = `
  SELECT c.id, c.park_id, p.name AS park_name, c.zone_id, z.name AS zone_name,
         c.name, c.counter_type, c.is_active, c.op_status,
         c.assigned_user_id, u.name AS assigned_user_name,
         c.assigned_device_id, d.name AS assigned_device_name, d.status AS device_status,
         c.current_shift_id,
         c.created_at, c.updated_at
  FROM park_counters c
  JOIN  parks p ON p.id = c.park_id
  LEFT JOIN park_zones z   ON z.id = c.zone_id
  LEFT JOIN users u        ON u.id = c.assigned_user_id
  LEFT JOIN park_devices d ON d.id = c.assigned_device_id
`;

// ── GET /api/operations/counters ──────────────────────────────────────────────
router.get('/', [...requirePermission('counters.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, zone_id, op_status } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = ['c.deleted_at IS NULL'];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`c.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`c.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    if (zone_id)   { conditions.push(`c.zone_id = $${params.length + 1}`);   params.push(zone_id); }
    if (op_status) { conditions.push(`c.op_status = $${params.length + 1}`); params.push(op_status); }

    const { rows } = await pool.query(
      `${COUNTER_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.name, c.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[counters/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/counters/:id ──────────────────────────────────────────
router.get('/:id', [...requirePermission('counters.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `${COUNTER_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Counter not found' });
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(rows[0].park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[counters/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/counters ─────────────────────────────────────────────
router.post('/', requirePermission('counters.create'), async (req, res) => {
  const {
    park_id, zone_id = null, name, counter_type = 'Ticketing',
    assigned_user_id = null, assigned_device_id = null,
  } = req.body;
  if (!park_id || !name) return res.status(400).json({ error: 'park_id and name required' });
  if (!COUNTER_TYPES.includes(counter_type)) {
    return res.status(400).json({ error: `counter_type must be one of: ${COUNTER_TYPES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO park_counters (park_id, zone_id, name, counter_type, assigned_user_id, assigned_device_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [park_id, zone_id, name, counter_type, assigned_user_id, assigned_device_id]
    );
    await logAudit(pool, req.user, 'counter.create', 'counter', rows[0].id, { park_id, name, counter_type });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[counters/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/counters/:id ─────────────────────────────────────────
router.put('/:id', requirePermission('counters.edit'), async (req, res) => {
  const { name, zone_id, counter_type, is_active, assigned_user_id, assigned_device_id } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (name               !== undefined) { sets.push(`name = $${idx++}`);               vals.push(name); }
    if (zone_id            !== undefined) { sets.push(`zone_id = $${idx++}`);            vals.push(zone_id); }
    if (counter_type       !== undefined) { sets.push(`counter_type = $${idx++}`);       vals.push(counter_type); }
    if (is_active          !== undefined) { sets.push(`is_active = $${idx++}`);          vals.push(is_active); }
    if (assigned_user_id   !== undefined) { sets.push(`assigned_user_id = $${idx++}`);   vals.push(assigned_user_id); }
    if (assigned_device_id !== undefined) { sets.push(`assigned_device_id = $${idx++}`); vals.push(assigned_device_id); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rowCount } = await pool.query(
      `UPDATE park_counters SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL`,
      vals
    );
    if (!rowCount) return res.status(404).json({ error: 'Counter not found' });
    const { rows: updated } = await pool.query(
      `${COUNTER_SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [req.params.id]
    );
    await logAudit(pool, req.user, 'counter.update', 'counter', req.params.id, { name, counter_type });
    res.json(updated[0]);
  } catch (err) {
    console.error('[counters/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/counters/:id/status ─────────────────────────────────
// Transition counter operational status (Active/Inactive/Maintenance).
router.post('/:id/status', requirePermission('counters.edit'), async (req, res) => {
  const { op_status, reason = null } = req.body;
  if (!OP_STATUSES.includes(op_status)) {
    return res.status(400).json({ error: `op_status must be one of: ${OP_STATUSES.join(', ')}` });
  }
  // Prevent direct setting of shift-managed statuses via this endpoint
  if (['Shift Open', 'Shift Closed'].includes(op_status)) {
    return res.status(400).json({ error: 'Shift Open/Closed status is managed by shift lifecycle, not directly' });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_counters SET op_status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [op_status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Counter not found' });

    const evtMap = { Active: 'counter_activated', Inactive: 'counter_deactivated', Maintenance: 'counter_maintenance' };
    await logAudit(pool, req.user, `counter.status.${op_status.toLowerCase()}`, 'counter', req.params.id, { op_status, reason });
    await logOpEvent(pool, {
      event_type: evtMap[op_status] || 'counter_deactivated',
      park_id: rows[0].park_id, actor_id: req.user.id,
      target_type: 'counter', target_id: req.params.id,
      payload: { op_status, reason },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[counters/status]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/operations/counters/:id (soft delete) ────────────────────────
router.delete('/:id', requirePermission('counters.delete'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_counters SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Counter not found' });
    await logAudit(pool, req.user, 'counter.delete', 'counter', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[counters/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
