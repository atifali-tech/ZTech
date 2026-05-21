'use strict';
const express           = require('express');
const router            = express.Router();
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');

const MAX_ROWS = 5000;

// Validate date format; returns the date string or null
function safeDate(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : null;
}

// Build SQL date WHERE clauses — safe: regex-validates before interpolation
function dateClause(col, from, to) {
  const parts = [];
  if (from) parts.push(`${col} >= DATE '${from}'`);
  if (to)   parts.push(`${col} <= DATE '${to}'`);
  return parts;
}

// Apply park scope to params + clauses arrays — returns the ANY($n) placeholder
function applyScope(scopedIds, col, params, clauses) {
  if (scopedIds === null) return;
  params.push(scopedIds);
  clauses.push(`${col} = ANY($${params.length})`);
}

// ── GET / — export history from audit_log ─────────────────────────────────────

router.get('/', ...requirePermission('reports.view'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(50,  parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT id, actor_email, action, meta, created_at
       FROM audit_log
      WHERE action LIKE 'report.export.%'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  const { rows: [ct] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM audit_log WHERE action LIKE 'report.export.%'`,
  );

  res.json({ data: rows, total: ct.total, page, limit });
});

// ── GET /export/analytics — daily ticket summary ──────────────────────────────

router.get('/export/analytics', ...requirePermission('analytics.export'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const from   = safeDate(req.query.from);
  const to     = safeDate(req.query.to);
  const params = [];
  const clauses = [
    "t.status != 'Cancelled'",
    '(t.is_reversal IS NULL OR t.is_reversal = FALSE)',
    ...dateClause('DATE(t.created_at)', from, to),
  ];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'analytics', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 't.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT DATE(t.created_at) AS date,
            t.park_id, p.name AS park_name, p.city, p.state,
            COUNT(DISTINCT t.ticket_id)                                                            AS transactions,
            COALESCE(SUM(t.quantity), 0)                                                           AS total_tickets,
            COALESCE(SUM(CASE WHEN t.age_category = 'Adult'          THEN t.quantity ELSE 0 END), 0) AS adults,
            COALESCE(SUM(CASE WHEN t.age_category = 'Child'          THEN t.quantity ELSE 0 END), 0) AS children,
            COALESCE(SUM(CASE WHEN t.age_category = 'Senior Citizen' THEN t.quantity ELSE 0 END), 0) AS seniors,
            COALESCE(SUM(t.total_amount), 0) AS gross_revenue,
            COALESCE(SUM(t.cgst_amount), 0)  AS cgst,
            COALESCE(SUM(t.sgst_amount), 0)  AS sgst,
            COALESCE(SUM(t.cash_amount), 0)  AS cash,
            COALESCE(SUM(t.upi_amount), 0)   AS upi,
            COALESCE(SUM(t.card_amount), 0)  AS card
       FROM tickets t
       JOIN parks p ON p.id = t.park_id
      WHERE ${clauses.join(' AND ')}
      GROUP BY DATE(t.created_at), t.park_id, p.name, p.city, p.state
      ORDER BY date DESC, park_name
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.analytics', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'analytics',
    columns: ['Date','Park ID','Park Name','City','State','Transactions','Total Tickets','Adults','Children','Seniors','Gross Revenue','CGST','SGST','Cash','UPI','Card'],
    rows: rows.map(r => [r.date, r.park_id, r.park_name, r.city, r.state, r.transactions, r.total_tickets, r.adults, r.children, r.seniors, r.gross_revenue, r.cgst, r.sgst, r.cash, r.upi, r.card]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

// ── GET /export/finance — daily finance summary ───────────────────────────────

router.get('/export/finance', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool    = req.app.locals.pool;
  const from    = safeDate(req.query.from);
  const to      = safeDate(req.query.to);
  const params  = [];
  const clauses = [
    "t.status != 'Cancelled'",
    ...dateClause('DATE(t.created_at)', from, to),
  ];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'finance', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 't.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT DATE(t.created_at) AS date,
            t.park_id, p.name AS park_name, p.city, p.state,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.total_amount ELSE 0 END), 0) AS gross_rev,
            COALESCE(SUM(CASE WHEN t.is_reversal = TRUE THEN ABS(t.total_amount) ELSE 0 END), 0)                       AS refunded,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.cgst_amount ELSE 0 END), 0) AS cgst,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.sgst_amount ELSE 0 END), 0) AS sgst,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.cash_amount ELSE 0 END), 0) AS cash,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.upi_amount  ELSE 0 END), 0) AS upi,
            COALESCE(SUM(CASE WHEN (t.is_reversal IS NULL OR t.is_reversal = FALSE) THEN t.card_amount ELSE 0 END), 0) AS card
       FROM tickets t
       JOIN parks p ON p.id = t.park_id
      WHERE ${clauses.join(' AND ')}
      GROUP BY DATE(t.created_at), t.park_id, p.name, p.city, p.state
      ORDER BY date DESC, park_name
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.finance', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'finance',
    columns: ['Date','Park ID','Park Name','City','State','Gross Revenue','Refunded','CGST','SGST','Cash','UPI','Card'],
    rows: rows.map(r => [r.date, r.park_id, r.park_name, r.city, r.state, r.gross_rev, r.refunded, r.cgst, r.sgst, r.cash, r.upi, r.card]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

// ── GET /export/refunds — refund transactions (reversal tickets) ──────────────

router.get('/export/refunds', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool    = req.app.locals.pool;
  const from    = safeDate(req.query.from);
  const to      = safeDate(req.query.to);
  const params  = [];
  const clauses = [
    't.is_reversal = TRUE',
    ...dateClause('DATE(t.created_at)', from, to),
  ];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'refunds', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 't.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT DATE(t.created_at) AS refund_date,
            t.ticket_id, t.park_id, p.name AS park_name,
            t.age_category, t.quantity,
            ABS(t.total_amount) AS refund_amount,
            ABS(t.cgst_amount)  AS cgst_refunded,
            ABS(t.sgst_amount)  AS sgst_refunded,
            t.payment_mode
       FROM tickets t
       JOIN parks p ON p.id = t.park_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY t.created_at DESC
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.refunds', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'refunds',
    columns: ['Refund Date','Ticket Ref','Park ID','Park Name','Category','Qty','Refund Amount','CGST Refunded','SGST Refunded','Payment Mode'],
    rows: rows.map(r => [r.refund_date, r.ticket_id, r.park_id, r.park_name, r.age_category, r.quantity, r.refund_amount, r.cgst_refunded, r.sgst_refunded, r.payment_mode]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

// ── GET /export/settlements — settlement periods ──────────────────────────────

router.get('/export/settlements', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool    = req.app.locals.pool;
  const from    = safeDate(req.query.from);
  const to      = safeDate(req.query.to);
  const params  = [];
  const clauses = ['1=1', ...dateClause('s.period_date', from, to)];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'settlements', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 's.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT s.period_date, s.park_id, p.name AS park_name,
            s.status, s.locked,
            s.expected_rev, s.actual_rev, s.variance,
            s.submitted_at, s.approved_at,
            s.submitted_by, s.approved_by, s.notes
       FROM settlement_periods s
       JOIN parks p ON p.id = s.park_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY s.period_date DESC, park_name
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.settlements', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'settlements',
    columns: ['Period Date','Park ID','Park Name','Status','Locked','Expected Revenue','Actual Revenue','Variance','Submitted At','Approved At','Notes'],
    rows: rows.map(r => [r.period_date, r.park_id, r.park_name, r.status, r.locked, r.expected_rev, r.actual_rev, r.variance, r.submitted_at, r.approved_at, r.notes]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

// ── GET /export/park-performance — aggregated per-park metrics ────────────────

router.get('/export/park-performance', ...requirePermission('reports.view'), parkScope, async (req, res) => {
  const pool    = req.app.locals.pool;
  const from    = safeDate(req.query.from);
  const to      = safeDate(req.query.to);
  const params  = [];
  const clauses = [
    "t.status != 'Cancelled'",
    '(t.is_reversal IS NULL OR t.is_reversal = FALSE)',
    ...dateClause('DATE(t.created_at)', from, to),
  ];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'park-performance', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 't.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT t.park_id, p.name AS park_name, p.city, p.state,
            COUNT(DISTINCT t.ticket_id)      AS transactions,
            COALESCE(SUM(t.quantity), 0)     AS total_tickets,
            COALESCE(SUM(t.total_amount), 0) AS gross_revenue,
            COALESCE(SUM(t.cgst_amount), 0)  AS cgst,
            COALESCE(SUM(t.sgst_amount), 0)  AS sgst,
            COALESCE(SUM(t.cash_amount), 0)  AS cash,
            COALESCE(SUM(t.upi_amount), 0)   AS upi,
            COALESCE(SUM(t.card_amount), 0)  AS card
       FROM tickets t
       JOIN parks p ON p.id = t.park_id
      WHERE ${clauses.join(' AND ')}
      GROUP BY t.park_id, p.name, p.city, p.state
      ORDER BY gross_revenue DESC
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.park-performance', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'park-performance',
    columns: ['Park ID','Park Name','City','State','Transactions','Total Tickets','Gross Revenue','CGST','SGST','Cash','UPI','Card'],
    rows: rows.map(r => [r.park_id, r.park_name, r.city, r.state, r.transactions, r.total_tickets, r.gross_revenue, r.cgst, r.sgst, r.cash, r.upi, r.card]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

// ── GET /export/reconciliation — reconciliation exceptions ────────────────────

router.get('/export/reconciliation', ...requirePermission('finance.reconcile'), parkScope, async (req, res) => {
  const pool    = req.app.locals.pool;
  const from    = safeDate(req.query.from);
  const to      = safeDate(req.query.to);
  const params  = [];
  const clauses = ['1=1', ...dateClause('sp.period_date', from, to)];

  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      return res.json({ report_type: 'reconciliation', columns: [], rows: [], count: 0, truncated: false, filters: { from, to } });
    }
    applyScope(req.scopedParkIds, 'sp.park_id', params, clauses);
  }

  params.push(MAX_ROWS + 1);
  const { rows: raw } = await pool.query(
    `SELECT sp.period_date, sp.park_id, p.name AS park_name,
            e.exception_type, e.severity,
            e.expected_amt, e.actual_amt, e.variance,
            e.resolved, e.notes,
            e.created_at AS flagged_at
       FROM reconciliation_exceptions e
       JOIN settlement_periods sp ON sp.id = e.settlement_id
       JOIN parks p ON p.id = sp.park_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY sp.period_date DESC, e.severity DESC
      LIMIT $${params.length}`,
    params,
  );

  const truncated = raw.length > MAX_ROWS;
  const rows      = raw.slice(0, MAX_ROWS);

  await logAudit(pool, req.user, 'report.export.reconciliation', 'export', null, {
    from, to, park_scope: req.scopedParkIds, row_count: rows.length, truncated,
  });

  res.json({
    report_type: 'reconciliation',
    columns: ['Period Date','Park ID','Park Name','Exception Type','Severity','Expected Amount','Actual Amount','Variance','Resolved','Notes','Flagged At'],
    rows: rows.map(r => [r.period_date, r.park_id, r.park_name, r.exception_type, r.severity, r.expected_amt, r.actual_amt, r.variance, r.resolved, r.notes, r.flagged_at]),
    count: rows.length,
    truncated,
    filters: { from, to },
  });
});

module.exports = router;
