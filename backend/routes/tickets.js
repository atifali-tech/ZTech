'use strict';
// ═══════════════════════════════════════════════════════════════
// Tickets API
// Base path: /api/tickets
// GET  /api/tickets        — paginated, filterable, sortable
// POST /api/tickets        — create one ticket
// POST /api/tickets/batch  — create multiple tickets (offline sync)
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_AGE_CATEGORIES = new Set(['Adult', 'Child', 'Toddler', 'Senior Citizen']);
const VALID_PAYMENT_MODES  = new Set(['Cash', 'UPI', 'Card', 'Split']);
const VALID_SOURCES        = new Set(['App', 'Counter', 'Web']);
const VALID_STATUSES       = new Set(['Confirmed', 'Completed', 'Cancelled']);
const VALID_GENDERS        = new Set(['Male', 'Female', 'Other', '']);

function validateTicket(t) {
  const errors = [];
  if (!t.ticket_id || String(t.ticket_id).length > 20)
    errors.push('ticket_id: required, max 20 chars');
  if (!t.park_id || !/^[0-9a-f-]{36}$/.test(t.park_id))
    errors.push('park_id: required, must be a valid UUID');
  if (!VALID_AGE_CATEGORIES.has(t.age_category))
    errors.push(`age_category: must be one of ${[...VALID_AGE_CATEGORIES].join(', ')}`);
  if (!Number.isInteger(Number(t.quantity)) || Number(t.quantity) < 1)
    errors.push('quantity: required, positive integer');
  for (const f of ['amount', 'cgst_amount', 'sgst_amount', 'total_amount', 'cash_amount', 'upi_amount', 'card_amount']) {
    if (t[f] == null || isNaN(Number(t[f])) || Number(t[f]) < 0)
      errors.push(`${f}: required, non-negative number`);
  }
  if (!VALID_PAYMENT_MODES.has(t.payment_mode))
    errors.push(`payment_mode: must be one of ${[...VALID_PAYMENT_MODES].join(', ')}`);
  if (!VALID_SOURCES.has(t.source))
    errors.push(`source: must be one of ${[...VALID_SOURCES].join(', ')}`);
  if (t.status && !VALID_STATUSES.has(t.status))
    errors.push(`status: must be one of ${[...VALID_STATUSES].join(', ')}`);
  if (t.gender != null && !VALID_GENDERS.has(t.gender))
    errors.push(`gender: must be Male, Female, Other, or omitted`);
  return errors;
}

async function insertTicket(pool, t) {
  const { rows } = await pool.query(`
    INSERT INTO tickets (
      ticket_id, park_id, age_category, quantity,
      amount, cgst_amount, sgst_amount, total_amount,
      cash_amount, upi_amount, card_amount,
      payment_mode, status, source,
      cashier_id, device_id, gender, created_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17,
      COALESCE($18::timestamptz, NOW())
    )
    ON CONFLICT (ticket_id) DO NOTHING
    RETURNING ticket_id, created_at
  `, [
    t.ticket_id, t.park_id, t.age_category, t.quantity,
    t.amount, t.cgst_amount, t.sgst_amount, t.total_amount,
    t.cash_amount, t.upi_amount, t.card_amount,
    t.payment_mode, t.status || 'Completed', t.source,
    t.cashier_id || null, t.device_id || null, t.gender || null,
    t.created_at || null,
  ]);
  return rows[0] || null; // null = duplicate ticket_id, silently skipped
}

// ─── POST /api/tickets ────────────────────────────────────────────────────────
// Create a single ticket. Returns 201 on success, 409 if ticket_id already exists.
router.post('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const t    = req.body;

  if (!t || typeof t !== 'object' || Array.isArray(t))
    return res.status(400).json({ error: 'Request body must be a JSON object' });

  const errors = validateTicket(t);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  try {
    const inserted = await insertTicket(pool, t);
    if (!inserted) return res.status(409).json({ error: 'ticket_id already exists', ticket_id: t.ticket_id });
    res.status(201).json({ ok: true, ticket_id: inserted.ticket_id, created_at: inserted.created_at });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'park_id does not exist' });
    console.error('[POST /tickets]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tickets/batch ──────────────────────────────────────────────────
// Create up to 500 tickets in one call (for offline sync).
// Returns a summary: inserted count, skipped duplicates, and any per-row errors.
router.post('/batch', async (req, res) => {
  const pool    = req.app.locals.pool;
  const tickets = req.body;

  if (!Array.isArray(tickets) || tickets.length === 0)
    return res.status(400).json({ error: 'Request body must be a non-empty array of tickets' });
  if (tickets.length > 500)
    return res.status(400).json({ error: 'Batch limit is 500 tickets per request' });

  const results = { inserted: 0, skipped: 0, errors: [] };

  for (let i = 0; i < tickets.length; i++) {
    const t      = tickets[i];
    const errors = validateTicket(t);
    if (errors.length) {
      results.errors.push({ index: i, ticket_id: t.ticket_id, details: errors });
      continue;
    }
    try {
      const inserted = await insertTicket(pool, t);
      inserted ? results.inserted++ : results.skipped++;
    } catch (err) {
      results.errors.push({ index: i, ticket_id: t.ticket_id, error: err.message });
    }
  }

  const status = results.errors.length > 0 && results.inserted === 0 ? 400 : 207;
  res.status(status).json({ ok: results.errors.length === 0, ...results });
});

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
    conditions.push(`t.park_id = (
      SELECT id FROM parks
      WHERE id = $${params.length} OR LOWER(name) = LOWER($${params.length})
      LIMIT 1
    )`);
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
