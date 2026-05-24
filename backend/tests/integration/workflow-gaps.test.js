'use strict';
// ═══════════════════════════════════════════════════════════════
// Integration tests for Business Workflow Gap Remediation
//
// Covers:
//  1. Finance Head parks.view (P1 fix — migration 013)
//  2. POST /api/finance/settlements — settlement period creation
//  3. PATCH /api/finance/reconciliation/exceptions/:id/resolve
//  4. PUT  /api/tickets/:id/cancel
//  5. Park Manager finance permissions (P3 fix — migration 013)
//  6. Cashier tickets.cancel (migration 013)
// ═══════════════════════════════════════════════════════════════

const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS }   = require('../fixtures/seeds');

let pool, app;

// Role tokens
let saToken;
let caToken;
let fhToken,  fhId;
let pmToken,  pmId;
let cashierToken, cashierId;
let auToken;

const TODAY = new Date().toISOString().slice(0, 10);
const PARK  = 'TP001';

async function seedGst(pool) {
  await pool.query(`
    INSERT INTO gst_rates (category, cgst_pct, sgst_pct, effective_from)
    VALUES ('Entry', 5.00, 5.00, '2024-01-01')
    ON CONFLICT DO NOTHING
  `);
}

async function seedTicket(pool, ticketId, userId) {
  await pool.query(`
    INSERT INTO tickets
      (ticket_id, transaction_id, park_id, age_category, quantity,
       amount, cgst_amount, sgst_amount, total_amount,
       cash_amount, upi_amount, card_amount,
       payment_mode, status, source, cashier_id, gst_rate_id)
    VALUES
      ($1, $1, $2, 'Adult', 1,
       100, 5, 5, 110,
       110, 0, 0,
       'Cash', 'Completed', 'Counter', $3,
       (SELECT id FROM gst_rates WHERE category='Entry' LIMIT 1))
    ON CONFLICT (ticket_id, age_category) DO NOTHING
  `, [ticketId, PARK, userId]);
}

async function seedSettlement(pool, { park_id = PARK, period_date = TODAY, status = 'open' } = {}) {
  const { rows } = await pool.query(`
    INSERT INTO settlement_periods (park_id, period_date, status)
    VALUES ($1, $2, $3)
    ON CONFLICT (park_id, period_date) DO UPDATE SET status = EXCLUDED.status
    RETURNING id
  `, [park_id, period_date, status]);
  return rows[0].id;
}

async function seedException(pool, { settlementId, ticketId = null, resolved = false } = {}) {
  const { rows } = await pool.query(`
    INSERT INTO reconciliation_exceptions
      (settlement_id, exception_type, severity, expected_amt, actual_amt, variance, ticket_id, resolved)
    VALUES ($1, 'amount_mismatch', 'medium', 110, 100, -10, $2, $3)
    RETURNING id
  `, [settlementId, ticketId, resolved]);
  return rows[0].id;
}

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);
  await seedGst(pool);

  const sa      = await loginAs(pool, 'Super Admin',      { email: 'sa.wg@test.com' });
  const ca      = await loginAs(pool, 'Corporate Admin',  { email: 'ca.wg@test.com' });
  const fh      = await loginAs(pool, 'Finance Head',     { email: 'fh.wg@test.com' });
  const pm      = await loginAs(pool, 'Park Manager',     { email: 'pm.wg@test.com' });
  const cashier = await loginAs(pool, 'Cashier',          { email: 'cs.wg@test.com' });
  const au      = await loginAs(pool, 'Authority User',   { email: 'au.wg@test.com' });

  saToken       = sa.token;
  caToken       = ca.token;
  fhToken       = fh.token;  fhId       = fh.id;
  pmToken       = pm.token;  pmId       = pm.id;
  cashierToken  = cashier.token; cashierId = cashier.id;
  auToken       = au.token;

  // Assign Park Manager and Cashier to TP001
  await assignUserPark(pool, pmId,      PARK);
  await assignUserPark(pool, cashierId, PARK);
});

afterAll(async () => { await pool.end(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Finance Head parks.view (P1 — critical bug fix)
// ─────────────────────────────────────────────────────────────────────────────

describe('P1 — Finance Head: parks.view', () => {
  it('Finance Head can GET /api/parks (no longer 403)', async () => {
    const res = await request(app)
      .get('/api/parks')
      .set('Authorization', `Bearer ${fhToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('Authority User cannot GET /api/parks', async () => {
    const res = await request(app)
      .get('/api/parks')
      .set('Authorization', `Bearer ${auToken}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Settlement Period Creation (POST /api/finance/settlements)
// ─────────────────────────────────────────────────────────────────────────────

describe('Settlement Period Creation', () => {
  const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  it('Finance Head can create a settlement period', async () => {
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${fhToken}`)
      .send({ park_id: PARK, period_date: YESTERDAY, notes: 'test' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ park_id: PARK, period_date: YESTERDAY, status: 'open' });
  });

  it('Returns 409 on duplicate (same park + date)', async () => {
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${fhToken}`)
      .send({ park_id: PARK, period_date: YESTERDAY });
    expect(res.status).toBe(409);
  });

  it('Park Manager (scoped) can create a settlement period for their park', async () => {
    const date2 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: PARK, period_date: date2 });
    expect(res.status).toBe(201);
  });

  it('Park Manager cannot create a period for a park outside their scope', async () => {
    const date3 = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'TP002', period_date: date3 });
    expect(res.status).toBe(403);
  });

  it('Returns 400 on missing period_date', async () => {
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${fhToken}`)
      .send({ park_id: PARK });
    expect(res.status).toBe(400);
  });

  it('Returns 400 on invalid date format', async () => {
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${fhToken}`)
      .send({ park_id: PARK, period_date: '22-05-2026' });
    expect(res.status).toBe(400);
  });

  it('Authority User cannot create a settlement period (403)', async () => {
    const date4 = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post('/api/finance/settlements')
      .set('Authorization', `Bearer ${auToken}`)
      .send({ park_id: PARK, period_date: date4 });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Reconciliation Exception Resolve
// ─────────────────────────────────────────────────────────────────────────────

describe('Reconciliation Exception Resolve', () => {
  let settlementId, exceptionId;

  beforeEach(async () => {
    // Use a unique date to avoid conflicts with other tests
    const date = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    settlementId = await seedSettlement(pool, { period_date: date });
    exceptionId  = await seedException(pool, { settlementId });
  });

  it('Finance Head can resolve an exception', async () => {
    const res = await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${exceptionId}/resolve`)
      .set('Authorization', `Bearer ${fhToken}`)
      .send({ notes: 'Verified manually' });
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.resolved_by).toBe(fhId);
  });

  it('Returns 409 when exception is already resolved', async () => {
    // Resolve first
    await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${exceptionId}/resolve`)
      .set('Authorization', `Bearer ${fhToken}`);

    // Try again
    const res = await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${exceptionId}/resolve`)
      .set('Authorization', `Bearer ${fhToken}`);
    expect(res.status).toBe(409);
  });

  it('Returns 404 for nonexistent exception', async () => {
    const res = await request(app)
      .patch('/api/finance/reconciliation/exceptions/999999/resolve')
      .set('Authorization', `Bearer ${fhToken}`);
    expect(res.status).toBe(404);
  });

  it('Park Manager can resolve exceptions in their park', async () => {
    const date = new Date(Date.now() - 11 * 86400000).toISOString().slice(0, 10);
    const spId  = await seedSettlement(pool, { period_date: date });
    const excId = await seedException(pool, { settlementId: spId });

    const res = await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${excId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(res.status).toBe(200);
  });

  it('Park Manager cannot resolve exceptions outside their scope', async () => {
    const date = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);
    const spId  = await seedSettlement(pool, { park_id: 'TP002', period_date: date });
    const excId = await seedException(pool, { settlementId: spId });

    const res = await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${excId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('Authority User cannot resolve exceptions (403)', async () => {
    const date = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const spId  = await seedSettlement(pool, { period_date: date });
    const excId = await seedException(pool, { settlementId: spId });

    const res = await request(app)
      .patch(`/api/finance/reconciliation/exceptions/${excId}/resolve`)
      .set('Authorization', `Bearer ${auToken}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ticket Cancellation (PUT /api/tickets/:id/cancel)
// ─────────────────────────────────────────────────────────────────────────────

describe('Ticket Cancellation', () => {
  let ticketId;

  beforeEach(async () => {
    ticketId = `TK-WG-${Date.now()}`;
    await seedTicket(pool, ticketId, cashierId);
  });

  it('Cashier can cancel a ticket in their park', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/cancel`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.rows_cancelled).toBeGreaterThan(0);
  });

  it('Park Manager can cancel a ticket in their park', async () => {
    const tid = `TK-WG-PM-${Date.now()}`;
    await seedTicket(pool, tid, pmId);

    const res = await request(app)
      .put(`/api/tickets/${tid}/cancel`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({});
    expect(res.status).toBe(200);
  });

  it('Returns 409 when cancelling an already-cancelled ticket', async () => {
    // Cancel once
    await request(app)
      .put(`/api/tickets/${ticketId}/cancel`)
      .set('Authorization', `Bearer ${cashierToken}`);

    // Second cancel
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/cancel`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(409);
  });

  it('Returns 404 for nonexistent ticket', async () => {
    const res = await request(app)
      .put('/api/tickets/TK-NOTEXIST/cancel')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(404);
  });

  it('Finance Head cannot cancel a ticket (no tickets.cancel perm)', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/cancel`)
      .set('Authorization', `Bearer ${fhToken}`);
    expect(res.status).toBe(403);
  });

  it('Audit log entry written after cancellation', async () => {
    const tid = `TK-WG-AUDIT-${Date.now()}`;
    await seedTicket(pool, tid, cashierId);

    await request(app)
      .put(`/api/tickets/${tid}/cancel`)
      .set('Authorization', `Bearer ${cashierToken}`);

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'ticket.cancel' AND resource_id = $1`,
      [tid]
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('Unauthenticated request returns 401', async () => {
    const res = await request(app)
      .put(`/api/tickets/${ticketId}/cancel`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Park Manager finance permissions (P3 — migration 013)
// ─────────────────────────────────────────────────────────────────────────────

describe('P3 — Park Manager finance permissions', () => {
  it('Park Manager can GET /api/finance/settlements', async () => {
    const res = await request(app)
      .get('/api/finance/settlements')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(200);
  });

  it('Park Manager can GET /api/finance/refunds', async () => {
    const res = await request(app)
      .get('/api/finance/refunds')
      .set('Authorization', `Bearer ${pmToken}`);
    expect([200, 404]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Unauthenticated / cross-role access guards
// ─────────────────────────────────────────────────────────────────────────────

describe('Auth guards on new endpoints', () => {
  it('POST /api/finance/settlements — 401 without token', async () => {
    const res = await request(app)
      .post('/api/finance/settlements')
      .send({ park_id: PARK, period_date: TODAY });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/finance/reconciliation/exceptions/1/resolve — 401 without token', async () => {
    const res = await request(app)
      .patch('/api/finance/reconciliation/exceptions/1/resolve');
    expect(res.status).toBe(401);
  });

  it('PUT /api/tickets/TK-X/cancel — 401 without token', async () => {
    const res = await request(app)
      .put('/api/tickets/TK-X/cancel');
    expect(res.status).toBe(401);
  });
});
