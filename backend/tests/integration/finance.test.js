'use strict';
// ═══════════════════════════════════════════════════════════════
// Integration tests for /api/finance
//
// Covers: settlement workflow (submit → approve → dispute),
// tax rate endpoint, reconciliation summary,
// park scope isolation for Finance Head.
// ═══════════════════════════════════════════════════════════════

const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, saId;
let financeToken, financeId;
let authorityToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  await pool.query(`
    TRUNCATE refund_requests, settlement_periods, reconciliation_exceptions,
             finance_approvals, generated_reports RESTART IDENTITY CASCADE
  `);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa      = await loginAs(pool, 'Super Admin',    { email: 'sa.finance@test.com' });
  const finance = await loginAs(pool, 'Finance Head',   { email: 'fh.finance@test.com' });
  const auth    = await loginAs(pool, 'Authority User', { email: 'au.finance@test.com' });

  saToken = sa.token; saId = sa.id;
  financeToken = finance.token; financeId = finance.id;
  authorityToken = auth.token;

  // Seed GST rates
  await pool.query(`
    INSERT INTO gst_rates (category, cgst_pct, sgst_pct, effective_from)
    VALUES
      ('Entry',   5.00, 5.00, '2024-01-01'),
      ('default', 5.00, 5.00, '2024-01-01')
    ON CONFLICT DO NOTHING
  `);

  // Insert some tickets for TP001 to test computeSettlementExpected
  const today = new Date().toISOString().slice(0, 10);
  await pool.query(`
    INSERT INTO tickets
      (park_id, visitor_name, visit_date, amount, total_amount,
       payment_mode, cash_amount, status, source, created_by)
    VALUES
      ('TP001','Visitor A', $1, 1000, 1100, 'Cash',  1100, 'Confirmed', 'Counter', $2),
      ('TP001','Visitor B', $1,  500,  550, 'UPI',    550, 'Confirmed', 'Counter', $2),
      ('TP001','Visitor C', $1,  200,  220, 'Cash',   220, 'Cancelled', 'Counter', $2)
  `, [today, saId]);
});

afterAll(async () => { await pool.end(); });

// ── GET /api/finance/tax/rates ────────────────────────────────────────────────

describe('GET /api/finance/tax/rates', () => {
  test('401 without token', async () => {
    const r = await request(app).get('/api/finance/tax/rates');
    expect(r.status).toBe(401);
  });

  test('403 for Authority User', async () => {
    const r = await request(app).get('/api/finance/tax/rates')
      .set('Authorization', `Bearer ${authorityToken}`);
    expect(r.status).toBe(403);
  });

  test('200 Finance Head gets active rates', async () => {
    const r = await request(app).get('/api/finance/tax/rates')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body[0]).toHaveProperty('cgst_pct');
    expect(r.body[0]).toHaveProperty('sgst_pct');
  });

  test('200 rates filtered by as_of date', async () => {
    const r = await request(app).get('/api/finance/tax/rates?as_of=2025-01-01')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    // All seeded rates have effective_from <= 2025-01-01
    expect(r.body.length).toBeGreaterThan(0);
  });
});

// ── GET /api/finance/settlements ─────────────────────────────────────────────

describe('GET /api/finance/settlements', () => {
  test('401 without token', async () => {
    const r = await request(app).get('/api/finance/settlements');
    expect(r.status).toBe(401);
  });

  test('200 Finance Head can list settlements (empty)', async () => {
    const r = await request(app).get('/api/finance/settlements')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual([]);
    expect(r.body.total).toBe(0);
  });
});

// ── Settlement workflow: open → submit → approve → dispute ───────────────────

describe('Settlement workflow', () => {
  let settlementId;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const { rows: [sp] } = await pool.query(`
      INSERT INTO settlement_periods (park_id, period_date, status)
      VALUES ('TP001', $1, 'open') RETURNING id
    `, [today]);
    settlementId = sp.id;
  });

  test('200 Finance Head can submit settlement', async () => {
    const r = await request(app).post(`/api/finance/settlements/${settlementId}/submit`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ actual_rev: 1650, notes: 'Daily reconciliation' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('submitted');
    // expected_rev should be 1650 (1100 + 550 — Cancelled ticket excluded)
    expect(parseFloat(r.body.expected_rev)).toBe(1650);
    expect(parseFloat(r.body.actual_rev)).toBe(1650);
    expect(parseFloat(r.body.variance)).toBe(0);
  });

  test('409 cannot submit an already-submitted settlement', async () => {
    const r = await request(app).post(`/api/finance/settlements/${settlementId}/submit`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ actual_rev: 1650 });
    expect(r.status).toBe(409);
  });

  test('200 Super Admin can approve submitted settlement', async () => {
    const r = await request(app).post(`/api/finance/settlements/${settlementId}/approve`)
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
    expect(r.body.locked).toBe(true);
  });

  test('settlement appears in list after approval', async () => {
    const r = await request(app).get('/api/finance/settlements?status=approved')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(1);
    expect(r.body.data[0].status).toBe('approved');
    expect(r.body.data[0].locked).toBe(true);
  });

  test('200 Finance Head can dispute approved settlement', async () => {
    const r = await request(app).post(`/api/finance/settlements/${settlementId}/dispute`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ reason: 'Amount discrepancy found in cash register' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('disputed');
    expect(r.body.locked).toBe(false);
  });

  test('audit_log entries written for settlement workflow', async () => {
    const { rows } = await pool.query(
      `SELECT action FROM audit_log
        WHERE target_type = 'settlement_period' AND target_id = $1
        ORDER BY created_at`,
      [String(settlementId)],
    );
    const actions = rows.map(r => r.action);
    expect(actions).toContain('settlement.submit');
    expect(actions).toContain('settlement.approve');
    expect(actions).toContain('settlement.dispute');
  });
});

// ── GET /api/finance/reconciliation/summary ───────────────────────────────────

describe('GET /api/finance/reconciliation/summary', () => {
  const today = new Date().toISOString().slice(0, 10);

  test('400 if park_id or date missing', async () => {
    const r = await request(app).get('/api/finance/reconciliation/summary?park_id=TP001')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(400);
  });

  test('200 returns reconciliation data for park on date', async () => {
    const r = await request(app)
      .get(`/api/finance/reconciliation/summary?park_id=TP001&date=${today}`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.park_id).toBe('TP001'); // or numeric if integer parks
    // Expected rev = 1650 (TP001 confirmed non-reversal tickets for today)
    expect(parseFloat(r.body.expected.expected_rev)).toBe(1650);
    expect(r.body.expected.ticket_count).toBe(2); // Cancelled excluded
    expect(Array.isArray(r.body.exceptions)).toBe(true);
  });

  test('403 for Authority User', async () => {
    const r = await request(app)
      .get(`/api/finance/reconciliation/summary?park_id=TP001&date=${today}`)
      .set('Authorization', `Bearer ${authorityToken}`);
    expect(r.status).toBe(403);
  });
});

// ── Settlement lock: ticket creation blocked when period locked ───────────────

describe('settledPeriod middleware — blocks tickets on locked period', () => {
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    await pool.query(`
      INSERT INTO settlement_periods (park_id, period_date, status, locked)
      VALUES ('TP002', $1, 'approved', TRUE)
      ON CONFLICT (park_id, period_date) DO UPDATE SET locked = TRUE, status = 'approved'
    `, [today]);
  });

  test('423 when trying to create ticket for locked park+date', async () => {
    const cashier = await loginAs(pool, 'Cashier', { email: 'cs2.finance@test.com' });
    await assignUserPark(pool, cashier.id, 'TP002');

    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({
        ticket_id:       `LOCK${Date.now().toString(36).slice(-4).toUpperCase()}`,
        park_id:         'TP002',
        visitor_summary: { total_adults: 1, total_children: 0, total_toddlers: 0, total_seniors: 0 },
        price_map:       { adult: 500, child: 300, toddler: 200, senior: 400 },
        total_amount:    500,
        cash_amount:     500,
        upi_amount:      0,
        card_amount:     0,
        payment_mode:    'Cash',
        source:          'Counter',
        visit_date:      today,
      });
    expect(r.status).toBe(423);
    expect(r.body.error).toMatch(/locked/i);
  });

  test('unlocked park not blocked', async () => {
    // TP003 has no settlement record → should be open
    const cashier = await loginAs(pool, 'Cashier', { email: 'cs3.finance@test.com' });
    await assignUserPark(pool, cashier.id, 'TP003');

    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashier.token}`)
      .send({
        ticket_id:       `OPEN${Date.now().toString(36).slice(-4).toUpperCase()}`,
        park_id:         'TP003',
        visitor_summary: { total_adults: 1, total_children: 0, total_toddlers: 0, total_seniors: 0 },
        price_map:       { adult: 400, child: 250, toddler: 150, senior: 350 },
        total_amount:    400,
        cash_amount:     400,
        upi_amount:      0,
        card_amount:     0,
        payment_mode:    'Cash',
        source:          'Counter',
      });
    // 201 or possibly 400 for missing fields — either way NOT 423
    expect(r.status).not.toBe(423);
  });
});
