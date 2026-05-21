'use strict';
/**
 * park-scoping.test.js — validates that row-level park access is enforced
 * for all scoped roles (Park Manager, Cashier) and cannot be bypassed by
 * supplying out-of-scope park names or IDs in query parameters.
 */
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { seedTickets } = require('../utils/testHelpers');
const { PARKS, makeTicket } = require('../fixtures/seeds');

let pool, app;

// Users
let saToken;
let pmToken, pmId;
let cashierToken, cashierId;
let unassignedCashierToken, unassignedCashierId;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa               = await loginAs(pool, 'Super Admin',  { email: 'sa.scope@test.com' });
  const pm               = await loginAs(pool, 'Park Manager', { email: 'pm.scope@test.com' });
  const cashier          = await loginAs(pool, 'Cashier',      { email: 'cs.scope@test.com' });
  const unassignedCashier= await loginAs(pool, 'Cashier',      { email: 'cs.unassigned@test.com' });

  saToken               = sa.token;
  pmToken               = pm.token; pmId = pm.id;
  cashierToken          = cashier.token; cashierId = cashier.id;
  unassignedCashierToken= unassignedCashier.token; unassignedCashierId = unassignedCashier.id;

  // PM → TP001 only
  await assignUserPark(pool, pmId, 'TP001');
  // Cashier → TP001 only
  await assignUserPark(pool, cashierId, 'TP001');
  // unassignedCashier → no parks

  // Seed tickets: 3 for TP001, 2 for TP002
  await seedTickets(pool, { parkId: 'TP001', count: 3, totalAmount: 500 });
  await seedTickets(pool, { parkId: 'TP002', count: 2, totalAmount: 800 });
});

afterAll(async () => { await pool.end(); });

// ── KPIs scoping ─────────────────────────────────────────────────────────────
// KPIs response shape: { totalVisitors, totalRevenue, totalTickets, ... }
describe('GET /api/dashboard/kpis — park scoping', () => {
  test('Super Admin sees data from all parks combined', async () => {
    const r = await request(app).get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    // SA sees all 5 tickets across both parks
    expect(r.body.totalVisitors).toBeGreaterThanOrEqual(5);
  });

  test('Park Manager only sees TP001 data (not TP002)', async () => {
    const r = await request(app).get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    // PM sees only TP001's 3 tickets — total_visitors comes from quantity (1 each)
    expect(r.body.totalVisitors).toBe(3);
  });

  test('Park Manager cannot bypass scope by requesting TP002 by name', async () => {
    // Send the park name for TP002 explicitly — scoping should still restrict to TP001
    const r = await request(app)
      .get('/api/dashboard/kpis?park=Test+Park+Beta')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    // TP002 name filter AND scopedIds=['TP001'] → intersection is empty
    expect(r.body.totalVisitors).toBe(0);
    expect(r.body.totalRevenue).toBe(0);
  });

  test('Cashier with no parks sees zero data', async () => {
    const r = await request(app).get('/api/dashboard/kpis')
      .set('Authorization', `Bearer ${unassignedCashierToken}`);
    expect(r.status).toBe(200);
    expect(r.body.totalVisitors).toBe(0);
    expect(r.body.totalRevenue).toBe(0);
  });
});

// ── Hourly scoping ────────────────────────────────────────────────────────────
// Hourly response shape: { mode, labels, footfall, revenue }
describe('GET /api/dashboard/hourly — park scoping', () => {
  test('returns 200 for Park Manager (scoped response)', async () => {
    const r = await request(app).get('/api/dashboard/hourly')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('labels');
    expect(r.body).toHaveProperty('footfall');
    expect(Array.isArray(r.body.footfall)).toBe(true);
  });

  test('Cashier with no parks sees empty hourly data', async () => {
    const r = await request(app).get('/api/dashboard/hourly')
      .set('Authorization', `Bearer ${unassignedCashierToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.footfall)).toBe(true);
    // No assigned parks → all footfall values are 0
    const totalFootfall = r.body.footfall.reduce((sum, v) => sum + v, 0);
    expect(totalFootfall).toBe(0);
  });
});

// ── Heatmap scoping ───────────────────────────────────────────────────────────
// Heatmap response shape: { days, hours, data }
describe('GET /api/dashboard/heatmap — park scoping', () => {
  test('returns 200 for Park Manager (scoped response)', async () => {
    const r = await request(app).get('/api/dashboard/heatmap')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('days');
    expect(r.body).toHaveProperty('data');
    expect(Array.isArray(r.body.data)).toBe(true);
  });
});

// ── Weekend/weekday scoping ───────────────────────────────────────────────────
// Response shape: { revenue: [...], footfall: [...] }
describe('GET /api/dashboard/weekend-weekday — park scoping', () => {
  test('returns 200 for Park Manager', async () => {
    const r = await request(app).get('/api/dashboard/weekend-weekday')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('revenue');
    expect(r.body).toHaveProperty('footfall');
  });
});

// ── GET /api/tickets scoping ──────────────────────────────────────────────────
describe('GET /api/tickets — park scoping', () => {
  test('Cashier only sees tickets for TP001', async () => {
    const r = await request(app).get('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
    const parkIds = r.body.tickets.map(t => t.park_id || t.park);
    // Every ticket returned must belong to TP001 or "Test Park Alpha"
    for (const p of parkIds) {
      expect(['TP001', 'Test Park Alpha']).toContain(p);
    }
  });

  test('Super Admin sees tickets from both TP001 and TP002', async () => {
    const r = await request(app).get('/api/tickets')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.summary.count).toBeGreaterThanOrEqual(5);
  });
});

// ── POST /api/tickets scope bypass prevention ─────────────────────────────────
describe('POST /api/tickets — scope bypass prevention', () => {
  test('403 when Cashier posts to unassigned park', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({ park_id: 'TP002' })); // cashier only has TP001
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/scope/i);
  });

  test('Cashier can post to assigned park', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({ park_id: 'TP001' }));
    expect(r.status).toBe(201);
  });

  test('Unassigned cashier cannot post to any park', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${unassignedCashierToken}`)
      .send(makeTicket({ park_id: 'TP001' }));
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/scope/i);
  });
});

// ── POST /api/tickets/batch — mixed park scope ────────────────────────────────
describe('POST /api/tickets/batch — mixed park scope', () => {
  test('207: in-scope tickets succeed, out-of-scope tickets return scope error', async () => {
    const inScope  = makeTicket({ park_id: 'TP001' });
    const outScope = makeTicket({ park_id: 'TP002' }); // PM not assigned to TP002... wait PM is on TP001 only
    // Use cashier (TP001 only) for simplicity
    const r = await request(app).post('/api/tickets/batch')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send([inScope, outScope]);
    expect(r.status).toBe(207);
    expect(r.body.inserted).toBe(1);
    const scopeErr = r.body.errors.find(e => e.error?.match(/scope/i));
    expect(scopeErr).toBeDefined();
  });
});
