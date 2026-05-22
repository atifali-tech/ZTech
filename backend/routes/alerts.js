'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const { generateAlerts } = require('../lib/alertEngine');

const router = express.Router();

const ALERT_SELECT = `
  SELECT a.id, a.park_id, p.name AS park_name,
         a.alert_type, a.severity, a.title, a.body,
         a.target_type, a.target_id, a.status,
         a.acknowledged_by, u.name AS acknowledged_by_name,
         a.acknowledged_at, a.resolved_at, a.auto_resolve,
         a.meta, a.created_at, a.updated_at
  FROM operational_alerts a
  LEFT JOIN parks p ON p.id = a.park_id
  LEFT JOIN users u ON u.id = a.acknowledged_by
`;

// ── GET /api/operations/alerts ────────────────────────────────────────────────
router.get('/', [...requirePermission('alerts.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, status = 'open', severity, alert_type, limit = 100 } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`a.park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`a.park_id IN (${phs})`); params.push(...scopedIds);
    }

    if (status) {
      const statuses = Array.isArray(status) ? status : status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        conditions.push(`a.status = $${params.length + 1}`); params.push(statuses[0]);
      } else if (statuses.length > 1) {
        const phs = statuses.map((_, i) => `$${params.length + i + 1}`).join(', ');
        conditions.push(`a.status IN (${phs})`); params.push(...statuses);
      }
    }
    if (severity)   { conditions.push(`a.severity = $${params.length + 1}`);   params.push(severity); }
    if (alert_type) { conditions.push(`a.alert_type = $${params.length + 1}`); params.push(alert_type); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cap   = Math.min(parseInt(limit) || 100, 500);

    const { rows } = await pool.query(
      `${ALERT_SELECT} ${where} ORDER BY
         CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
         a.created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, cap]
    );
    res.json(rows);
  } catch (err) {
    console.error('[alerts/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/alerts/summary ───────────────────────────────────────
// Quick count by severity for badge/header display.
router.get('/summary', [...requirePermission('alerts.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [`a.status IN ('open','acknowledged')`];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`a.park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json({ critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`a.park_id IN (${phs})`); params.push(...scopedIds);
    }

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
         COUNT(*) FILTER (WHERE severity = 'high')     AS high,
         COUNT(*) FILTER (WHERE severity = 'medium')   AS medium,
         COUNT(*) FILTER (WHERE severity = 'low')      AS low,
         COUNT(*) FILTER (WHERE severity = 'info')     AS info,
         COUNT(*) AS total
       FROM operational_alerts a
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[alerts/summary]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/alerts/generate ─────────────────────────────────────
// Trigger alert generation on demand (e.g., from dashboard refresh).
router.post('/generate', requirePermission('alerts.manage'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id } = req.body;
  try {
    const scopedIds = req.scopedParkIds;
    let parkIds = null;
    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      parkIds = [park_id];
    } else if (scopedIds !== null) {
      parkIds = scopedIds;
    }
    await generateAlerts(pool, { parkIds });
    res.json({ ok: true });
  } catch (err) {
    console.error('[alerts/generate]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/alerts/:id ───────────────────────────────────────────
router.get('/:id', requirePermission('alerts.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(`${ALERT_SELECT} WHERE a.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[alerts/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/alerts/:id/acknowledge ───────────────────────────────
router.post('/:id/acknowledge', requirePermission('alerts.manage'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE operational_alerts
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'open'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found or already acknowledged' });
    await logAudit(pool, req.user, 'alert.acknowledge', 'alert', req.params.id, {});
    res.json(rows[0]);
  } catch (err) {
    console.error('[alerts/acknowledge]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/alerts/:id/resolve ───────────────────────────────────
router.post('/:id/resolve', requirePermission('alerts.manage'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE operational_alerts
       SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('open','acknowledged')
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found or already resolved' });
    await logAudit(pool, req.user, 'alert.resolve', 'alert', req.params.id, {});
    res.json(rows[0]);
  } catch (err) {
    console.error('[alerts/resolve]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/alerts/:id/suppress ──────────────────────────────────
router.post('/:id/suppress', requirePermission('alerts.manage'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE operational_alerts
       SET status = 'suppressed', updated_at = NOW()
       WHERE id = $1 AND status IN ('open','acknowledged')
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Alert not found or already closed' });
    await logAudit(pool, req.user, 'alert.suppress', 'alert', req.params.id, {});
    res.json(rows[0]);
  } catch (err) {
    console.error('[alerts/suppress]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
