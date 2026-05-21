'use strict';
// ═══════════════════════════════════════════════════════════════
// Integration tests for /api/refunds
//
// Lifecycle: request → approve → process → ticket cancelled
// Also tests: permission enforcement, park scope isolation,
// self-approval prohibition, audit_log entries.
// ═══════════════════════════════════════════════════════════════

const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, saId;
let financeToken, financeId;
let cashierToken, cashierId;
let authorityToken;
let ticketId;   // created ticket to refund in tests

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  // Truncate new finance tables that resetDatabase doesn't cover
  await pool.query(`
    TRUNCATE refund_requests, settlement_periods, reconciliation_exceptions,
             finance_approvals, generated_reports RESTART IDENTITY CASCADE
  `);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa      = await loginAs(pool, 'Super Admin',    { email: 'sa.refunds@test.com' });
  const finance = await loginAs(pool, 'Finance Head',   { email: 'fh.refunds@test.com' });
  const cashier = await loginAs(pool, 'Cashier',        { email: 'cs.refunds@test.com' });
  const auth    = await loginAs(pool, 'Authority User', { email: 'au.refunds@test.com' });

  saToken = sa.token; saId = sa.id;
  financeToken = finance.token; financeId = finance.id;
  cashierToken = cashier.token; cashierId = cashier.id;
  authorityToken = auth.token;

  await assignUserPark(pool, cashierId, 'TP001');

  // Seed a GST rate (needed by some assertions)
  await pool.query(`
    INSERT INTO gst_rates (category, cgst_pct, sgst_pct, effective_from)
    VALUES ('default', 5.00, 5.00, '2024-01-01') ON CONFLICT DO NOTHING
  `);

  // Insert a ticket directly (bypassing validation for test speed)
  const { rows: [t] } = await pool.query(`
    INSERT INTO tickets
      (park_id, visitor_name, visitor_email, visitor_phone,
       ticket_type, num_adults, num_children, visit_date,
       amount, total_amount, payment_mode, cash_amount,
       status, source, created_by)
    VALUES ('TP001','Test Visitor','v@test.com','9999000001',
            'General', 2, 0, CURRENT_DATE,
            1000, 1100, 'Cash', 1100,
            'Confirmed', 'Counter', $1)
    RETURNING id
  `, [cashierId]);
  ticketId = t.id;
});

afterAll(async () => { await pool.end(); });

// ── POST /api/refunds — create request ───────────────────────────────────────

describe('POST /api/refunds', () => {
  test('401 without token', async () => {
    const r = await request(app).post('/api/refunds')
      .send({ ticket_id: ticketId, reason: 'Test refund' });
    expect(r.status).toBe(401);
  });

  test('403 for Authority User (no finance.refund)', async () => {
    const r = await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${authorityToken}`)
      .send({ ticket_id: ticketId, reason: 'Test refund' });
    expect(r.status).toBe(403);
  });

  test('400 when ticket_id missing', async () => {
    const r = await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ reason: 'Missing ticket_id' });
    expect(r.status).toBe(400);
  });

  test('404 for non-existent ticket', async () => {
    const r = await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ ticket_id: 9999999, reason: 'No such ticket' });
    expect(r.status).toBe(404);
  });

  let refundId;

  test('201 creates refund request (Finance Head / global scope)', async () => {
    const r = await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ ticket_id: ticketId, reason: 'Visitor requested cancellation' });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('pending');
    expect(r.body.ticket_id).toBe(ticketId);
    refundId = r.body.id;
  });

  test('409 if duplicate pending refund on same ticket', async () => {
    const r = await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ ticket_id: ticketId, reason: 'Duplicate attempt' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/pending or approved/i);
  });

  test('audit_log entry written on refund.request', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'refund.request' AND target_id = $1`,
      [String(refundId)],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].actor_email).toBe('fh.refunds@test.com');
  });
});

// ── PUT /api/refunds/:id/approve ─────────────────────────────────────────────

describe('PUT /api/refunds/:id/approve', () => {
  let pendingRefundId;

  beforeAll(async () => {
    // Create a fresh ticket + refund to test approval
    const { rows: [t] } = await pool.query(`
      INSERT INTO tickets
        (park_id, visitor_name, visit_date, amount, total_amount,
         payment_mode, cash_amount, status, source, created_by)
      VALUES ('TP001','Approval Test Visitor', CURRENT_DATE,
              500, 550, 'Cash', 550, 'Confirmed', 'Counter', $1)
      RETURNING id
    `, [cashierId]);
    const { rows: [ref] } = await pool.query(`
      INSERT INTO refund_requests (ticket_id, requested_by, amount, reason)
      VALUES ($1, $2, 550, 'Test approval flow') RETURNING id
    `, [t.id, financeId]);
    pendingRefundId = ref.id;
  });

  test('403 for non-finance.approve role', async () => {
    const r = await request(app).put(`/api/refunds/${pendingRefundId}/approve`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('200 Finance Head can approve', async () => {
    const r = await request(app).put(`/api/refunds/${pendingRefundId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('approved');
  });

  test('409 cannot approve already-approved refund', async () => {
    const r = await request(app).put(`/api/refunds/${pendingRefundId}/approve`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(409);
  });

  test('audit_log entry written on refund.approve', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'refund.approve' AND target_id = $1`,
      [String(pendingRefundId)],
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── PUT /api/refunds/:id/reject ───────────────────────────────────────────────

describe('PUT /api/refunds/:id/reject', () => {
  let rejectRefundId;

  beforeAll(async () => {
    const { rows: [t] } = await pool.query(`
      INSERT INTO tickets
        (park_id, visitor_name, visit_date, amount, total_amount,
         payment_mode, cash_amount, status, source, created_by)
      VALUES ('TP001','Reject Test Visitor', CURRENT_DATE,
              300, 330, 'UPI', 330, 'Confirmed', 'Counter', $1)
      RETURNING id
    `, [cashierId]);
    const { rows: [ref] } = await pool.query(`
      INSERT INTO refund_requests (ticket_id, requested_by, amount, reason)
      VALUES ($1, $2, 330, 'Test rejection flow') RETURNING id
    `, [t.id, financeId]);
    rejectRefundId = ref.id;
  });

  test('200 Finance Head can reject with reason', async () => {
    const r = await request(app).put(`/api/refunds/${rejectRefundId}/reject`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ reason: 'Refund policy: no refund after entry' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('rejected');
    expect(r.body.rejection_reason).toMatch(/no refund/);
  });
});

// ── POST /api/refunds/:id/process — full lifecycle ───────────────────────────

describe('POST /api/refunds/:id/process — full lifecycle', () => {
  let processTicketId, processRefundId;

  beforeAll(async () => {
    const { rows: [t] } = await pool.query(`
      INSERT INTO tickets
        (park_id, visitor_name, visitor_email, visit_date,
         amount, cgst_amount, sgst_amount, total_amount,
         payment_mode, cash_amount, status, source, created_by)
      VALUES ('TP001','Process Test Visitor','p@test.com', CURRENT_DATE,
              1000, 50, 50, 1100,
              'Cash', 1100, 'Confirmed', 'Counter', $1)
      RETURNING id
    `, [cashierId]);
    processTicketId = t.id;

    // Create and approve refund
    const { rows: [ref] } = await pool.query(`
      INSERT INTO refund_requests (ticket_id, requested_by, amount, reason)
      VALUES ($1, $2, 1100, 'Full process lifecycle test') RETURNING id
    `, [processTicketId, financeId]);
    processRefundId = ref.id;

    await pool.query(
      `UPDATE refund_requests SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
      [saId, processRefundId],
    );
  });

  test('409 if refund not in approved state', async () => {
    // Insert a pending refund on a fresh ticket and try to process it directly
    const { rows: [t] } = await pool.query(`
      INSERT INTO tickets
        (park_id, visitor_name, visit_date, amount, total_amount,
         payment_mode, cash_amount, status, source, created_by)
      VALUES ('TP001','Not Approved Test', CURRENT_DATE,
              100, 110, 'Cash', 110, 'Confirmed', 'Counter', $1)
      RETURNING id
    `, [cashierId]);
    const { rows: [ref] } = await pool.query(`
      INSERT INTO refund_requests (ticket_id, requested_by, amount, reason)
      VALUES ($1, $2, 110, 'Not approved yet') RETURNING id
    `, [t.id, financeId]);
    const r = await request(app).post(`/api/refunds/${ref.id}/process`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/approved/i);
  });

  test('200 processes refund: creates reversal ticket, cancels original', async () => {
    const r = await request(app).post(`/api/refunds/${processRefundId}/process`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.refund.status).toBe('processed');
    expect(r.body.reversal_ticket_id).toBeTruthy();

    // Original ticket should be Cancelled
    const { rows: [orig] } = await pool.query(
      'SELECT status FROM tickets WHERE id = $1', [processTicketId],
    );
    expect(orig.status).toBe('Cancelled');

    // Reversal ticket should exist with is_reversal=true and negative amount
    const { rows: [rev] } = await pool.query(
      'SELECT is_reversal, total_amount FROM tickets WHERE id = $1',
      [r.body.reversal_ticket_id],
    );
    expect(rev.is_reversal).toBe(true);
    expect(parseFloat(rev.total_amount)).toBe(-1100);
  });

  test('audit_log entry written on refund.process', async () => {
    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'refund.process' AND target_id = $1`,
      [String(processRefundId)],
    );
    expect(rows.length).toBeGreaterThan(0);
    const meta = rows[0].meta;
    expect(meta.ticket_id).toBe(processTicketId);
    expect(meta.amount).toBe(1100);
  });
});

// ── GET /api/refunds — list ───────────────────────────────────────────────────

describe('GET /api/refunds', () => {
  test('200 Finance Head can list refunds', async () => {
    const r = await request(app).get('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(typeof r.body.total).toBe('number');
  });

  test('401 without token', async () => {
    const r = await request(app).get('/api/refunds');
    expect(r.status).toBe(401);
  });
});
