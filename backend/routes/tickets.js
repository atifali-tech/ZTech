'use strict';
// ═══════════════════════════════════════════════════════════════
// Tickets API
// Base path: /api/tickets
//
// POST /api/tickets        — create one booking (multi-age-category)
// POST /api/tickets/batch  — create multiple bookings (offline sync)
// GET  /api/tickets        — paginated, filterable list
// ═══════════════════════════════════════════════════════════════
const express           = require('express');
const router            = express.Router();
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const settledPeriod     = require('../middleware/settledPeriod');

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PAYMENT_MODES = new Set(['Cash', 'UPI', 'Card', 'Split']);
const VALID_SOURCES       = new Set(['App', 'Counter', 'Web']);
const VALID_STATUSES      = new Set(['Confirmed', 'Completed', 'Cancelled']);

// Maps visitor_summary keys → DB age_category values
const VISITOR_KEY_MAP = {
  total_adults:   'Adult',
  total_children: 'Child',
  total_toddlers: 'Toddler',
  total_seniors:  'Senior Citizen',
};

// Maps price_map keys → DB age_category values
const PRICE_KEY_MAP = {
  adult:   'Adult',
  child:   'Child',
  toddler: 'Toddler',
  senior:  'Senior Citizen',
};


// ─── Validation ───────────────────────────────────────────────────────────────

function validateBooking(t) {
  const errors = [];

  if (!t.ticket_id)
    errors.push('ticket_id: required');
  // park_id is VARCHAR(10) — e.g. "ZP001". Accept any non-empty string.
  if (!t.park_id || typeof t.park_id !== 'string' || !t.park_id.trim())
    errors.push('park_id: required');

  const vs = t.visitor_summary;
  if (!vs || typeof vs !== 'object')
    errors.push('visitor_summary: required object');
  else {
    const total = Object.values(vs).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total === 0) errors.push('visitor_summary: at least one visitor required');
  }

  const pm = t.price_map;
  if (!pm || typeof pm !== 'object')
    errors.push('price_map: required object');

  if (t.total_amount == null || isNaN(Number(t.total_amount)) || Number(t.total_amount) < 0)
    errors.push('total_amount: required, non-negative number');

  if (!VALID_PAYMENT_MODES.has(t.payment_mode))
    errors.push(`payment_mode: must be one of ${[...VALID_PAYMENT_MODES].join(', ')}`);

  if (!VALID_SOURCES.has(t.source))
    errors.push(`source: must be one of ${[...VALID_SOURCES].join(', ')}`);

  if (t.status && !VALID_STATUSES.has(t.status))
    errors.push(`status: must be one of ${[...VALID_STATUSES].join(', ')}`);

  // Validate payment split sums to total
  if (!errors.length) {
    const cash = Number(t.cash_amount) || 0;
    const upi  = Number(t.upi_amount)  || 0;
    const card = Number(t.card_amount) || 0;
    const sum  = Math.round((cash + upi + card) * 100);
    const tot  = Math.round(Number(t.total_amount) * 100);
    if (sum !== tot)
      errors.push(`cash_amount + upi_amount + card_amount (${cash + upi + card}) must equal total_amount (${t.total_amount})`);
  }

  return errors;
}

// ─── GST rate lookup (cached per process, refreshed every 10 min) ─────────────

let _gstCache = null;
let _gstCachedAt = 0;

async function getEntryGstRate(pool) {
  const now = Date.now();
  if (_gstCache && now - _gstCachedAt < 10 * 60 * 1000) return _gstCache;

  const { rows } = await pool.query(`
    SELECT id, cgst_pct, sgst_pct
      FROM gst_rates
     WHERE category IN ('Entry', 'default')
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY CASE category WHEN 'Entry' THEN 0 ELSE 1 END, effective_from DESC
     LIMIT 1
  `);

  _gstCache = rows[0] ? {
    id:      rows[0].id,
    cgstPct: parseFloat(rows[0].cgst_pct),
    sgstPct: parseFloat(rows[0].sgst_pct),
  } : { id: null, cgstPct: 0, sgstPct: 0 };

  _gstCachedAt = now;
  return _gstCache;
}

// ─── Expansion: one booking → multiple ticket rows ────────────────────────────

function expandBooking(t, gstRate) {
  const rows      = [];
  const priceMap  = t.price_map  || {};
  const vs        = t.visitor_summary || {};
  const status    = t.status || 'Completed';
  const transId   = t.transaction_id || t.ticket_id;
  const cgstPct   = gstRate?.cgstPct ?? 0;
  const sgstPct   = gstRate?.sgstPct ?? 0;
  const gstRateId = gstRate?.id ?? null;

  // Build line items for non-zero visitor categories
  const lines = [];
  for (const [vsKey, ageCategory] of Object.entries(VISITOR_KEY_MAP)) {
    const qty = parseInt(vs[vsKey]) || 0;
    if (qty === 0) continue;

    // Find unit price — try matching price_map key
    const priceKey  = Object.keys(PRICE_KEY_MAP).find(k => PRICE_KEY_MAP[k] === ageCategory);
    const unitPrice = Number(priceMap[priceKey]) || 0;
    const lineTotal = unitPrice * qty;

    lines.push({ ageCategory, qty, unitPrice, lineTotal });
  }

  const grandTotal = lines.reduce((s, l) => s + l.lineTotal, 0) || Number(t.total_amount);
  const cash = Number(t.cash_amount) || 0;
  const upi  = Number(t.upi_amount)  || 0;
  const card = Number(t.card_amount) || 0;

  // Distribute payment amounts proportionally by line total.
  // Last row absorbs rounding remainder to ensure totals match exactly.
  let cashLeft = cash, upiLeft = upi, cardLeft = card;

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    const ratio  = grandTotal > 0 ? line.lineTotal / grandTotal : 1 / lines.length;

    const lineCash = isLast ? Math.round(cashLeft * 100) / 100 : Math.round(cash * ratio * 100) / 100;
    const lineUpi  = isLast ? Math.round(upiLeft  * 100) / 100 : Math.round(upi  * ratio * 100) / 100;
    const lineCard = isLast ? Math.round(cardLeft  * 100) / 100 : Math.round(card * ratio * 100) / 100;

    cashLeft -= lineCash;
    upiLeft  -= lineUpi;
    cardLeft -= lineCard;

    const cgst  = Math.round(line.lineTotal * cgstPct) / 100;
    const sgst  = Math.round(line.lineTotal * sgstPct) / 100;
    const total = Math.round((line.lineTotal + cgst + sgst) * 100) / 100;

    rows.push({
      ticket_id:      t.ticket_id,
      transaction_id: transId,
      park_id:        t.park_id,
      age_category:   line.ageCategory,
      quantity:       line.qty,
      amount:         line.lineTotal,
      cgst_amount:    cgst,
      sgst_amount:    sgst,
      total_amount:   total,
      cash_amount:    lineCash,
      upi_amount:     lineUpi,
      card_amount:    lineCard,
      payment_mode:   t.payment_mode,
      status,
      source:         t.source,
      cashier_id:     t.cashier_id   || null,
      device_id:      t.device_id    || null,
      gender:         t.gender       || null,
      created_at:     t.created_at   || null,
      gst_rate_id:    gstRateId,
    });
  });

  return rows;
}

// ─── DB insert (single expanded row) ─────────────────────────────────────────

async function insertRow(pool, r) {
  const { rows } = await pool.query(`
    INSERT INTO tickets (
      ticket_id, transaction_id, park_id, age_category, quantity,
      amount, cgst_amount, sgst_amount, total_amount,
      cash_amount, upi_amount, card_amount,
      payment_mode, status, source,
      cashier_id, device_id, gender, created_at, gst_rate_id
    ) VALUES (
      $1,  $2,  $3,  $4,  $5,
      $6,  $7,  $8,  $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18,
      COALESCE($19::timestamptz, NOW()), $20
    )
    ON CONFLICT (ticket_id, age_category) DO NOTHING
    RETURNING ticket_id, age_category, quantity, total_amount, created_at
  `, [
    r.ticket_id, r.transaction_id, r.park_id, r.age_category, r.quantity,
    r.amount, r.cgst_amount, r.sgst_amount, r.total_amount,
    r.cash_amount, r.upi_amount, r.card_amount,
    r.payment_mode, r.status, r.source,
    r.cashier_id, r.device_id, r.gender,
    r.created_at, r.gst_rate_id,
  ]);
  return rows[0] || null; // null = duplicate, silently skipped
}

// ─── POST /api/tickets ────────────────────────────────────────────────────────

router.post('/', [...requirePermission('tickets.create'), parkScope, settledPeriod], async (req, res) => {
  const pool = req.app.locals.pool;
  const t    = req.body;

  if (!t || typeof t !== 'object' || Array.isArray(t))
    return res.status(400).json({ error: 'Body must be a JSON object' });

  const errors = validateBooking(t);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  // Park scope: ensure the authenticated user may write to this park
  if (req.scopedParkIds !== null && !req.scopedParkIds.includes(t.park_id)) {
    return res.status(403).json({ error: 'Access denied: park not in your scope' });
  }

  // Stamp the authenticated user as cashier — prevents ID forgery
  t.cashier_id = req.user.id;

  try {
    const gstRate = await getEntryGstRate(pool);
    const rows = expandBooking(t, gstRate);
    if (rows.length === 0)
      return res.status(400).json({ error: 'visitor_summary has no visitors' });

    const inserted = [];
    const skipped  = [];

    for (const row of rows) {
      const result = await insertRow(pool, row);
      result ? inserted.push(result) : skipped.push(row.ticket_id);
    }

    if (inserted.length === 0 && skipped.length > 0)
      return res.status(409).json({ error: 'All ticket IDs already exist', skipped });

    res.status(201).json({
      ok:             true,
      transaction_id: t.transaction_id || t.ticket_id,
      inserted:       inserted.length,
      skipped:        skipped.length,
      tickets:        inserted,
    });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'park_id does not exist' });
    console.error('[POST /tickets]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/tickets/batch ──────────────────────────────────────────────────

router.post('/batch', [...requirePermission('tickets.create'), parkScope], async (req, res) => {
  const pool     = req.app.locals.pool;
  const bookings = req.body;

  if (!Array.isArray(bookings) || bookings.length === 0)
    return res.status(400).json({ error: 'Body must be a non-empty array of bookings' });
  if (bookings.length > 500)
    return res.status(400).json({ error: 'Batch limit is 500 bookings per request' });

  const scopedSet = req.scopedParkIds !== null ? new Set(req.scopedParkIds) : null;
  const results   = { inserted: 0, skipped: 0, errors: [] };
  const gstRate   = await getEntryGstRate(pool);

  for (let i = 0; i < bookings.length; i++) {
    const t      = bookings[i];
    const errors = validateBooking(t);
    if (errors.length) {
      results.errors.push({ index: i, ticket_id: t.ticket_id, details: errors });
      continue;
    }

    // Park scope enforcement per booking
    if (scopedSet && !scopedSet.has(t.park_id)) {
      results.errors.push({ index: i, ticket_id: t.ticket_id, error: 'Access denied: park not in your scope' });
      continue;
    }

    // Stamp authenticated user as cashier
    t.cashier_id = req.user.id;

    const rows = expandBooking(t, gstRate);
    for (const row of rows) {
      try {
        const result = await insertRow(pool, row);
        result ? results.inserted++ : results.skipped++;
      } catch (err) {
        results.errors.push({ index: i, ticket_id: row.ticket_id, error: err.message });
      }
    }
  }

  const status = results.errors.length > 0 && results.inserted === 0 ? 400 : 207;
  res.status(status).json({ ok: results.errors.length === 0, ...results });
});

// ─── GET /api/tickets ─────────────────────────────────────────────────────────

const ALLOWED_SORT_COLS = new Set([
  'created_at', 'ticket_id', 'park_name', 'age_category',
  'quantity', 'total_amount', 'payment_mode', 'status',
]);

router.get('/', [requirePermission('tickets.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
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

  // Park-level access scope — restrict to user's assigned parks
  if (req.scopedParkIds !== null) {
    if (req.scopedParkIds.length === 0) {
      conditions.push('1 = 0');
    } else {
      const phs = req.scopedParkIds.map((_, i) => `$${params.length + i + 1}`).join(', ');
      conditions.push(`t.park_id IN (${phs})`);
      params.push(...req.scopedParkIds);
    }
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.ticket_id ILIKE $${params.length} OR t.transaction_id ILIKE $${params.length})`);
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
          t.ticket_id, t.transaction_id, t.created_at,
          p.name          AS park_name,
          t.age_category, t.quantity,
          t.amount,       t.cgst_amount, t.sgst_amount, t.total_amount,
          t.cash_amount,  t.upi_amount,  t.card_amount,
          t.payment_mode, t.status,      t.source,
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
        FROM   tickets t JOIN parks p ON p.id = t.park_id
        WHERE  ${where}
      `, params),

      pool.query(`
        SELECT
          COUNT(*)::int                        AS matched_count,
          COALESCE(SUM(t.total_amount), 0)     AS matched_revenue
        FROM   tickets t JOIN parks p ON p.id = t.park_id
        WHERE  ${where}
      `, params),
    ]);

    res.json({
      pagination: {
        page, limit,
        total:      countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
      summary: {
        count:   summaryResult.rows[0].matched_count,
        revenue: parseFloat(summaryResult.rows[0].matched_revenue),
      },
      tickets: dataResult.rows.map(r => ({
        ticketId:       r.ticket_id,
        transactionId:  r.transaction_id,
        createdAt:      r.created_at,
        park:           r.park_name,
        ageCategory:    r.age_category,
        quantity:       parseInt(r.quantity),
        amount:         parseFloat(r.amount),
        cgstAmount:     parseFloat(r.cgst_amount),
        sgstAmount:     parseFloat(r.sgst_amount),
        total:          parseFloat(r.total_amount),
        cashAmount:     parseFloat(r.cash_amount),
        upiAmount:      parseFloat(r.upi_amount),
        cardAmount:     parseFloat(r.card_amount),
        paymentMode:    r.payment_mode,
        status:         r.status,
        source:         r.source,
        cashier:        r.cashier_name || '—',
      })),
    });
  } catch (err) {
    console.error('[GET /tickets]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
