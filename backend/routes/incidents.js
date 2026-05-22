'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const logOpEvent        = require('../lib/opEvents');
const { notify }        = require('../lib/notifier');

const router = express.Router();

const INCIDENT_TYPES = [
  'gate_blocked','scanner_failure','printer_failure','occupancy_breach',
  'shift_variance','device_offline','stale_heartbeat','counter_inactive','custom',
];
const SEVERITIES = ['critical','high','medium','low','info'];
const STATUSES   = ['open','investigating','resolved','closed'];

const INCIDENT_SELECT = `
  SELECT i.id, i.park_id, p.name AS park_name,
         i.incident_type, i.severity, i.title, i.description, i.status,
         i.target_type, i.target_id,
         i.reported_by, rb.name AS reported_by_name,
         i.assigned_to, at2.name AS assigned_to_name,
         i.alert_id,
         i.resolved_by, re.name AS resolved_by_name,
         i.resolved_at, i.resolution_notes,
         i.meta, i.created_at, i.updated_at
  FROM operational_incidents i
  LEFT JOIN parks p    ON p.id   = i.park_id
  LEFT JOIN users rb   ON rb.id  = i.reported_by
  LEFT JOIN users at2  ON at2.id = i.assigned_to
  LEFT JOIN users re   ON re.id  = i.resolved_by
`;

// ── GET /api/operations/incidents ─────────────────────────────────────────────
router.get('/', [...requirePermission('incidents.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, status, severity, incident_type, limit = 100 } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`i.park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`i.park_id IN (${phs})`); params.push(...scopedIds);
    }

    if (status)        { conditions.push(`i.status = $${params.length + 1}`);        params.push(status); }
    if (severity)      { conditions.push(`i.severity = $${params.length + 1}`);      params.push(severity); }
    if (incident_type) { conditions.push(`i.incident_type = $${params.length + 1}`); params.push(incident_type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cap   = Math.min(parseInt(limit) || 100, 500);

    const { rows } = await pool.query(
      `${INCIDENT_SELECT} ${where}
       ORDER BY
         CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
         i.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, cap]
    );
    res.json(rows);
  } catch (err) {
    console.error('[incidents/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/incidents/summary ─────────────────────────────────────
router.get('/summary', [...requirePermission('incidents.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [`i.status IN ('open','investigating')`];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`i.park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) {
        return res.json({ open: 0, investigating: 0, critical: 0, high: 0, total_active: 0 });
      }
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`i.park_id IN (${phs})`); params.push(...scopedIds);
    }

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE i.status = 'open')          AS open,
         COUNT(*) FILTER (WHERE i.status = 'investigating') AS investigating,
         COUNT(*) FILTER (WHERE i.severity = 'critical')    AS critical,
         COUNT(*) FILTER (WHERE i.severity = 'high')        AS high,
         COUNT(*) AS total_active
       FROM operational_incidents i
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[incidents/summary]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/incidents/:id ─────────────────────────────────────────
router.get('/:id', requirePermission('incidents.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Incident not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[incidents/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/incidents ────────────────────────────────────────────
router.post('/', requirePermission('incidents.create'), async (req, res) => {
  const {
    park_id, incident_type = 'custom', severity = 'medium',
    title, description = null, target_type = null, target_id = null,
    assigned_to = null, alert_id = null, meta = {},
  } = req.body;

  if (!park_id || !title) return res.status(400).json({ error: 'park_id and title required' });
  if (!INCIDENT_TYPES.includes(incident_type)) {
    return res.status(400).json({ error: `incident_type must be one of: ${INCIDENT_TYPES.join(', ')}` });
  }
  if (!SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${SEVERITIES.join(', ')}` });
  }

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO operational_incidents
         (park_id, incident_type, severity, title, description,
          target_type, target_id, reported_by, assigned_to, alert_id, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [park_id, incident_type, severity, title, description,
       target_type, target_id, req.user.id, assigned_to, alert_id, JSON.stringify(meta)]
    );
    const incident = rows[0];

    await logAudit(pool, req.user, 'incident.create', 'incident', String(incident.id), { park_id, incident_type, severity });
    await logOpEvent(pool, {
      event_type: 'incident_created', park_id,
      actor_id: req.user.id, target_type: 'incident', target_id: String(incident.id),
      payload: { incident_type, severity, title },
    });

    if (assigned_to) {
      notify(pool, {
        userId: assigned_to,
        type: 'incident.assigned',
        title: 'You have been assigned an incident',
        body: title,
        meta: { incident_id: incident.id, severity, incident_type },
        parkId: park_id,
      }).catch(e => console.error('[notifier] incident.assigned (create):', e.message));
    }

    const { rows: full } = await pool.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [incident.id]);
    res.status(201).json(full[0]);
  } catch (err) {
    console.error('[incidents/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/incidents/:id ─────────────────────────────────────────
router.put('/:id', requirePermission('incidents.manage'), async (req, res) => {
  const { severity, title, description, status, assigned_to } = req.body;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (severity    !== undefined) { sets.push(`severity = $${idx++}`);    vals.push(severity); }
    if (title       !== undefined) { sets.push(`title = $${idx++}`);       vals.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (status      !== undefined) { sets.push(`status = $${idx++}`);      vals.push(status); }
    if (assigned_to !== undefined) { sets.push(`assigned_to = $${idx++}`); vals.push(assigned_to); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);

    const { rowCount } = await pool.query(
      `UPDATE operational_incidents SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    );
    if (!rowCount) return res.status(404).json({ error: 'Incident not found' });

    const { rows } = await pool.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [req.params.id]);
    await logAudit(pool, req.user, 'incident.update', 'incident', req.params.id, { status });

    if (assigned_to && assigned_to !== req.user.id) {
      notify(pool, {
        userId: assigned_to,
        type: 'incident.assigned',
        title: 'You have been assigned an incident',
        body: rows[0]?.title || null,
        meta: { incident_id: parseInt(req.params.id), severity: rows[0]?.severity },
        parkId: rows[0]?.park_id || null,
      }).catch(e => console.error('[notifier] incident.assigned (update):', e.message));
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[incidents/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/incidents/:id/investigate ───────────────────────────
router.post('/:id/investigate', requirePermission('incidents.manage'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE operational_incidents SET status = 'investigating', assigned_to = COALESCE($1, assigned_to),
         updated_at = NOW() WHERE id = $2 AND status = 'open' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Incident not found or not open' });
    await logAudit(pool, req.user, 'incident.investigate', 'incident', req.params.id, {});
    const { rows: full } = await pool.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [req.params.id]);

    // Notify the assignee (the investigating user self-assigns)
    notify(pool, {
      userId: req.user.id,
      type: 'incident.assigned',
      title: 'You have been assigned an incident',
      body: full[0]?.title || null,
      meta: { incident_id: parseInt(req.params.id), severity: full[0]?.severity },
      parkId: full[0]?.park_id || null,
    }).catch(e => console.error('[notifier] incident.assigned (investigate):', e.message));

    res.json(full[0]);
  } catch (err) {
    console.error('[incidents/investigate]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/incidents/:id/resolve ────────────────────────────────
router.post('/:id/resolve', requirePermission('incidents.manage'), async (req, res) => {
  const { resolution_notes = null } = req.body;
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE operational_incidents
       SET status = 'resolved', resolved_by = $1, resolved_at = NOW(),
           resolution_notes = $2, updated_at = NOW()
       WHERE id = $3 AND status IN ('open','investigating')
       RETURNING *`,
      [req.user.id, resolution_notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Incident not found or already resolved' });

    await logAudit(pool, req.user, 'incident.resolve', 'incident', req.params.id, { resolution_notes });
    await logOpEvent(pool, {
      event_type: 'incident_resolved', park_id: rows[0].park_id,
      actor_id: req.user.id, target_type: 'incident', target_id: String(req.params.id),
      payload: { resolution_notes },
    });

    const { rows: full } = await pool.query(`${INCIDENT_SELECT} WHERE i.id = $1`, [req.params.id]);
    res.json(full[0]);
  } catch (err) {
    console.error('[incidents/resolve]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
