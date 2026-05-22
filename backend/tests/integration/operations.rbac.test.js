'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestCounter, createTestDevice, createTestGate, createTestShift,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken, cashierId, financeToken, authorityToken;
let park1, counter1, device1, gate1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'RP001', name: 'RBAC Park', city: 'City', state: 'State' });

  const sa        = await loginAs(pool, 'Super Admin',    { email: 'sa.rbac@test.com' });
  const pm        = await loginAs(pool, 'Park Manager',   { email: 'pm.rbac@test.com' });
  const cashier   = await loginAs(pool, 'Cashier',        { email: 'cs.rbac@test.com' });
  const finance   = await loginAs(pool, 'Finance Head',   { email: 'fin.rbac@test.com' });
  const authority = await loginAs(pool, 'Authority User', { email: 'au.rbac@test.com' });

  saToken        = sa.token;
  pmToken        = pm.token; pmId = pm.id;
  cashierToken   = cashier.token; cashierId = cashier.id;
  financeToken   = finance.token;
  authorityToken = authority.token;

  await assignUserPark(pool, pmId,        'RP001');
  await assignUserPark(pool, cashierId,   'RP001');
  await assignUserPark(pool, finance.id,  'RP001');
  await assignUserPark(pool, authority.id,'RP001');

  counter1 = await createTestCounter(pool, { park_id: 'RP001', name: 'RBAC Counter' });
  device1  = await createTestDevice(pool,  { park_id: 'RP001', name: 'RBAC Device' });
  gate1    = await createTestGate(pool,    { park_id: 'RP001', name: 'RBAC Gate' });
});

afterAll(async () => { await pool.end(); });

// ── Zones RBAC ────────────────────────────────────────────────────────────────
describe('Zones RBAC', () => {
  test('Authority User can view zones', async () => {
    expect((await request(app).get('/api/operations/zones').set('Authorization', `Bearer ${authorityToken}`)).status).toBe(200);
  });

  test('Cashier cannot create zones', async () => {
    expect((await request(app).post('/api/operations/zones')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'RP001', name: 'Z1' })).status).toBe(403);
  });

  test('Park Manager can create zones', async () => {
    expect((await request(app).post('/api/operations/zones')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'RP001', name: 'Zone Alpha' })).status).toBe(201);
  });
});

// ── Counters RBAC ─────────────────────────────────────────────────────────────
describe('Counters RBAC', () => {
  test('Cashier can view counters', async () => {
    expect((await request(app).get('/api/operations/counters').set('Authorization', `Bearer ${cashierToken}`)).status).toBe(200);
  });

  test('Finance Head can view counters', async () => {
    expect((await request(app).get('/api/operations/counters').set('Authorization', `Bearer ${financeToken}`)).status).toBe(200);
  });

  test('Cashier cannot delete counters', async () => {
    expect((await request(app).delete(`/api/operations/counters/${counter1.id}`)
      .set('Authorization', `Bearer ${cashierToken}`)).status).toBe(403);
  });
});

// ── Devices RBAC ──────────────────────────────────────────────────────────────
describe('Devices RBAC', () => {
  test('Authority User can view devices', async () => {
    expect((await request(app).get('/api/operations/devices').set('Authorization', `Bearer ${authorityToken}`)).status).toBe(200);
  });

  test('Cashier can view devices', async () => {
    expect((await request(app).get('/api/operations/devices').set('Authorization', `Bearer ${cashierToken}`)).status).toBe(200);
  });

  test('Cashier cannot delete devices', async () => {
    expect((await request(app).delete(`/api/operations/devices/${device1.id}`)
      .set('Authorization', `Bearer ${cashierToken}`)).status).toBe(403);
  });

  test('Cashier cannot assign devices', async () => {
    expect((await request(app).post(`/api/operations/devices/${device1.id}/assign`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ counter_id: counter1.id })).status).toBe(403);
  });
});

// ── Gates RBAC ────────────────────────────────────────────────────────────────
describe('Gates RBAC', () => {
  test('Authority User can view gates', async () => {
    expect((await request(app).get('/api/operations/gates').set('Authorization', `Bearer ${authorityToken}`)).status).toBe(200);
  });

  test('Cashier cannot change gate status', async () => {
    expect((await request(app).post(`/api/operations/gates/${gate1.id}/status`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ op_status: 'Active' })).status).toBe(403);
  });

  test('Park Manager can change gate status', async () => {
    expect((await request(app).post(`/api/operations/gates/${gate1.id}/status`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ op_status: 'Active' })).status).toBe(200);
  });
});

// ── Shifts RBAC ───────────────────────────────────────────────────────────────
describe('Shifts RBAC', () => {
  test('Finance Head can view shifts', async () => {
    expect((await request(app).get('/api/operations/shifts').set('Authorization', `Bearer ${financeToken}`)).status).toBe(200);
  });

  test('Authority User can view shifts', async () => {
    expect((await request(app).get('/api/operations/shifts').set('Authorization', `Bearer ${authorityToken}`)).status).toBe(200);
  });

  test('Authority User cannot open shifts', async () => {
    expect((await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${authorityToken}`)
      .send({ park_id: 'RP001' })).status).toBe(403);
  });

  test('Cashier can open shifts', async () => {
    expect((await request(app).post('/api/operations/shifts')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'RP001' })).status).toBe(201);
  });
});

// ── Park capability: scoped access ───────────────────────────────────────────
describe('Park scoping', () => {
  let outsidePark, outsidePm;

  beforeAll(async () => {
    outsidePark = await createTestPark(pool, { id: 'RP002', name: 'Other Park', city: 'C', state: 'S' });
    const pm2 = await loginAs(pool, 'Park Manager', { email: 'pm2.rbac@test.com' });
    outsidePm = pm2.token;
    await assignUserPark(pool, pm2.id, 'RP002');
  });

  test('Park Manager cannot access counters from another park', async () => {
    const r = await request(app).get(`/api/operations/counters?park_id=RP001`)
      .set('Authorization', `Bearer ${outsidePm}`);
    expect(r.status).toBe(403);
  });

  test('Park Manager sees only their park data when no filter given', async () => {
    const r = await request(app).get('/api/operations/counters')
      .set('Authorization', `Bearer ${outsidePm}`);
    expect(r.status).toBe(200);
    r.body.forEach(c => expect(c.park_id).toBe('RP002'));
  });
});
