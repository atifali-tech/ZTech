'use strict';
/**
 * logOpEvent — write a standardised operational event.
 * Non-fatal, never throws. Replay-safe (idempotent inserts from caller are caller's job).
 * Architecture: single-table fan-out; future Kafka/event-bus can tail this table.
 *
 * Canonical event_type values:
 *   shift_opened | shift_closed | shift_reconciled | shift_variance_flagged
 *   device_assigned | device_unassigned | device_blocked | device_maintenance
 *   gate_enabled | gate_disabled | gate_congested | gate_maintenance
 *   counter_activated | counter_deactivated | counter_maintenance
 *   occupancy_entry_recorded | occupancy_exit_recorded
 */
async function logOpEvent(pool, { event_type, park_id = null, actor_id = null, target_type = null, target_id = null, payload = {} }) {
  try {
    await pool.query(
      `INSERT INTO operational_events (event_type, park_id, actor_id, target_type, target_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event_type, park_id, actor_id, target_type, target_id ? String(target_id) : null, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('[opEvent]', err.message);
  }
}

module.exports = logOpEvent;
