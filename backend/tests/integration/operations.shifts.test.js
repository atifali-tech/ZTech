'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestCounter, createTestShift,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, saId, pmToken, pmId, cashierToken, cashierId;
let park1, counter1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'SP001', name: 'Shift Park', city: 'City', state: 'State' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.shifts@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.shifts@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.shifts@test.com' });

  saToken      = sa.token; saId      = sa.id;
  pmToken      = pm.token; pmId      = pm.id;
  cashierToken = cashier.token; cashierId = cashier.id;

  await assignUserPark(pool, pmId,      'SP001');
  await assignUserPark(pool, cashierId, 'SP001');

  counter1 = await createTestCounter(pool, { park_id: 'SP001', name: 'Counter A' });
});

afterAll(async () => { await pool.end(); });

// ── Open shift ────────────────────────────────────────────────────────────────
describe('POST /api/operations/shifts — open', () => {
  test('401 without token', async () => {
    expect((await request(app).post('/api/operations/shifts').send({ park_id: 'SP001' })).status).toBe(401);
  });

  test('400 when park_id missing', async () => {
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${saToken}`).send({});
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/park_id/i);
  });

  test('201 opens shift for cashier', async () => {
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'SP001', counter_id: counter1.id, opening_cash: 5000, expected_rev: 50000 });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('Open');
    expect(r.body.opening_cash).toBe('5000.00');
    expect(r.body.park_id).toBe('SP001');
    expect(r.body.counter_id).toBe(counter1.id);
  });

  test('409 when cashier already has open shift at same park', async () => {
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'SP001' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/already have an open shift/i);
  });

  test('Super Admin can open shift without being in user_parks', async () => {
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ park_id: 'SP001', opening_cash: 1000 });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('Open');
  });
});

// ── List shifts ───────────────────────────────────────────────────────────────
describe('GET /api/operations/shifts', () => {
  test('returns shifts for authorised user', async () => {
    const r = await request(app).get('/api/operations/shifts?park_id=SP001')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body[0]).toHaveProperty('user_name');
  });

  test('status filter works', async () => {
    const r = await request(app).get('/api/operations/shifts?park_id=SP001&status=Open')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    r.body.forEach(s => expect(s.status).toBe('Open'));
  });
});

// ── Close shift ───────────────────────────────────────────────────────────────
describe('POST /api/operations/shifts/:id/close', () => {
  let shiftId;

  beforeAll(async () => {
    // Open a dedicated shift for close testing
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'SP001', counter_id: counter1.id, opening_cash: 2000, expected_rev: 30000 });
    shiftId = r.body.id;
  });

  test('403 for Authority User (no shifts.close)', async () => {
    const auth = await loginAs(pool, 'Authority User', { email: 'au.shiftclose@test.com' });
    await assignUserPark(pool, auth.id, 'SP001');
    const r = await request(app).post(`/api/operations/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ declared_cash: 30000 });
    expect(r.status).toBe(403);
  });

  test('200 closes shift and computes no variance when amounts match', async () => {
    const r = await request(app).post(`/api/operations/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ declared_cash: 30000, actual_rev: 30000, notes: 'All good' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Closed');
    expect(r.body.closed_at).not.toBeNull();
  });

  test('404 closing already-closed shift', async () => {
    const r = await request(app).post(`/api/operations/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ declared_cash: 30000 });
    expect(r.status).toBe(404);
  });
});

// ── Variance Flagged status ───────────────────────────────────────────────────
describe('Shift variance detection', () => {
  let shiftId, varianceUser;

  beforeAll(async () => {
    // Use a fresh user to avoid conflict with the SA shift still open above
    varianceUser = await loginAs(pool, 'Park Manager', { email: 'vari.shifts@test.com' });
    await assignUserPark(pool, varianceUser.id, 'SP001');

    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${varianceUser.token}`)
      .send({ park_id: 'SP001', expected_rev: 50000, opening_cash: 1000 });
    expect(r.status).toBe(201);
    shiftId = r.body.id;
  });

  test('status becomes Variance Flagged when actual != expected', async () => {
    const r = await request(app).post(`/api/operations/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ declared_cash: 40000, actual_rev: 40000 });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Variance Flagged');
  });

  test('reconcile moves shift to Reconciled', async () => {
    const r = await request(app).post(`/api/operations/shifts/${shiftId}/reconcile`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ notes: 'Reviewed and accepted', supervisor_id: saId });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Reconciled');
  });
});
