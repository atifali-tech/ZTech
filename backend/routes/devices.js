'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const logOpEvent        = require('../lib/opEvents');

const router = express.Router();

const DEVICE_TYPES    = ['POS','QR Scanner','Printer','Tablet','Kiosk','RFID Reader','Turnstile','Biometric'];
const DEVICE_STATUSES = ['Online','Offline','Maintenance','Blocked','Outdated'];

const DEVICE_SELECT = `
  SELECT d.id, d.park_id, p.name AS park_name,
         d.counter_id, c.name AS counter_name,
         d.name, d.device_type, d.status,
         d.last_heartbeat, d.software_version,
         d.is_active, d.created_at, d.updated_at
  FROM park_devices d
  JOIN  parks p ON p.id = d.park_id
  LEFT JOIN park_counters c ON c.id = d.counter_id
`;

// ── GET /api/operations/devices ───────────────────────────────────────────────
router.get('/', [...requirePermission('devices.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, status, device_type } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = ['d.deleted_at IS NULL'];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`d.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`d.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    if (status)      { conditions.push(`d.status = $${params.length + 1}`);      params.push(status); }
    if (device_type) { conditions.push(`d.device_type = $${params.length + 1}`); params.push(device_type); }

    const { rows } = await pool.query(
      `${DEVICE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.name, d.name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('[devices/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/devices/:id ──────────────────────────────────────────
router.get('/:id', [...requirePermission('devices.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `${DEVICE_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(rows[0].park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[devices/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/devices/:id/assignments ───────────────────────────────
router.get('/:id/assignments', requirePermission('devices.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT da.*, c.name AS counter_name, u.name AS user_name,
              ab.name AS assigned_by_name, ub.name AS unassigned_by_name
       FROM device_assignments da
       LEFT JOIN park_counters c  ON c.id  = da.counter_id
       LEFT JOIN users u          ON u.id  = da.user_id
       LEFT JOIN users ab         ON ab.id = da.assigned_by
       LEFT JOIN users ub         ON ub.id = da.unassigned_by
       WHERE da.device_id = $1
       ORDER BY da.assigned_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('[devices/assignments]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/devices ──────────────────────────────────────────────
router.post('/', requirePermission('devices.create'), async (req, res) => {
  const { park_id, name, device_type = 'POS', software_version = null, counter_id = null } = req.body;
  if (!park_id || !name) return res.status(400).json({ error: 'park_id and name required' });
  if (!DEVICE_TYPES.includes(device_type)) {
    return res.status(400).json({ error: `device_type must be one of: ${DEVICE_TYPES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO park_devices (park_id, name, device_type, software_version, counter_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [park_id, name, device_type, software_version, counter_id]
    );
    await logAudit(pool, req.user, 'device.create', 'device', rows[0].id, { park_id, name, device_type });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[devices/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/devices/:id ──────────────────────────────────────────
router.put('/:id', requirePermission('devices.edit'), async (req, res) => {
  const { name, device_type, status, software_version, counter_id, is_active } = req.body;
  if (status      && !DEVICE_STATUSES.includes(status))   return res.status(400).json({ error: 'Invalid status' });
  if (device_type && !DEVICE_TYPES.includes(device_type)) return res.status(400).json({ error: 'Invalid device_type' });
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (name             !== undefined) { sets.push(`name = $${idx++}`);             vals.push(name); }
    if (device_type      !== undefined) { sets.push(`device_type = $${idx++}`);      vals.push(device_type); }
    if (status           !== undefined) { sets.push(`status = $${idx++}`);           vals.push(status); }
    if (software_version !== undefined) { sets.push(`software_version = $${idx++}`); vals.push(software_version); }
    if (counter_id       !== undefined) { sets.push(`counter_id = $${idx++}`);       vals.push(counter_id); }
    if (is_active        !== undefined) { sets.push(`is_active = $${idx++}`);        vals.push(is_active); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE park_devices SET ${sets.join(', ')} WHERE id = $${idx} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    await logAudit(pool, req.user, 'device.update', 'device', req.params.id, { name, status });
    res.json(rows[0]);
  } catch (err) {
    console.error('[devices/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/devices/:id/assign ───────────────────────────────────
// Assign or move device to a counter / user. Records assignment history.
router.post('/:id/assign', requirePermission('devices.edit'), async (req, res) => {
  const { counter_id = null, user_id = null, reason = null } = req.body;
  const pool = req.app.locals.pool;
  try {
    const { rows: cur } = await pool.query(
      `SELECT * FROM park_devices WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Device not found' });
    const device = cur[0];

    // Close any open assignment for this device
    await pool.query(
      `UPDATE device_assignments SET unassigned_at = NOW(), unassigned_by = $1
       WHERE device_id = $2 AND unassigned_at IS NULL`,
      [req.user.id, req.params.id]
    );

    // Open new assignment record
    await pool.query(
      `INSERT INTO device_assignments (device_id, counter_id, user_id, assigned_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, counter_id, user_id, req.user.id, reason]
    );

    // Update device itself
    const { rows } = await pool.query(
      `UPDATE park_devices SET counter_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [counter_id, req.params.id]
    );

    await logAudit(pool, req.user, 'device.assign', 'device', req.params.id, { counter_id, user_id, reason });
    await logOpEvent(pool, {
      event_type: counter_id ? 'device_assigned' : 'device_unassigned',
      park_id: device.park_id, actor_id: req.user.id,
      target_type: 'device', target_id: req.params.id,
      payload: { counter_id, user_id, reason },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[devices/assign]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/devices/:id/mode ─────────────────────────────────────
// Transition device to Maintenance or Blocked mode.
router.post('/:id/mode', requirePermission('devices.edit'), async (req, res) => {
  const { mode, reason = null } = req.body;
  if (!['Maintenance', 'Blocked', 'Offline', 'Online'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be Maintenance, Blocked, Offline, or Online' });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_devices SET status = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [mode, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });

    const evtMap = { Maintenance: 'device_maintenance', Blocked: 'device_blocked', Offline: 'device_unassigned', Online: 'device_assigned' };
    await logAudit(pool, req.user, `device.mode.${mode.toLowerCase()}`, 'device', req.params.id, { mode, reason });
    await logOpEvent(pool, {
      event_type: evtMap[mode], park_id: rows[0].park_id,
      actor_id: req.user.id, target_type: 'device', target_id: req.params.id,
      payload: { mode, reason },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[devices/mode]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/devices/:id/heartbeat ────────────────────────────────
router.post('/:id/heartbeat', requirePermission('devices.edit'), async (req, res) => {
  const { status = 'Online', meta = {} } = req.body;
  const pool = req.app.locals.pool;
  try {
    await pool.query(
      `INSERT INTO device_heartbeats (device_id, status, meta) VALUES ($1, $2, $3)`,
      [req.params.id, status, JSON.stringify(meta)]
    );
    const { rows } = await pool.query(
      `UPDATE park_devices SET status = $1, last_heartbeat = NOW(), updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING *`,
      [status, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    res.json({ ok: true, status: rows[0].status, last_heartbeat: rows[0].last_heartbeat });
  } catch (err) {
    console.error('[devices/heartbeat]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/devices/health ───────────────────────────────────────
// Aggregated device health summary with stale-heartbeat and offline detection.
router.get('/health', [...requirePermission('devices.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = ['d.deleted_at IS NULL'];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`d.park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json({ devices: [], summary: {} });
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`d.park_id IN (${phs})`); params.push(...scopedIds);
    }

    // Load per-park heartbeat thresholds
    const { rows: settings } = await pool.query(
      `SELECT park_id, heartbeat_stale_mins, offline_alert_mins FROM park_operational_settings`
    );
    const settingsMap = Object.fromEntries(settings.map(s => [s.park_id, s]));

    const { rows: devices } = await pool.query(
      `SELECT d.id, d.park_id, p.name AS park_name, d.name, d.device_type, d.status,
              d.last_heartbeat, d.software_version, d.counter_id, c.name AS counter_name
       FROM park_devices d
       JOIN parks p ON p.id = d.park_id
       LEFT JOIN park_counters c ON c.id = d.counter_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.name, d.name`,
      params
    );

    const now = Date.now();
    const enriched = devices.map(d => {
      const cfg = settingsMap[d.park_id] || {};
      const staleThresh  = (cfg.heartbeat_stale_mins  ?? 15) * 60 * 1000;
      const offlineThresh = (cfg.offline_alert_mins   ?? 30) * 60 * 1000;
      const msSince = d.last_heartbeat ? now - new Date(d.last_heartbeat).getTime() : Infinity;
      const minsSince = msSince === Infinity ? null : Math.round(msSince / 60000);

      const isStale   = d.status === 'Online' && msSince > staleThresh;
      const isOffline = d.status === 'Offline' && msSince > offlineThresh;
      let health = 'ok';
      if (d.status === 'Blocked')     health = 'blocked';
      else if (d.status === 'Maintenance') health = 'maintenance';
      else if (isOffline)             health = 'offline';
      else if (isStale)               health = 'stale';
      else if (d.status === 'Outdated') health = 'outdated';

      return { ...d, health, mins_since_heartbeat: minsSince, is_stale: isStale };
    });

    const summary = {
      total:       enriched.length,
      online:      enriched.filter(d => d.status === 'Online' && d.health === 'ok').length,
      stale:       enriched.filter(d => d.health === 'stale').length,
      offline:     enriched.filter(d => d.status === 'Offline').length,
      maintenance: enriched.filter(d => d.status === 'Maintenance').length,
      blocked:     enriched.filter(d => d.status === 'Blocked').length,
      outdated:    enriched.filter(d => d.status === 'Outdated').length,
    };

    res.json({ devices: enriched, summary });
  } catch (err) {
    console.error('[devices/health]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/operations/devices/:id (soft delete) ─────────────────────────
router.delete('/:id', requirePermission('devices.delete'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE park_devices SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Device not found' });
    await logAudit(pool, req.user, 'device.delete', 'device', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[devices/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
