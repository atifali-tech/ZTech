'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestDevice, enableParkCapability, createTestAlert,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken;
let park1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'AL001', name: 'Alert Park' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.al@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.al@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.al@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token; pmId = pm.id;
  cashierToken = cashier.token;

  await assignUserPark(pool, pmId, 'AL001');
  await enableParkCapability(pool, 'AL001', { supports_devices: true });
});

afterAll(async () => { await pool.end(); });

describe('GET /api/operations/alerts', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/operations/alerts')).status).toBe(401);
  });

  test('200 empty list initially', async () => {
    const r = await request(app).get('/api/operations/alerts').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  test('200 returns seeded alerts', async () => {
    await createTestAlert(pool, { park_id: 'AL001', alert_type: 'stale_heartbeat', severity: 'high', title: 'Device Stale' });
    const r = await request(app).get('/api/operations/alerts').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    const alertsForPark = r.body.filter(a => a.park_id === 'AL001');
    expect(alertsForPark.length).toBeGreaterThan(0);
    expect(alertsForPark[0]).toMatchObject({ alert_type: 'stale_heartbeat', severity: 'high' });
  });

  test('200 filters by severity', async () => {
    const r = await request(app).get('/api/operations/alerts?severity=critical').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(a => a.severity === 'critical')).toBe(true);
  });

  test('200 park manager sees only scoped park', async () => {
    const r = await request(app).get('/api/operations/alerts').set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(a => a.park_id === 'AL001')).toBe(true);
  });

  test('cashier can see alerts (alerts.view permission)', async () => {
    const r = await request(app).get('/api/operations/alerts').set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
  });
});

describe('GET /api/operations/alerts/summary', () => {
  test('200 returns severity counts', async () => {
    const r = await request(app).get('/api/operations/alerts/summary').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('critical');
    expect(r.body).toHaveProperty('high');
    expect(r.body).toHaveProperty('medium');
    expect(r.body).toHaveProperty('total');
  });
});

describe('Alert lifecycle (acknowledge / resolve / suppress)', () => {
  let alertId;

  beforeAll(async () => {
    const a = await createTestAlert(pool, { park_id: 'AL001', alert_type: 'device_offline', severity: 'medium', title: 'Lifecycle Test' });
    alertId = a.id;
  });

  test('GET /:id returns the alert', async () => {
    const r = await request(app).get(`/api/operations/alerts/${alertId}`).set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(alertId);
    expect(r.body.status).toBe('open');
  });

  test('403 cashier cannot acknowledge (requires alerts.manage)', async () => {
    const r = await request(app).post(`/api/operations/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${cashierToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('200 park manager can acknowledge', async () => {
    const r = await request(app).post(`/api/operations/alerts/${alertId}/acknowledge`)
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('acknowledged');
  });

  test('200 resolve transitions to resolved', async () => {
    const r = await request(app).post(`/api/operations/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('resolved');
  });

  test('404 for non-existent alert', async () => {
    const r = await request(app).get('/api/operations/alerts/9999999').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(404);
  });
});

describe('POST /api/operations/alerts/generate', () => {
  test('403 cashier cannot generate', async () => {
    const r = await request(app).post('/api/operations/alerts/generate')
      .set('Authorization', `Bearer ${cashierToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('200 park manager can generate alerts', async () => {
    const r = await request(app).post('/api/operations/alerts/generate')
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('ok');
  });
});
