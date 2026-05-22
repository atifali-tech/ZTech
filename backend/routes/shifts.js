'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const logOpEvent        = require('../lib/opEvents');

const router = express.Router();

const OPEN_STATUSES = ['Open', 'Operating'];
const VALID_STATUSES = ['Open', 'Operating', 'Closed', 'Reconciled', 'Variance Flagged'];

const SHIFT_SELECT = `
  SELECT s.id, s.park_id, p.name AS park_name,
         s.counter_id, c.name AS counter_name,
         s.user_id, u.name AS user_name,
         s.supervisor_id, sv.name AS supervisor_name,
         s.status, s.opened_at, s.closed_at,
         s.opening_cash, s.declared_cash,
         s.expected_rev, s.actual_rev, s.variance,
         s.transaction_count, s.refund_count,
         s.notes, s.created_at, s.updated_at
  FROM shift_sessions s
  JOIN  parks p ON p.id = s.park_id
  LEFT JOIN park_counters c ON c.id = s.counter_id
  JOIN  users u ON u.id = s.user_id
  LEFT JOIN users sv ON sv.id = s.supervisor_id
`;

// ── GET /api/operations/shifts ────────────────────────────────────────────────
router.get('/', [...requirePermission('shifts.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  const { park_id, user_id, status, counter_id } = req.query;
  try {
    const scopedIds = req.scopedParkIds;
    const params = [];
    const conditions = [];

    if (park_id) {
      if (scopedIds !== null && !scopedIds.includes(park_id)) {
        return res.status(403).json({ error: 'Access denied to this park' });
      }
      conditions.push(`s.park_id = $${params.length + 1}`);
      params.push(park_id);
    } else if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`s.park_id IN (${phs})`);
      params.push(...scopedIds);
    }

    if (user_id)    { conditions.push(`s.user_id = $${params.length + 1}`);    params.push(user_id); }
    if (status)     { conditions.push(`s.status = $${params.length + 1}`);     params.push(status); }
    if (counter_id) { conditions.push(`s.counter_id = $${params.length + 1}`); params.push(counter_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(`${SHIFT_SELECT} ${where} ORDER BY s.opened_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error('[shifts/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/operations/shifts/:id ────────────────────────────────────────────
router.get('/:id', [...requirePermission('shifts.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(`${SHIFT_SELECT} WHERE s.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found' });
    const scopedIds = req.scopedParkIds;
    if (scopedIds !== null && !scopedIds.includes(rows[0].park_id)) {
      return res.status(403).json({ error: 'Access denied to this park' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[shifts/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/shifts — open a shift ────────────────────────────────
router.post('/', requirePermission('shifts.create'), async (req, res) => {
  const {
    park_id, counter_id = null,
    opening_cash = null, expected_rev = null,
  } = req.body;
  if (!park_id) return res.status(400).json({ error: 'park_id required' });

  const pool = req.app.locals.pool;
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM shift_sessions WHERE user_id = $1 AND park_id = $2 AND status = ANY($3::text[])`,
      [req.user.id, park_id, OPEN_STATUSES]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'You already have an open shift at this park' });
    }

    const { rows } = await pool.query(
      `INSERT INTO shift_sessions
         (park_id, counter_id, user_id, opening_cash, expected_rev, status)
       VALUES ($1, $2, $3, $4, $5, 'Open')
       RETURNING *`,
      [park_id, counter_id, req.user.id, opening_cash, expected_rev]
    );
    const shift = rows[0];

    // Mark counter as Shift Open
    if (counter_id) {
      await pool.query(
        `UPDATE park_counters SET op_status = 'Shift Open', current_shift_id = $1, updated_at = NOW() WHERE id = $2`,
        [shift.id, counter_id]
      );
    }

    await logAudit(pool, req.user, 'shift.open', 'shift', shift.id, { park_id, counter_id, opening_cash });
    await logOpEvent(pool, {
      event_type: 'shift_opened', park_id,
      actor_id: req.user.id, target_type: 'shift', target_id: shift.id,
      payload: { counter_id, opening_cash, expected_rev },
    });

    res.status(201).json(shift);
  } catch (err) {
    console.error('[shifts/open]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/shifts/:id/close ─────────────────────────────────────
router.post('/:id/close', requirePermission('shifts.close'), async (req, res) => {
  const { declared_cash, actual_rev, notes, supervisor_id = null } = req.body;
  const pool = req.app.locals.pool;
  try {
    // Fetch current shift to determine variance
    const { rows: cur } = await pool.query(
      `SELECT * FROM shift_sessions WHERE id = $1 AND status = ANY($2::text[])`,
      [req.params.id, OPEN_STATUSES]
    );
    if (!cur[0]) return res.status(404).json({ error: 'Shift not found or already closed' });
    const shift = cur[0];

    const finalActual = actual_rev ?? declared_cash ?? null;
    const expectedVal = parseFloat(shift.expected_rev) || 0;
    const actualVal   = parseFloat(finalActual) || 0;
    const hasVariance = shift.expected_rev != null && Math.abs(actualVal - expectedVal) > 0.01;
    const newStatus   = hasVariance ? 'Variance Flagged' : 'Closed';

    const { rows } = await pool.query(
      `UPDATE shift_sessions SET
         status = $1, closed_at = NOW(),
         declared_cash = $2, actual_rev = $3,
         supervisor_id = $4, notes = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [newStatus, declared_cash ?? null, finalActual, supervisor_id, notes ?? null, req.params.id]
    );

    // Release counter
    if (shift.counter_id) {
      await pool.query(
        `UPDATE park_counters SET op_status = 'Shift Closed', current_shift_id = NULL, updated_at = NOW() WHERE id = $1`,
        [shift.counter_id]
      );
    }

    const evtType = newStatus === 'Variance Flagged' ? 'shift_variance_flagged' : 'shift_closed';
    await logAudit(pool, req.user, 'shift.close', 'shift', req.params.id, { declared_cash, actual_rev, newStatus });
    await logOpEvent(pool, {
      event_type: evtType, park_id: shift.park_id,
      actor_id: req.user.id, target_type: 'shift', target_id: req.params.id,
      payload: { declared_cash, actual_rev: finalActual, expected_rev: shift.expected_rev, supervisor_id },
    });

    res.json(rows[0]);
  } catch (err) {
    console.error('[shifts/close]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/operations/shifts/:id/reconcile ─────────────────────────────────
router.post('/:id/reconcile', requirePermission('shifts.close'), async (req, res) => {
  const { notes, supervisor_id = null } = req.body;
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `UPDATE shift_sessions SET
         status = 'Reconciled', supervisor_id = COALESCE($1, supervisor_id),
         notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND status IN ('Closed','Variance Flagged')
       RETURNING *`,
      [supervisor_id, notes ?? null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found or not in closeable state' });

    await logAudit(pool, req.user, 'shift.reconcile', 'shift', req.params.id, { supervisor_id });
    await logOpEvent(pool, {
      event_type: 'shift_reconciled', park_id: rows[0].park_id,
      actor_id: req.user.id, target_type: 'shift', target_id: req.params.id,
      payload: { supervisor_id, notes },
    });
    res.json(rows[0]);
  } catch (err) {
    console.error('[shifts/reconcile]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/operations/shifts/:id — mid-shift updates (transaction counts) ───
router.put('/:id', requirePermission('shifts.edit'), async (req, res) => {
  const { status, actual_rev, expected_rev, notes, transaction_count, refund_count } = req.body;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }
  const pool = req.app.locals.pool;
  try {
    const sets = []; const vals = []; let idx = 1;
    if (status            !== undefined) { sets.push(`status = $${idx++}`);            vals.push(status); }
    if (actual_rev        !== undefined) { sets.push(`actual_rev = $${idx++}`);        vals.push(actual_rev); }
    if (expected_rev      !== undefined) { sets.push(`expected_rev = $${idx++}`);      vals.push(expected_rev); }
    if (notes             !== undefined) { sets.push(`notes = $${idx++}`);             vals.push(notes); }
    if (transaction_count !== undefined) { sets.push(`transaction_count = $${idx++}`); vals.push(transaction_count); }
    if (refund_count      !== undefined) { sets.push(`refund_count = $${idx++}`);      vals.push(refund_count); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push(`updated_at = NOW()`);
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE shift_sessions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Shift not found' });
    await logAudit(pool, req.user, 'shift.update', 'shift', req.params.id, { status, transaction_count, refund_count });
    res.json(rows[0]);
  } catch (err) {
    console.error('[shifts/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
