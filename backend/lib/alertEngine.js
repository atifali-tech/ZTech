'use strict';
// Alert engine — generates and persists operational_alerts from system state.
// Call generateAlerts(pool, opts) on demand (from dashboard, scheduled, or trigger).
// Non-fatal: never throws; logs errors internally.

const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// ── Core insert helper ────────────────────────────────────────────────────────
// Finds an open alert of the same type+target to avoid duplicates.
// Creates a new one if none found, or returns the existing open alert.
async function upsertAlert(pool, { park_id, alert_type, severity, title, body, target_type, target_id, auto_resolve, meta }) {
  try {
    // Dedup: one open alert per (park_id, alert_type, target_type, target_id)
    const { rows: existing } = await pool.query(
      `SELECT id FROM operational_alerts
       WHERE park_id = $1 AND alert_type = $2
         AND COALESCE(target_type,'') = COALESCE($3,'')
         AND COALESCE(target_id,'')   = COALESCE($4,'')
         AND status IN ('open','acknowledged')
       LIMIT 1`,
      [park_id, alert_type, target_type || null, target_id || null]
    );
    if (existing[0]) return existing[0];

    const { rows } = await pool.query(
      `INSERT INTO operational_alerts
         (park_id, alert_type, severity, title, body, target_type, target_id, auto_resolve, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [park_id, alert_type, severity, title, body || null,
       target_type || null, target_id || null,
       auto_resolve ?? true, JSON.stringify(meta || {})]
    );
    return rows[0];
  } catch (err) {
    console.error('[alertEngine/upsert]', err.message);
    return null;
  }
}

// Auto-resolve alerts whose condition has cleared.
async function resolveAlert(pool, { park_id, alert_type, target_type, target_id }) {
  try {
    await pool.query(
      `UPDATE operational_alerts SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE park_id = $1 AND alert_type = $2
         AND COALESCE(target_type,'') = COALESCE($3,'')
         AND COALESCE(target_id,'')   = COALESCE($4,'')
         AND status IN ('open','acknowledged')
         AND auto_resolve = true`,
      [park_id, alert_type, target_type || null, target_id || null]
    );
  } catch (err) {
    console.error('[alertEngine/resolve]', err.message);
  }
}

// ── Alert generators ──────────────────────────────────────────────────────────

async function checkDeviceHealth(pool, parkFilter, settingsMap) {
  const { rows: devices } = await pool.query(
    `SELECT d.id, d.park_id, d.name, d.status, d.last_heartbeat
     FROM park_devices d
     WHERE d.deleted_at IS NULL ${parkFilter}`,
    []
  );

  for (const d of devices) {
    const settings = settingsMap[d.park_id] || {};
    const staleThresholdMins  = settings.heartbeat_stale_mins  ?? 15;
    const offlineThresholdMins = settings.offline_alert_mins   ?? 30;

    const minsAgo = d.last_heartbeat
      ? (Date.now() - new Date(d.last_heartbeat).getTime()) / 60000
      : Infinity;

    // Stale heartbeat: online device but no heartbeat within threshold
    if (d.status === 'Online' && minsAgo > staleThresholdMins) {
      await upsertAlert(pool, {
        park_id: d.park_id, alert_type: 'stale_heartbeat',
        severity: minsAgo > offlineThresholdMins ? 'high' : 'medium',
        title: `Device stale: ${d.name}`,
        body: `No heartbeat received in ${Math.round(minsAgo)} minutes.`,
        target_type: 'device', target_id: d.id, auto_resolve: true,
        meta: { device_name: d.name, mins_since_heartbeat: Math.round(minsAgo) },
      });
    } else {
      await resolveAlert(pool, { park_id: d.park_id, alert_type: 'stale_heartbeat', target_type: 'device', target_id: d.id });
    }

    // Device offline
    if (d.status === 'Offline' && minsAgo > offlineThresholdMins) {
      await upsertAlert(pool, {
        park_id: d.park_id, alert_type: 'device_offline',
        severity: 'high',
        title: `Device offline: ${d.name}`,
        body: `Device has been offline for ${Math.round(minsAgo)} minutes.`,
        target_type: 'device', target_id: d.id, auto_resolve: true,
        meta: { device_name: d.name, mins_offline: Math.round(minsAgo) },
      });
    } else if (d.status !== 'Offline') {
      await resolveAlert(pool, { park_id: d.park_id, alert_type: 'device_offline', target_type: 'device', target_id: d.id });
    }

    // Blocked device
    if (d.status === 'Blocked') {
      await upsertAlert(pool, {
        park_id: d.park_id, alert_type: 'device_blocked',
        severity: 'critical',
        title: `Device blocked: ${d.name}`,
        body: 'Device is in Blocked status and cannot process transactions.',
        target_type: 'device', target_id: d.id, auto_resolve: false,
        meta: { device_name: d.name },
      });
    } else {
      await resolveAlert(pool, { park_id: d.park_id, alert_type: 'device_blocked', target_type: 'device', target_id: d.id });
    }
  }
}

async function checkGateStatus(pool, parkFilter) {
  const { rows: gates } = await pool.query(
    `SELECT id, park_id, name, op_status FROM park_gates WHERE deleted_at IS NULL ${parkFilter}`,
    []
  );
  for (const g of gates) {
    if (g.op_status === 'Congested') {
      await upsertAlert(pool, {
        park_id: g.park_id, alert_type: 'gate_congested',
        severity: 'high',
        title: `Gate congested: ${g.name}`,
        body: 'Gate is reporting congestion. Manual intervention may be required.',
        target_type: 'gate', target_id: g.id, auto_resolve: true,
        meta: { gate_name: g.name },
      });
    } else {
      await resolveAlert(pool, { park_id: g.park_id, alert_type: 'gate_congested', target_type: 'gate', target_id: g.id });
    }

    if (g.op_status === 'Maintenance') {
      await upsertAlert(pool, {
        park_id: g.park_id, alert_type: 'gate_maintenance',
        severity: 'medium',
        title: `Gate in maintenance: ${g.name}`,
        body: 'Gate is in maintenance mode and not processing entries/exits.',
        target_type: 'gate', target_id: g.id, auto_resolve: true,
        meta: { gate_name: g.name },
      });
    } else {
      await resolveAlert(pool, { park_id: g.park_id, alert_type: 'gate_maintenance', target_type: 'gate', target_id: g.id });
    }
  }
}

async function checkShiftVariance(pool, parkFilter) {
  const { rows: shifts } = await pool.query(
    `SELECT id, park_id, status, variance, expected_rev, actual_rev
     FROM shift_sessions
     WHERE status = 'Variance Flagged' ${parkFilter}`,
    []
  );
  for (const s of shifts) {
    await upsertAlert(pool, {
      park_id: s.park_id, alert_type: 'shift_variance',
      severity: Math.abs(parseFloat(s.variance) || 0) > 5000 ? 'critical' : 'high',
      title: `Shift variance flagged`,
      body: `Variance of ₹${parseFloat(s.variance || 0).toLocaleString()} detected. Reconciliation required.`,
      target_type: 'shift', target_id: String(s.id), auto_resolve: false,
      meta: { variance: s.variance, expected_rev: s.expected_rev, actual_rev: s.actual_rev },
    });
  }
}

async function checkCounterInactivity(pool, parkFilter) {
  // Counter assigned to a shift but op_status shows Active/Inactive (not Shift Open) — potential issue
  const { rows: counters } = await pool.query(
    `SELECT c.id, c.park_id, c.name, c.op_status, c.is_active, c.current_shift_id
     FROM park_counters c
     WHERE c.deleted_at IS NULL AND c.is_active = true ${parkFilter}`,
    []
  );
  for (const c of counters) {
    // Counter is active but stuck in Inactive status with no shift — operational dead counter
    if (c.op_status === 'Inactive' && !c.current_shift_id) {
      await upsertAlert(pool, {
        park_id: c.park_id, alert_type: 'counter_inactive',
        severity: 'low',
        title: `Counter inactive: ${c.name}`,
        body: 'Counter is enabled but has no active shift and is in Inactive status.',
        target_type: 'counter', target_id: c.id, auto_resolve: true,
        meta: { counter_name: c.name },
      });
    } else {
      await resolveAlert(pool, { park_id: c.park_id, alert_type: 'counter_inactive', target_type: 'counter', target_id: c.id });
    }
  }
}

async function checkOccupancy(pool, parkFilter, settingsMap) {
  // For parks with entry tracking, check if occupancy exceeds thresholds
  const { rows: parks } = await pool.query(
    `SELECT p.id, p.capacity, pos.occupancy_warning_pct, pos.occupancy_critical_pct, pos.supports_entry_tracking
     FROM parks p
     LEFT JOIN park_operational_settings pos ON pos.park_id = p.id
     WHERE 1=1 ${parkFilter.replace('park_id', 'p.id')}`,
    []
  );

  for (const park of parks) {
    if (!park.supports_entry_tracking || !park.capacity) continue;

    const { rows: occ } = await pool.query(
      `SELECT
         SUM(CASE WHEN event_type = 'entry' THEN 1 ELSE 0 END) -
         SUM(CASE WHEN event_type IN ('exit','est_exit') THEN 1 ELSE 0 END) AS current_occ
       FROM occupancy_events
       WHERE park_id = $1 AND recorded_at >= CURRENT_DATE`,
      [park.id]
    );
    const currentOcc = Math.max(0, parseInt(occ[0]?.current_occ) || 0);
    const pct = park.capacity > 0 ? (currentOcc / park.capacity) * 100 : 0;
    const warningPct  = parseFloat(park.occupancy_warning_pct)  || 80;
    const criticalPct = parseFloat(park.occupancy_critical_pct) || 95;

    if (pct >= criticalPct) {
      await upsertAlert(pool, {
        park_id: park.id, alert_type: 'occupancy_critical',
        severity: 'critical',
        title: 'Park occupancy critical',
        body: `Occupancy at ${pct.toFixed(1)}% of capacity (${currentOcc}/${park.capacity}). Gate control required.`,
        target_type: 'park', target_id: park.id, auto_resolve: true,
        meta: { current_occ: currentOcc, capacity: park.capacity, pct: pct.toFixed(1) },
      });
      await resolveAlert(pool, { park_id: park.id, alert_type: 'occupancy_warning', target_type: 'park', target_id: park.id });
    } else if (pct >= warningPct) {
      await upsertAlert(pool, {
        park_id: park.id, alert_type: 'occupancy_warning',
        severity: 'high',
        title: 'Park occupancy warning',
        body: `Occupancy at ${pct.toFixed(1)}% of capacity (${currentOcc}/${park.capacity}).`,
        target_type: 'park', target_id: park.id, auto_resolve: true,
        meta: { current_occ: currentOcc, capacity: park.capacity, pct: pct.toFixed(1) },
      });
      await resolveAlert(pool, { park_id: park.id, alert_type: 'occupancy_critical', target_type: 'park', target_id: park.id });
    } else {
      await resolveAlert(pool, { park_id: park.id, alert_type: 'occupancy_warning',  target_type: 'park', target_id: park.id });
      await resolveAlert(pool, { park_id: park.id, alert_type: 'occupancy_critical', target_type: 'park', target_id: park.id });
    }
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
// opts.parkIds: string[] | null — null = all parks
async function generateAlerts(pool, opts = {}) {
  try {
    const { parkIds = null } = opts;

    // Build a simple park filter for single-table queries
    let parkFilter = '';
    let parkFilterPark = '';
    if (parkIds && parkIds.length > 0) {
      const ids = parkIds.map((_, i) => `$${i + 1}`).join(', ');
      parkFilter = `AND park_id IN (${ids})`;
      parkFilterPark = `AND p.id IN (${ids})`;
    }

    // Load operational settings for all relevant parks
    const settingsQuery = parkIds
      ? `SELECT * FROM park_operational_settings WHERE park_id IN (${parkIds.map((_,i)=>`$${i+1}`).join(',')})`
      : `SELECT * FROM park_operational_settings`;
    const { rows: settingsRows } = await pool.query(settingsQuery, parkIds || []);
    const settingsMap = Object.fromEntries(settingsRows.map(s => [s.park_id, s]));

    await Promise.all([
      checkDeviceHealth(pool, parkFilter, settingsMap),
      checkGateStatus(pool, parkFilter),
      checkShiftVariance(pool, parkFilter),
      checkCounterInactivity(pool, parkFilter),
      checkOccupancy(pool, parkFilterPark, settingsMap),
    ]);
  } catch (err) {
    console.error('[alertEngine/generateAlerts]', err.message);
  }
}

module.exports = { generateAlerts, upsertAlert, resolveAlert };
