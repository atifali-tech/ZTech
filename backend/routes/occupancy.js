'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logOpEvent        = require('../lib/opEvents');
const { computeOccupancy, snapshotOccupancy, computeMultiParkSummary } = require('../lib/occupancyEngine');

const router = express.Router();

// ── POST /api/operations/occupancy/event ──────────────────────────────────────
// Record an entry or exit event. Foundation only — no live engine.
// Gated by gates.view (read) / gates.edit (write) as a proxy.
router.post('/event', requirePermission('gates.edit'), async (req, res) => {
  const { park_id, gate_id = null, event_type, ticket_ref = null, meta = {} } = req.body;
  if (!park_id) return res.status(400).json({ error: 'park_id required' });
  if (!['entry','exit','est_exit'].includes(event_type)) {
    return res.status(400).json({ error: 'event_type must be entry, exit, or est_exit' });
  }
  const pool = req.app.locals.pool;
  try {
    // Verify park capability if settings exist
    const { rows: caps } = await pool.query(
      `SELECT supports_entry_tracking FROM park_operational_settings WHERE park_id = $1`,
      [park_id]
    );
    if (caps[0] && !caps[0].supports_entry_tracking) {
      return res.status(422).json({ error: 'This park does not have entry tracking enabled' });
    }

    const { rows } = await pool.query(
      `INSERT INTO occupancy_events (park_id, gate_id, event_type, ticket_ref, meta)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [park_id, gate_id, event_type, ticket_ref, JSON.stringify(meta)]
    );

    // Update gate throughput counter for entry/exit events
    if (gate_id && event_type !== 'est_exit') {
      await pool.query(
        `UPDATE park_gates SET throughput_today = throughput_today + 1, updated_at = NOW() WHERE id = $1`,
        [gate_id]
      );
    }

    const opEvt = event_type === 'entry' ? 'occupancy_entry_recorded' : 'occupancy_exit_recorded';
    await logOpEvent(pool, {
      event_type: opEvt, park_id,
      actor_id: req.user?.id || null, target_type: 'gate', target_id: gate_id,
      payload: { event_type, ticket_ref, gate_id },
    });

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[occupancy/event]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/occupancy/events ──────────────────────────────────────
// Query occupancy events for a park (for future occupancy engine compatibility).
router.get('/events', [...requirePermission('gates.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, gate_id, event_type, from, to, limit = 200 } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`e.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`e.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    if (gate_id)    { conditions.push(`e.gate_id = $${params.length + 1}`);    params.push(gate_id); }
    if (event_type) { conditions.push(`e.event_type = $${params.length + 1}`); params.push(event_type); }
    if (from)       { conditions.push(`e.recorded_at >= $${params.length + 1}`); params.push(from); }
    if (to)         { conditions.push(`e.recorded_at <= $${params.length + 1}`); params.push(to); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cap   = Math.min(parseInt(limit) || 200, 1000);

    const { rows } = await pool.query(
      `SELECT e.id, e.park_id, e.gate_id, g.name AS gate_name,
              e.event_type, e.ticket_ref, e.recorded_at, e.meta
       FROM occupancy_events e
       LEFT JOIN park_gates g ON g.id = e.gate_id
       ${where}
       ORDER BY e.recorded_at DESC
       LIMIT $${params.length + 1}`,
      [...params, cap]
    );
    res.json(rows);
  } catch (err) {
    console.error('[occupancy/events]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/occupancy/summary ─────────────────────────────────────
// Simple per-park today summary: entries, exits, estimated current occupancy.
router.get('/summary', [...requirePermission('gates.view'), parkScope], async (req, res) => {
  const { park_id } = req.query;
  if (!park_id) return res.status(400).json({ error: 'park_id required' });
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT
         SUM(CASE WHEN event_type = 'entry'    THEN 1 ELSE 0 END)::int AS entries_today,
         SUM(CASE WHEN event_type IN ('exit','est_exit') THEN 1 ELSE 0 END)::int AS exits_today
       FROM occupancy_events
       WHERE park_id = $1
         AND recorded_at >= CURRENT_DATE`,
      [park_id]
    );
    const { entries_today = 0, exits_today = 0 } = rows[0] || {};
    res.json({
      park_id,
      entries_today,
      exits_today,
      estimated_occupancy: Math.max(0, entries_today - exits_today),
    });
  } catch (err) {
    console.error('[occupancy/summary]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/occupancy/live ───────────────────────────────────────
// Live occupancy computation for a single park (engine V1).
router.get('/live', [...requirePermission('occupancy.view'), parkScope], async (req, res) => {
  const { park_id } = req.query;
  if (!park_id) return res.status(400).json({ error: 'park_id required' });
  const pool = req.app.locals.pool;
  try {
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    const result = await computeOccupancy(pool, park_id);
    if (!result) return res.status(404).json({ error: 'Park not found' });
    res.json(result);
  } catch (err) {
    console.error('[occupancy/live]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/occupancy/live/all ────────────────────────────────────
// Multi-park live occupancy summary (scoped).
router.get('/live/all', [...requirePermission('occupancy.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const scopedIds = req.scopedParkIds;
    const results = await computeMultiParkSummary(pool, scopedIds);
    res.json(results);
  } catch (err) {
    console.error('[occupancy/live/all]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/occupancy/snapshot ───────────────────────────────────
// Persist an occupancy snapshot for a park.
router.post('/snapshot', requirePermission('occupancy.view'), async (req, res) => {
  const { park_id } = req.body;
  if (!park_id) return res.status(400).json({ error: 'park_id required' });
  const pool = req.app.locals.pool;
  try {
    const snapshot = await snapshotOccupancy(pool, park_id);
    if (!snapshot) return res.status(404).json({ error: 'Park not found or snapshot failed' });
    res.status(201).json(snapshot);
  } catch (err) {
    console.error('[occupancy/snapshot]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/occupancy/snapshots ───────────────────────────────────
// Historical occupancy snapshots for trend display.
router.get('/snapshots', [...requirePermission('occupancy.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, limit = 48 } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`park_id = $${params.length + 1}`); params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`park_id IN (${phs})`); params.push(...scopedIds);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const cap   = Math.min(parseInt(limit) || 48, 200);

    const { rows } = await pool.query(
      `SELECT * FROM occupancy_snapshots ${where}
       ORDER BY snapshot_at DESC LIMIT $${params.length + 1}`,
      [...params, cap]
    );
    res.json(rows);
  } catch (err) {
    console.error('[occupancy/snapshots]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
