'use strict';
const express            = require('express');
const requirePermission  = require('../middleware/permission');
const parkScope          = require('../middleware/parkScope');
const { generateAlerts } = require('../lib/alertEngine');
const { computeMultiParkSummary } = require('../lib/occupancyEngine');

const router = express.Router();

// ── GET /api/operations/dashboard ─────────────────────────────────────────────
// Enterprise ops command center: full live KPIs, alerts, occupancy, incidents.
router.get('/', [...requirePermission('counters.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, generate_alerts = 'false' } = req.query;
  try {
    const scopedIds = req.scopedParkIds;

    // Build park filter
    let parkFilter = '';
    const params = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      parkFilter = `AND park_id = $${params.length + 1}`;
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json(emptyDashboard());
      const phs = scopedIds.map((_, i) => `$${i + 1}`).join(', ');
      parkFilter = `AND park_id IN (${phs})`;
      params.push(...scopedIds);
    }

    const parkIds = park_id ? [park_id] : (scopedIds ?? null);

    // Optionally regenerate alerts on dashboard load
    if (generate_alerts === 'true') {
      generateAlerts(pool, { parkIds }).catch(() => {}); // non-blocking
    }

    const [counters, shifts, devices, gates, alerts, incidents, recentActivity] = await Promise.all([
      // ── Counter stats
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE op_status = 'Active')      AS active_counters,
           COUNT(*) FILTER (WHERE op_status = 'Shift Open')  AS shift_open_counters,
           COUNT(*) FILTER (WHERE op_status = 'Maintenance') AS maintenance_counters,
           COUNT(*) FILTER (WHERE op_status = 'Inactive' AND is_active) AS idle_counters,
           COUNT(*) FILTER (WHERE is_active AND deleted_at IS NULL)      AS total_active
         FROM park_counters WHERE deleted_at IS NULL ${parkFilter}`,
        params
      ),

      // ── Shift stats
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('Open','Operating')) AS open_shifts,
           COUNT(*) FILTER (WHERE status = 'Variance Flagged')   AS variance_flagged,
           COUNT(*) FILTER (WHERE status = 'Closed' AND DATE(closed_at) = CURRENT_DATE) AS closed_today,
           COUNT(*) FILTER (WHERE status = 'Reconciled' AND DATE(closed_at) = CURRENT_DATE) AS reconciled_today,
           COALESCE(SUM(transaction_count) FILTER (WHERE status IN ('Open','Operating')), 0)::int AS live_transactions,
           COALESCE(SUM(actual_rev) FILTER (WHERE DATE(closed_at) = CURRENT_DATE), 0)::numeric AS revenue_today
         FROM shift_sessions WHERE 1=1 ${parkFilter}`,
        params
      ),

      // ── Device stats
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'Online')      AS online_devices,
           COUNT(*) FILTER (WHERE status = 'Offline')     AS offline_devices,
           COUNT(*) FILTER (WHERE status = 'Maintenance') AS maintenance_devices,
           COUNT(*) FILTER (WHERE status = 'Blocked')     AS blocked_devices,
           COUNT(*) FILTER (WHERE status = 'Outdated')    AS outdated_devices,
           COUNT(*) FILTER (WHERE last_heartbeat IS NOT NULL AND
             NOW() - last_heartbeat > INTERVAL '15 minutes' AND status = 'Online') AS stale_devices
         FROM park_devices WHERE deleted_at IS NULL ${parkFilter}`,
        params
      ),

      // ── Gate stats
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE op_status = 'Active'      AND deleted_at IS NULL) AS active_gates,
           COUNT(*) FILTER (WHERE op_status = 'Inactive'    AND deleted_at IS NULL) AS inactive_gates,
           COUNT(*) FILTER (WHERE op_status = 'Congested'   AND deleted_at IS NULL) AS congested_gates,
           COUNT(*) FILTER (WHERE op_status = 'Maintenance' AND deleted_at IS NULL) AS maintenance_gates,
           COALESCE(SUM(throughput_today) FILTER (WHERE deleted_at IS NULL), 0)::int AS total_throughput_today
         FROM park_gates WHERE deleted_at IS NULL ${parkFilter}`,
        params
      ),

      // ── Active alerts (open + acknowledged)
      pool.query(
        `SELECT id, alert_type, severity, title, body, target_type, target_id, status, created_at
         FROM operational_alerts
         WHERE status IN ('open','acknowledged') ${parkFilter}
         ORDER BY
           CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
           created_at DESC
         LIMIT 20`,
        params
      ),

      // ── Active incidents (open + investigating)
      pool.query(
        `SELECT i.id, i.incident_type, i.severity, i.title, i.status,
                i.target_type, i.target_id, i.assigned_to, u.name AS assigned_to_name, i.created_at
         FROM operational_incidents i
         LEFT JOIN users u ON u.id = i.assigned_to
         WHERE i.status IN ('open','investigating') ${parkFilter.replace('park_id', 'i.park_id')}
         ORDER BY
           CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
           i.created_at DESC
         LIMIT 10`,
        params
      ),

      // ── Recent operational events (last 25)
      pool.query(
        `SELECT event_type, park_id, actor_id, target_type, target_id, payload, recorded_at
         FROM operational_events
         WHERE 1=1 ${parkFilter}
         ORDER BY recorded_at DESC
         LIMIT 25`,
        params
      ),
    ]);

    // ── Build alert summary counts
    const alertRows = alerts.rows;
    const alertSummary = {
      critical: alertRows.filter(a => a.severity === 'critical').length,
      high:     alertRows.filter(a => a.severity === 'high').length,
      medium:   alertRows.filter(a => a.severity === 'medium').length,
      total:    alertRows.length,
    };

    // ── Occupancy (non-blocking, best-effort)
    let occupancy = [];
    try {
      occupancy = await computeMultiParkSummary(pool, parkIds);
    } catch (_) {}

    res.json({
      counters:        counters.rows[0],
      shifts:          shifts.rows[0],
      devices:         devices.rows[0],
      gates:           gates.rows[0],
      alert_summary:   alertSummary,
      alerts:          alertRows,
      incidents:       incidents.rows,
      occupancy,
      recent_activity: recentActivity.rows,
    });
  } catch (err) {
    console.error('[ops-dashboard]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

function emptyDashboard() {
  return {
    counters:        { active_counters: 0, shift_open_counters: 0, maintenance_counters: 0, idle_counters: 0, total_active: 0 },
    shifts:          { open_shifts: 0, variance_flagged: 0, closed_today: 0, reconciled_today: 0, live_transactions: 0, revenue_today: 0 },
    devices:         { online_devices: 0, offline_devices: 0, maintenance_devices: 0, blocked_devices: 0, outdated_devices: 0, stale_devices: 0 },
    gates:           { active_gates: 0, inactive_gates: 0, congested_gates: 0, maintenance_gates: 0, total_throughput_today: 0 },
    alert_summary:   { critical: 0, high: 0, medium: 0, total: 0 },
    alerts:          [],
    incidents:       [],
    occupancy:       [],
    recent_activity: [],
  };
}

module.exports = router;
