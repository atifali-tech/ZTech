'use strict';
// ═══════════════════════════════════════════════════════════════
// Tickets API — transaction ledger for Page 3
// Base path: /api/tickets
// GET /api/tickets  — paginated, filterable, sortable
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();

const ALLOWED_SORT_COLS = new Set([
  'created_at', 'ticket_id', 'park_name', 'age_category',
  'quantity', 'total_amount', 'payment_mode', 'status',
]);

router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const search      = (req.query.search   || '').trim();
  const parkId      = (req.query.park     || '').trim();
  const ageCategory = (req.query.age      || '').trim();
  const paymentMode = (req.query.payment  || '').trim();
  const status      = (req.query.status   || '').trim();
  const dateFrom    = (req.query.dateFrom || '').trim();
  const dateTo      = (req.query.dateTo   || '').trim();

  let sortCol = req.query.sort || 'created_at';
  let sortDir = req.query.dir  || 'desc';
  if (!ALLOWED_SORT_COLS.has(sortCol)) sortCol = 'created_at';
  if (!['asc', 'desc'].includes(sortDir.toLowerCase())) sortDir = 'desc';

  const conditions = ['1=1'];
  const params     = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`t.ticket_id ILIKE $${params.length}`);
  }
  if (parkId) {
    params.push(parkId);
    conditions.push(`t.park_id = $${params.length}`);
  }
  if (ageCategory) {
    params.push(ageCategory.toLowerCase());
    conditions.push(`LOWER(t.age_category) = $${params.length}`);
  }
  if (paymentMode) {
    params.push(paymentMode);
    conditions.push(`t.payment_mode = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`t.created_at::date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`t.created_at::date <= $${params.length}`);
  }

  const where    = conditions.join(' AND ');
  const orderCol = sortCol === 'park_name' ? 'p.name' : `t.${sortCol}`;

  try {
    const [dataResult, countResult, summaryResult] = await Promise.all([

      pool.query(`
        SELECT
          t.ticket_id,
          t.created_at,
          p.name          AS park_name,
          t.age_category,
          t.quantity,
          t.amount,
          t.cgst_amount,
          t.sgst_amount,
          t.total_amount,
          t.cash_amount,
          t.upi_amount,
          t.card_amount,
          t.payment_mode,
          t.status,
          u.name          AS cashier_name
        FROM   tickets t
        JOIN   parks   p ON p.id = t.park_id
        LEFT JOIN users u ON u.id = t.cashier_id
        WHERE  ${where}
        ORDER  BY ${orderCol} ${sortDir.toUpperCase()}, t.created_at DESC
        LIMIT  $${params.length + 1}
        OFFSET $${params.length + 2}
      `, [...params, limit, offset]),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM   tickets t
        JOIN   parks   p ON p.id = t.park_id
        WHERE  ${where}
      `, params),

      pool.query(`
        SELECT
          COUNT(*)::int                        AS matched_count,
          COALESCE(SUM(t.total_amount), 0)     AS matched_revenue
        FROM   tickets t
        JOIN   parks   p ON p.id = t.park_id
        WHERE  ${where}
      `, params),
    ]);

    const total   = countResult.rows[0].total;
    const summary = summaryResult.rows[0];

    res.json({
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        count:   summary.matched_count,
        revenue: parseFloat(summary.matched_revenue),
      },
      tickets: dataResult.rows.map(r => ({
        ticketId:    r.ticket_id,
        createdAt:   r.created_at,
        park:        r.park_name,
        ageCategory: r.age_category,
        quantity:    parseInt(r.quantity),
        amount:      parseFloat(r.amount),
        cgstAmount:  parseFloat(r.cgst_amount),
        sgstAmount:  parseFloat(r.sgst_amount),
        total:       parseFloat(r.total_amount),
        cashAmount:  parseFloat(r.cash_amount),
        upiAmount:   parseFloat(r.upi_amount),
        cardAmount:  parseFloat(r.card_amount),
        paymentMode: r.payment_mode,
        status:      r.status,
        cashier:     r.cashier_name || '—',
      })),
    });
  } catch (err) {
    console.error('[tickets]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
