'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestCounter, createTestDevice,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken;
let park1, counter1, counter2, device1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'DP001', name: 'Device Park', city: 'City', state: 'State' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.devices@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.devices@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.devices@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token; pmId = pm.id;
  cashierToken = cashier.token;

  await assignUserPark(pool, pmId, 'DP001');

  counter1 = await createTestCounter(pool, { park_id: 'DP001', name: 'Counter A' });
  counter2 = await createTestCounter(pool, { park_id: 'DP001', name: 'Counter B' });
  device1  = await createTestDevice(pool,  { park_id: 'DP001', name: 'POS-01', device_type: 'POS' });
});

afterAll(async () => { await pool.end(); });

// ── Create device ─────────────────────────────────────────────────────────────
describe('POST /api/operations/devices', () => {
  test('201 creates device for Park Manager', async () => {
    const r = await request(app).post('/api/operations/devices')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'DP001', name: 'Scanner-01', device_type: 'QR Scanner' });
    expect(r.status).toBe(201);
    expect(r.body.name).toBe('Scanner-01');
    expect(r.body.status).toBe('Offline');
  });

  test('400 for invalid device_type', async () => {
    const r = await request(app).post('/api/operations/devices')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ park_id: 'DP001', name: 'X', device_type: 'Laser Cannon' });
    expect(r.status).toBe(400);
  });

  test('403 for Cashier (no devices.create)', async () => {
    const r = await request(app).post('/api/operations/devices')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'DP001', name: 'POS-99', device_type: 'POS' });
    expect(r.status).toBe(403);
  });
});

// ── Assign device ─────────────────────────────────────────────────────────────
describe('POST /api/operations/devices/:id/assign', () => {
  test('200 assigns device to counter', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/assign`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ counter_id: counter1.id, reason: 'Initial assignment' });
    expect(r.status).toBe(200);
    expect(r.body.counter_id).toBe(counter1.id);
  });

  test('assignment history recorded', async () => {
    const r = await request(app).get(`/api/operations/devices/${device1.id}/assignments`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body[0].counter_id).toBe(counter1.id);
    expect(r.body[0].reason).toBe('Initial assignment');
  });

  test('200 moves device to different counter and closes prior assignment', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/assign`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ counter_id: counter2.id, reason: 'Relocated' });
    expect(r.status).toBe(200);
    expect(r.body.counter_id).toBe(counter2.id);

    // History should now have 2 entries; first has unassigned_at set
    const hist = await request(app).get(`/api/operations/devices/${device1.id}/assignments`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(hist.body.length).toBe(2);
    const closed = hist.body.find(a => a.counter_id === counter1.id);
    expect(closed.unassigned_at).not.toBeNull();
  });

  test('200 unassigns device when counter_id is null', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/assign`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ counter_id: null, reason: 'Removed from counter' });
    expect(r.status).toBe(200);
    expect(r.body.counter_id).toBeNull();
  });
});

// ── Device mode transitions ───────────────────────────────────────────────────
describe('POST /api/operations/devices/:id/mode', () => {
  test('200 sets device to Maintenance', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/mode`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ mode: 'Maintenance', reason: 'Hardware repair' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Maintenance');
  });

  test('200 sets device to Blocked', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/mode`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ mode: 'Blocked', reason: 'Suspected tampering' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Blocked');
  });

  test('400 for invalid mode', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/mode`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ mode: 'FlyMode' });
    expect(r.status).toBe(400);
  });

  test('200 brings device back Online', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/mode`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ mode: 'Online' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Online');
  });
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────
describe('POST /api/operations/devices/:id/heartbeat', () => {
  test('200 records heartbeat and updates last_heartbeat', async () => {
    const r = await request(app).post(`/api/operations/devices/${device1.id}/heartbeat`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ status: 'Online', meta: { battery: 95 } });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.last_heartbeat).not.toBeNull();
  });
});
