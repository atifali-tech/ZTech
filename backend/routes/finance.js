'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const { computeSettlementExpected, computeVariance } = require('../lib/financeUtils');
const { notify, notifyByPermission, logWorkflowEvent } = require('../lib/notifier');

// Build date WHERE clauses for a column — safe: regex-validates before interpolation
function finDate(col, from, to) {
  const parts = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) parts.push(`${col} >= DATE '${from}'`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to   || '')) parts.push(`${col} <= DATE '${to}'`);
  return parts;
}

const router = express.Router();

// ── GET /settlements — list settlement periods ────────────────────────────────

router.get('/settlements', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const status = req.query.status;
  const from   = req.query.from;
  const to     = req.query.to;
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params     = [];

  if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (from)   { params.push(from);   conditions.push(`s.period_date >= $${params.length}`); }
  if (to)     { params.push(to);     conditions.push(`s.period_date <= $${params.length}`); }
  if (req.scopedParkIds !== null) {
    params.push(req.scopedParkIds);
    conditions.push(`s.park_id = ANY($${params.length})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT s.id, s.park_id, p.name AS park_name, s.period_date, s.status,
            s.locked, s.expected_rev, s.actual_rev, s.variance, s.notes,
            s.submitted_at, s.approved_at,
            su.email AS submitted_by_email, au.email AS approved_by_email
       FROM settlement_periods s
       JOIN parks p ON p.id = s.park_id
       LEFT JOIN users su ON su.id = s.submitted_by
       LEFT JOIN users au ON au.id = s.approved_by
      WHERE ${where}
      ORDER BY s.period_date DESC, p.name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total
       FROM settlement_periods s
      WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2),
  );

  res.json({ data: rows, total: parseInt(total, 10), page, limit });
});

// ── POST /settlements/:id/submit ──────────────────────────────────────────────

router.post('/settlements/:id/submit', ...requirePermission('finance.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows: [sp] } = await pool.query(
    'SELECT * FROM settlement_periods WHERE id = $1',
    [req.params.id],
  );
  if (!sp) return res.status(404).json({ error: 'Settlement period not found' });
  if (sp.status !== 'open') return res.status(409).json({ error: `Cannot submit a settlement in '${sp.status}' status` });

  const expected = await computeSettlementExpected(pool, sp.park_id, sp.period_date);
  const actual   = parseFloat(req.body?.actual_rev ?? 0);
  const { variance } = computeVariance(expected.expected_rev, actual);

  const { rows: [updated] } = await pool.query(
    `UPDATE settlement_periods
        SET status = 'submitted', submitted_by = $1, submitted_at = NOW(),
            expected_rev = $2, actual_rev = $3, variance = $4, notes = $5
      WHERE id = $6 RETURNING *`,
    [req.user.id, expected.expected_rev, actual, variance, req.body?.notes || null, sp.id],
  );

  await logAudit(pool, req.user, 'settlement.submit', 'settlement_period', sp.id, {
    park_id: sp.park_id, period_date: sp.period_date,
    expected_rev: expected.expected_rev, actual_rev: actual, variance,
  });

  logWorkflowEvent(pool, {
    eventType: 'settlement.submitted', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'settlement_period', entityId: sp.id,
    parkId: sp.park_id,
    meta: { park_id: sp.park_id, period_date: sp.period_date, expected_rev: expected.expected_rev, actual_rev: actual, variance },
  }).catch(e => console.error('[notifier] settlement.submitted:', e.message));

  notifyByPermission(pool, {
    permission: 'finance.approve',
    type: 'settlement.submitted',
    title: `Settlement Submitted — ${sp.park_id} · ${sp.period_date}`,
    meta: { settlement_id: sp.id, park_id: sp.park_id, period_date: sp.period_date, variance },
    parkId: sp.park_id,
  }).catch(e => console.error('[notifier] notify settlement.submitted:', e.message));

  res.json(updated);
});

// ── POST /settlements/:id/approve ─────────────────────────────────────────────

router.post('/settlements/:id/approve', ...requirePermission('finance.approve'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows: [sp] } = await pool.query(
    'SELECT * FROM settlement_periods WHERE id = $1',
    [req.params.id],
  );
  if (!sp) return res.status(404).json({ error: 'Settlement period not found' });
  if (sp.status !== 'submitted') return res.status(409).json({ error: 'Settlement must be submitted before approval' });

  const { rows: [updated] } = await pool.query(
    `UPDATE settlement_periods
        SET status = 'approved', approved_by = $1, approved_at = NOW(), locked = TRUE
      WHERE id = $2 RETURNING *`,
    [req.user.id, sp.id],
  );

  await logAudit(pool, req.user, 'settlement.approve', 'settlement_period', sp.id, {
    park_id: sp.park_id, period_date: sp.period_date,
  });

  logWorkflowEvent(pool, {
    eventType: 'settlement.approved', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'settlement_period', entityId: sp.id,
    parkId: sp.park_id,
    meta: { park_id: sp.park_id, period_date: sp.period_date },
  }).catch(e => console.error('[notifier] settlement.approved:', e.message));

  // Notify the submitter if we can resolve their user ID
  if (sp.submitted_by) {
    notify(pool, {
      userId: String(sp.submitted_by),
      type: 'settlement.approved',
      title: `Settlement Approved — ${sp.park_id} · ${sp.period_date}`,
      meta: { settlement_id: sp.id, park_id: sp.park_id, period_date: sp.period_date },
      parkId: sp.park_id,
    }).catch(e => console.error('[notifier] notify settlement.approved:', e.message));
  }

  res.json(updated);
});

// ── POST /settlements/:id/dispute ─────────────────────────────────────────────

router.post('/settlements/:id/dispute', ...requirePermission('finance.approve'), async (req, res) => {
  const pool = req.app.locals.pool;
  const { rows: [sp] } = await pool.query(
    'SELECT * FROM settlement_periods WHERE id = $1',
    [req.params.id],
  );
  if (!sp) return res.status(404).json({ error: 'Settlement period not found' });
  if (!['submitted', 'approved'].includes(sp.status)) {
    return res.status(409).json({ error: `Cannot dispute a settlement in '${sp.status}' status` });
  }

  const { rows: [updated] } = await pool.query(
    `UPDATE settlement_periods
        SET status = 'disputed', locked = FALSE, notes = $1
      WHERE id = $2 RETURNING *`,
    [req.body?.reason || sp.notes, sp.id],
  );

  await logAudit(pool, req.user, 'settlement.dispute', 'settlement_period', sp.id, {
    park_id: sp.park_id, period_date: sp.period_date, reason: req.body?.reason,
  });

  logWorkflowEvent(pool, {
    eventType: 'settlement.disputed', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'settlement_period', entityId: sp.id,
    parkId: sp.park_id,
    meta: { park_id: sp.park_id, period_date: sp.period_date, reason: req.body?.reason },
  }).catch(e => console.error('[notifier] settlement.disputed:', e.message));

  if (sp.submitted_by) {
    notify(pool, {
      userId: String(sp.submitted_by),
      type: 'settlement.disputed',
      title: `Settlement Disputed — ${sp.park_id} · ${sp.period_date}`,
      body: req.body?.reason || null,
      meta: { settlement_id: sp.id, park_id: sp.park_id, period_date: sp.period_date },
      parkId: sp.park_id,
    }).catch(e => console.error('[notifier] notify settlement.disputed:', e.message));
  }

  res.json(updated);
});

// ── GET /tax/rates — list active GST rates ────────────────────────────────────

router.get('/tax/rates', ...requirePermission('finance.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  const asOf = req.query.as_of || new Date().toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT id, category, cgst_pct, sgst_pct, igst_pct, effective_from, effective_to
       FROM gst_rates
      WHERE effective_from <= $1
        AND (effective_to IS NULL OR effective_to >= $1)
      ORDER BY category, effective_from DESC`,
    [asOf],
  );

  res.json(rows);
});

// ── GET /reconciliation/summary — variance summary for a park+date ────────────

router.get('/reconciliation/summary', ...requirePermission('finance.reconcile'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const parkId = parseInt(req.query.park_id, 10);
  const date   = req.query.date;

  if (!parkId || !date) {
    return res.status(400).json({ error: 'park_id and date are required' });
  }

  if (req.scopedParkIds !== null && !req.scopedParkIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }

  const expected = await computeSettlementExpected(pool, parkId, date);

  const { rows: [sp] } = await pool.query(
    `SELECT actual_rev, variance, status, locked
       FROM settlement_periods
      WHERE park_id = $1 AND period_date = $2`,
    [parkId, date],
  );

  const actualRev   = sp ? parseFloat(sp.actual_rev ?? 0) : null;
  const varianceSummary = actualRev !== null
    ? computeVariance(expected.expected_rev, actualRev)
    : null;

  const { rows: exceptions } = await pool.query(
    `SELECT e.id, e.ticket_id, e.exception_type, e.severity,
            e.expected_amt, e.actual_amt, e.variance, e.resolved, e.notes
       FROM reconciliation_exceptions e
       JOIN settlement_periods s ON s.id = e.settlement_id
      WHERE s.park_id = $1 AND s.period_date = $2`,
    [parkId, date],
  );

  res.json({
    park_id:     parkId,
    date,
    expected:    expected,
    actual_rev:  actualRev,
    variance:    varianceSummary,
    settlement:  sp || null,
    exceptions,
  });
});

// ── GET /audit — finance-specific audit trail ─────────────────────────────────

router.get('/audit', ...requirePermission('finance.view'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const offset = (page - 1) * limit;
  const prefix = req.query.action_prefix; // 'refund' | 'settlement' | omit for all

  let where  = `(action LIKE 'refund.%' OR action LIKE 'settlement.%')`;
  let params = [];
  if (prefix) {
    params.push(`${prefix}.%`);
    where = `action LIKE $${params.length}`;
  }

  const countParams = [...params];
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT id, actor_id, actor_email, action, target_type, target_id, meta, created_at
       FROM audit_log
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const { rows: [ct] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM audit_log WHERE ${where}`,
    countParams,
  );

  res.json({ data: rows, total: ct.total, page, limit });
});

// ── GET /analytics/overview ───────────────────────────────────────────────────

router.get('/analytics/overview', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool = req.app.locals.pool;
  const { from, to } = req.query;

  const dateParts = finDate('DATE(t.created_at)', from, to);

  const tParams = [];
  const tClauses = ["t.status != 'Cancelled'", '(t.is_reversal IS NULL OR t.is_reversal = FALSE)', ...dateParts];
  const rClauses = ['t.is_reversal = TRUE', ...dateParts];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ gross_rev: 0, net_rev: 0, refunded_amount: 0, refund_pct: 0, cgst_total: 0, sgst_total: 0, ticket_count: 0, pending_settlements: 0, locked_periods: 0, unresolved_variances: 0 });
    }
    tParams.push(req.scopedParkIds);
    const pn = `$${tParams.length}`;
    tClauses.push(`t.park_id = ANY(${pn})`);
    rClauses.push(`t.park_id = ANY(${pn})`);
  }

  const sParams   = req.scopedParkIds !== null ? [req.scopedParkIds] : [];
  const sWhere    = req.scopedParkIds !== null ? 'WHERE park_id = ANY($1)' : '';
  const eParams   = req.scopedParkIds !== null ? [req.scopedParkIds] : [];
  const eClauses  = ['re.resolved = FALSE'];
  if (req.scopedParkIds !== null) eClauses.push('sp.park_id = ANY($1)');

  const [tR, rR, sR, eR] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(t.total_amount), 0) AS gross_rev,
              COALESCE(SUM(t.cgst_amount), 0)  AS cgst_total,
              COALESCE(SUM(t.sgst_amount), 0)  AS sgst_total,
              COUNT(DISTINCT t.ticket_id) AS ticket_count
         FROM tickets t WHERE ${tClauses.join(' AND ')}`,
      tParams,
    ),
    pool.query(
      `SELECT COALESCE(ABS(SUM(t.total_amount)), 0) AS refunded_amount
         FROM tickets t WHERE ${rClauses.join(' AND ')}`,
      tParams,
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status IN ('open','submitted')) AS pending_settlements,
              COUNT(*) FILTER (WHERE locked = TRUE) AS locked_periods
         FROM settlement_periods ${sWhere}`,
      sParams,
    ),
    pool.query(
      `SELECT COUNT(*) AS unresolved_variances
         FROM reconciliation_exceptions re
         JOIN settlement_periods sp ON sp.id = re.settlement_id
        WHERE ${eClauses.join(' AND ')}`,
      eParams,
    ),
  ]);

  const gross_rev       = parseFloat(tR.rows[0].gross_rev);
  const refunded_amount = parseFloat(rR.rows[0].refunded_amount);
  const net_rev         = gross_rev - refunded_amount;
  const refund_pct      = gross_rev > 0 ? parseFloat((refunded_amount / gross_rev * 100).toFixed(2)) : 0;

  res.json({
    gross_rev,
    net_rev,
    refunded_amount,
    refund_pct,
    cgst_total:           parseFloat(tR.rows[0].cgst_total),
    sgst_total:           parseFloat(tR.rows[0].sgst_total),
    ticket_count:         parseInt(tR.rows[0].ticket_count, 10),
    pending_settlements:  parseInt(sR.rows[0].pending_settlements, 10),
    locked_periods:       parseInt(sR.rows[0].locked_periods, 10),
    unresolved_variances: parseInt(eR.rows[0].unresolved_variances, 10),
  });
});

// ── GET /analytics/refund-trend — last N months of reversal tickets ───────────

router.get('/analytics/refund-trend', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));

  const params = [];
  const clauses = [
    't.is_reversal = TRUE',
    `DATE(t.created_at) > CURRENT_DATE - INTERVAL '${months} months'`,
  ];
  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) return res.json([]);
    params.push(req.scopedParkIds);
    clauses.push(`t.park_id = ANY($${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT TO_CHAR(DATE_TRUNC('month', t.created_at), 'YYYY-MM') AS month,
            COUNT(DISTINCT t.ticket_id) AS refund_count,
            COALESCE(ABS(SUM(t.total_amount)), 0) AS refund_amount
       FROM tickets t
      WHERE ${clauses.join(' AND ')}
      GROUP BY DATE_TRUNC('month', t.created_at)
      ORDER BY DATE_TRUNC('month', t.created_at)`,
    params,
  );

  res.json(rows.map(r => ({
    month:         r.month,
    refund_count:  parseInt(r.refund_count, 10),
    refund_amount: parseFloat(r.refund_amount),
  })));
});

// ── GET /analytics/park-performance — per-park KPIs ──────────────────────────

router.get('/analytics/park-performance', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool = req.app.locals.pool;
  const { from, to } = req.query;

  const dateParts = finDate('DATE(t.created_at)', from, to);
  const params    = [];
  const tClauses  = ["t.status != 'Cancelled'", '(t.is_reversal IS NULL OR t.is_reversal = FALSE)', ...dateParts];
  const rClauses  = ['t.is_reversal = TRUE', ...dateParts];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) return res.json([]);
    params.push(req.scopedParkIds);
    const pn = `$${params.length}`;
    tClauses.push(`t.park_id = ANY(${pn})`);
    rClauses.push(`t.park_id = ANY(${pn})`);
  }

  const sParams = req.scopedParkIds !== null ? [req.scopedParkIds] : [];
  const sScope  = req.scopedParkIds !== null ? 'WHERE park_id = ANY($1)' : '';

  const [grossR, refundR, settlR] = await Promise.all([
    pool.query(
      `SELECT t.park_id, p.name AS park_name,
              COALESCE(SUM(t.total_amount), 0) AS gross_rev,
              COUNT(DISTINCT t.ticket_id) AS ticket_count
         FROM tickets t
         JOIN parks p ON p.id = t.park_id
        WHERE ${tClauses.join(' AND ')}
        GROUP BY t.park_id, p.name
        ORDER BY gross_rev DESC`,
      params,
    ),
    pool.query(
      `SELECT t.park_id, COALESCE(ABS(SUM(t.total_amount)), 0) AS refunded_amount
         FROM tickets t
        WHERE ${rClauses.join(' AND ')}
        GROUP BY t.park_id`,
      params,
    ),
    pool.query(
      `SELECT DISTINCT ON (park_id) park_id, status
         FROM settlement_periods ${sScope}
        ORDER BY park_id, period_date DESC`,
      sParams,
    ),
  ]);

  const refundMap = Object.fromEntries(refundR.rows.map(r => [r.park_id, parseFloat(r.refunded_amount)]));
  const settlMap  = Object.fromEntries(settlR.rows.map(r => [r.park_id, r.status]));

  res.json(grossR.rows.map(r => {
    const refunded = refundMap[r.park_id] || 0;
    const gross    = parseFloat(r.gross_rev);
    return {
      park_id:           r.park_id,
      park_name:         r.park_name,
      gross_rev:         gross,
      refunded_amount:   refunded,
      net_rev:           parseFloat((gross - refunded).toFixed(2)),
      refund_pct:        gross > 0 ? parseFloat((refunded / gross * 100).toFixed(2)) : 0,
      ticket_count:      parseInt(r.ticket_count, 10),
      settlement_status: settlMap[r.park_id] || null,
    };
  }));
});

// ── GET /analytics/tax-summary — GST breakdown by category and park ───────────

router.get('/analytics/tax-summary', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool = req.app.locals.pool;
  const { from, to } = req.query;

  const dateParts = finDate('DATE(t.created_at)', from, to);
  const params    = [];
  const clauses   = ["t.status != 'Cancelled'", '(t.is_reversal IS NULL OR t.is_reversal = FALSE)', ...dateParts];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ by_category: [], by_park: [], totals: { cgst: 0, sgst: 0, total_tax: 0 } });
    }
    params.push(req.scopedParkIds);
    clauses.push(`t.park_id = ANY($${params.length})`);
  }
  const where = clauses.join(' AND ');

  const [catR, parkR] = await Promise.all([
    pool.query(
      `SELECT t.age_category AS category,
              COUNT(DISTINCT t.ticket_id) AS ticket_count,
              COALESCE(SUM(t.cgst_amount), 0) AS cgst,
              COALESCE(SUM(t.sgst_amount), 0) AS sgst,
              COALESCE(SUM(t.cgst_amount + t.sgst_amount), 0) AS total_tax
         FROM tickets t
        WHERE ${where}
        GROUP BY t.age_category
        ORDER BY cgst DESC`,
      params,
    ),
    pool.query(
      `SELECT t.park_id, p.name AS park_name,
              COALESCE(SUM(t.cgst_amount), 0) AS cgst,
              COALESCE(SUM(t.sgst_amount), 0) AS sgst,
              COALESCE(SUM(t.cgst_amount + t.sgst_amount), 0) AS total_tax
         FROM tickets t
         JOIN parks p ON p.id = t.park_id
        WHERE ${where}
        GROUP BY t.park_id, p.name
        ORDER BY cgst DESC`,
      params,
    ),
  ]);

  const totals = catR.rows.reduce(
    (acc, r) => ({ cgst: acc.cgst + parseFloat(r.cgst), sgst: acc.sgst + parseFloat(r.sgst), total_tax: acc.total_tax + parseFloat(r.total_tax) }),
    { cgst: 0, sgst: 0, total_tax: 0 },
  );

  res.json({
    by_category: catR.rows.map(r => ({
      category:     r.category,
      ticket_count: parseInt(r.ticket_count, 10),
      cgst:         parseFloat(r.cgst),
      sgst:         parseFloat(r.sgst),
      total_tax:    parseFloat(r.total_tax),
    })),
    by_park: parkR.rows.map(r => ({
      park_id:   r.park_id,
      park_name: r.park_name,
      cgst:      parseFloat(r.cgst),
      sgst:      parseFloat(r.sgst),
      total_tax: parseFloat(r.total_tax),
    })),
    totals,
  });
});

module.exports = router;
