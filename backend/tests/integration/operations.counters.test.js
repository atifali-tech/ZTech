'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestCounter, createTestShift,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken, cashierId;
let park1, counter1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'CP001', name: 'Counter Park', city: 'City', state: 'State' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.counters@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.counters@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.counters@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token; pmId = pm.id;
  cashierToken = cashier.token; cashierId = cashier.id;

  await assignUserPark(pool, pmId,      'CP001');
  await assignUserPark(pool, cashierId, 'CP001');

  counter1 = await createTestCounter(pool, { park_id: 'CP001', name: 'Counter A' });
});

afterAll(async () => { await pool.end(); });

// ── Operational status ────────────────────────────────────────────────────────
describe('POST /api/operations/counters/:id/status', () => {
  test('200 sets counter to Active', async () => {
    const r = await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ op_status: 'Active' });
    expect(r.status).toBe(200);
    expect(r.body.op_status).toBe('Active');
  });

  test('200 sets counter to Maintenance', async () => {
    const r = await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ op_status: 'Maintenance', reason: 'Hardware fix' });
    expect(r.status).toBe(200);
    expect(r.body.op_status).toBe('Maintenance');
  });

  test('400 for invalid op_status', async () => {
    const r = await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ op_status: 'Flying' });
    expect(r.status).toBe(400);
  });

  test('400 when trying to set Shift Open directly', async () => {
    const r = await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ op_status: 'Shift Open' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/managed by shift lifecycle/i);
  });

  test('403 for Cashier (no counters.edit)', async () => {
    const r = await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ op_status: 'Active' });
    expect(r.status).toBe(403);
  });
});

// ── Counter op_status reflected after shift open/close ───────────────────────
describe('Counter op_status via shift lifecycle', () => {
  let counter2, shiftId;

  beforeAll(async () => {
    counter2 = await createTestCounter(pool, { park_id: 'CP001', name: 'Counter B' });
  });

  test('counter op_status becomes Shift Open when shift opens', async () => {
    const r = await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'CP001', counter_id: counter2.id });
    expect(r.status).toBe(201);
    shiftId = r.body.id;

    const c = await request(app).get(`/api/operations/counters/${counter2.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(c.body.op_status).toBe('Shift Open');
    expect(c.body.current_shift_id).toBe(shiftId);
  });

  test('counter op_status becomes Shift Closed after shift closes', async () => {
    await request(app).post(`/api/operations/shifts/${shiftId}/close`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ declared_cash: 0 });

    const c = await request(app).get(`/api/operations/counters/${counter2.id}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(c.body.op_status).toBe('Shift Closed');
    expect(c.body.current_shift_id).toBeNull();
  });
});

// ── List with op_status filter ────────────────────────────────────────────────
describe('GET /api/operations/counters with op_status filter', () => {
  test('filters by op_status', async () => {
    // Reset counter1 to Active first
    await request(app).post(`/api/operations/counters/${counter1.id}/status`)
      .set('Authorization', `Bearer ${saToken}`).send({ op_status: 'Active' });

    const r = await request(app).get('/api/operations/counters?park_id=CP001&op_status=Active')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    r.body.forEach(c => expect(c.op_status).toBe('Active'));
  });
});
