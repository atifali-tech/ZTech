'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, cashierToken, cashierId, financeToken, authorityToken;
let pmToken, pmId;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa        = await loginAs(pool, 'Super Admin',    { email: 'sa.dash@test.com' });
  const cashier   = await loginAs(pool, 'Cashier',        { email: 'cs.dash@test.com' });
  const finance   = await loginAs(pool, 'Finance Head',   { email: 'fh.dash@test.com' });
  const authority = await loginAs(pool, 'Authority User', { email: 'au.dash@test.com' });
  const pm        = await loginAs(pool, 'Park Manager',   { email: 'pm.dash@test.com' });

  saToken        = sa.token;
  cashierToken   = cashier.token; cashierId = cashier.id;
  financeToken   = finance.token;
  authorityToken = authority.token;
  pmToken        = pm.token; pmId = pm.id;

  // Cashier and PM assigned to TP001 only
  await assignUserPark(pool, cashierId, 'TP001');
  await assignUserPark(pool, pmId, 'TP001');
});

afterAll(async () => { await pool.end(); });

// ── GET /api/dashboard/today-stats ───────────────────────────────────────────
describe('GET /api/dashboard/today-stats', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/dashboard/today-stats')).status).toBe(401);
  });

  test('returns stats for Super Admin (shape check)', async () => {
    const r = await request(app).get('/api/dashboard/today-stats')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      visitors: expect.any(Number),
      revenue:  expect.any(Number),
      tickets:  expect.any(Number),
    });
  });

  test('Cashier can access today-stats (has dashboard.view)', async () => {
    const r = await request(app).get('/api/dashboard/today-stats')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
  });
});

// ── GET /api/dashboard/parks ──────────────────────────────────────────────────
describe('GET /api/dashboard/parks', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/dashboard/parks')).status).toBe(401);
  });

  test('Super Admin sees all parks', async () => {
    const r = await request(app).get('/api/dashboard/parks')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBe(3);
  });

  test('Park Manager only sees their assigned park', async () => {
    const r = await request(app).get('/api/dashboard/parks')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
    expect(r.body[0].id).toBe('TP001');
  });
});

// ── Analytics routes require analytics.view ───────────────────────────────────
describe('Analytics routes — permission guard', () => {
  const ANALYTICS_ROUTES = [
    '/api/dashboard/demographics',
    '/api/dashboard/revenue-splits',
    '/api/dashboard/comparative',
    '/api/dashboard/top-parks',
    '/api/dashboard/top-parks-revenue',
  ];

  test('Cashier (no analytics.view) gets 403 on analytics endpoints', async () => {
    for (const route of ANALYTICS_ROUTES) {
      const r = await request(app).get(route)
        .set('Authorization', `Bearer ${cashierToken}`);
      expect(r.status).toBe(403);
    }
  });

  test('Finance Head (has analytics.view) can access analytics', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${financeToken}`);
    // May return 200 or 404 depending on data, but NOT 401/403
    expect([200, 404, 500]).toContain(r.status); // no auth/permission error
    expect(r.status).not.toBe(401);
    expect(r.status).not.toBe(403);
  });
});
