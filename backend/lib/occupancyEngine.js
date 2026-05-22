'use strict';
// Occupancy Engine V1
// Supports three tracking modes per park:
//   full        — real entries minus real exits (most accurate)
//   entry_only  — entries only + dwell-time heuristic to estimate exits
//   none        — tracking disabled, returns graceful zeros
//
// Dwell-time heuristic (entry_only):
//   Assumes average visitor dwell time of DWELL_HOURS.
//   Counts entries recorded more than DWELL_HOURS ago as "estimated exits".
//   Remaining entries = current estimated occupancy.

const DWELL_HOURS = 4; // default dwell time assumption

// ── Determine tracking mode for a park ───────────────────────────────────────
async function getParkTrackingMode(pool, parkId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.capacity, pos.supports_entry_tracking,
            pos.occupancy_warning_pct, pos.occupancy_critical_pct
     FROM parks p
     LEFT JOIN park_operational_settings pos ON pos.park_id = p.id
     WHERE p.id = $1`,
    [parkId]
  );
  if (!rows[0]) return null;
  const park = rows[0];

  // Check if we have any exit events — if so, use full tracking
  const { rows: exitCheck } = await pool.query(
    `SELECT 1 FROM occupancy_events WHERE park_id = $1 AND event_type IN ('exit','est_exit') LIMIT 1`,
    [parkId]
  );

  let mode = 'none';
  if (park.supports_entry_tracking) {
    mode = exitCheck.length > 0 ? 'full' : 'entry_only';
  }

  return { ...park, mode };
}

// ── Core computation ──────────────────────────────────────────────────────────
async function computeOccupancy(pool, parkId) {
  const park = await getParkTrackingMode(pool, parkId);
  if (!park) return null;

  if (park.mode === 'none') {
    return buildResult(park, 'none', 0, 0, 0, 0);
  }

  // Load today's events
  const { rows: events } = await pool.query(
    `SELECT event_type, recorded_at FROM occupancy_events
     WHERE park_id = $1 AND recorded_at >= CURRENT_DATE
     ORDER BY recorded_at ASC`,
    [parkId]
  );

  let currentOcc = 0;
  let peakOcc    = 0;

  if (park.mode === 'full') {
    // Running tally: +1 entry, -1 exit/est_exit
    let running = 0;
    for (const ev of events) {
      if (ev.event_type === 'entry')                    running++;
      else if (ev.event_type === 'exit' || ev.event_type === 'est_exit') running = Math.max(0, running - 1);
      if (running > peakOcc) peakOcc = running;
    }
    currentOcc = running;
  } else {
    // entry_only: entries recorded more than DWELL_HOURS ago assumed to have exited
    const entries   = events.filter(e => e.event_type === 'entry');
    const dwellCutoff = new Date(Date.now() - DWELL_HOURS * 3600 * 1000);
    const activeEntries = entries.filter(e => new Date(e.recorded_at) >= dwellCutoff);

    // Simulate running peak using sliding window
    let running = 0;
    for (const ev of events) {
      if (ev.event_type === 'entry') running++;
      // Simulate exit at dwell time after each entry
      const dwellExpiry = new Date(new Date(ev.recorded_at).getTime() + DWELL_HOURS * 3600 * 1000);
      if (dwellExpiry < new Date()) running = Math.max(0, running - 1);
      if (running > peakOcc) peakOcc = running;
    }
    currentOcc = activeEntries.length;
  }

  const totalEntries = events.filter(e => e.event_type === 'entry').length;
  const totalExits   = events.filter(e => e.event_type !== 'entry').length;

  return buildResult(park, park.mode, currentOcc, peakOcc, totalEntries, totalExits);
}

function buildResult(park, mode, currentOcc, peakOcc, totalEntries, totalExits) {
  const capacity       = parseInt(park.capacity) || 0;
  const warningPct     = parseFloat(park.occupancy_warning_pct)  || 80;
  const criticalPct    = parseFloat(park.occupancy_critical_pct) || 95;
  const occupancyPct   = capacity > 0 ? Math.min(100, (currentOcc / capacity) * 100) : null;

  let status = 'unknown';
  if (mode === 'none') {
    status = 'disabled';
  } else if (occupancyPct === null) {
    status = 'no_capacity_set';
  } else if (occupancyPct >= criticalPct) {
    status = 'critical';
  } else if (occupancyPct >= warningPct) {
    status = 'warning';
  } else {
    status = 'normal';
  }

  return {
    park_id:          park.id,
    tracking_mode:    mode,
    current_occupancy: currentOcc,
    peak_occupancy:   peakOcc,
    entries_today:    totalEntries,
    exits_today:      totalExits,
    capacity,
    occupancy_pct:    occupancyPct !== null ? parseFloat(occupancyPct.toFixed(1)) : null,
    status,
    warning_pct:      parseFloat(park.occupancy_warning_pct)  || 80,
    critical_pct:     parseFloat(park.occupancy_critical_pct) || 95,
    dwell_hours_assumed: mode === 'entry_only' ? DWELL_HOURS : null,
  };
}

// ── Snapshot persistence ──────────────────────────────────────────────────────
async function snapshotOccupancy(pool, parkId) {
  try {
    const result = await computeOccupancy(pool, parkId);
    if (!result) return null;

    const { rows } = await pool.query(
      `INSERT INTO occupancy_snapshots
         (park_id, tracking_mode, entries_total, exits_total, current_occupancy,
          peak_occupancy, capacity, occupancy_pct, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [parkId, result.tracking_mode, result.entries_today, result.exits_today,
       result.current_occupancy, result.peak_occupancy, result.capacity,
       result.occupancy_pct, result.status]
    );
    return rows[0];
  } catch (err) {
    console.error('[occupancyEngine/snapshot]', err.message);
    return null;
  }
}

// ── Multi-park summary ────────────────────────────────────────────────────────
async function computeMultiParkSummary(pool, parkIds = null) {
  try {
    const query = parkIds
      ? `SELECT id FROM parks WHERE id IN (${parkIds.map((_,i)=>`$${i+1}`).join(',')})`
      : `SELECT id FROM parks`;
    const { rows: parks } = await pool.query(query, parkIds || []);

    const results = await Promise.all(parks.map(p => computeOccupancy(pool, p.id)));
    return results.filter(Boolean);
  } catch (err) {
    console.error('[occupancyEngine/multiPark]', err.message);
    return [];
  }
}

module.exports = { computeOccupancy, snapshotOccupancy, computeMultiParkSummary, getParkTrackingMode, DWELL_HOURS };
