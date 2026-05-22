'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestAlert, createTestIncident, enableParkCapability,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, cashierToken, corpToken, authToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  await createTestPark(pool, { id: 'RB001', name: 'RBAC Park' });

  const sa      = await loginAs(pool, 'Super Admin',    { email: 'sa.rb3@test.com' });
  const pm      = await loginAs(pool, 'Park Manager',   { email: 'pm.rb3@test.com' });
  const cashier = await loginAs(pool, 'Cashier',        { email: 'cs.rb3@test.com' });
  const corp    = await loginAs(pool, 'Corporate Admin',{ email: 'co.rb3@test.com' });
  const auth    = await loginAs(pool, 'Authority User', { email: 'au.rb3@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token;
  cashierToken = cashier.token;
  corpToken    = corp.token;
  authToken    = auth.token;

  await assignUserPark(pool, pm.id, 'RB001');
  await enableParkCapability(pool, 'RB001', {});
  await createTestAlert(pool, { park_id: 'RB001', alert_type: 'device_offline', severity: 'low', title: 'RBAC Alert' });
  await createTestIncident(pool, { park_id: 'RB001', title: 'RBAC Incident' });
});

afterAll(async () => { await pool.end(); });

describe('P3 RBAC — alerts.view', () => {
  const roles = [
    ['Super Admin',    () => saToken,    200],
    ['Park Manager',   () => pmToken,    200],
    ['Corporate Admin',() => corpToken,  200],
    ['Authority User', () => authToken,  200],
    ['Cashier',        () => cashierToken, 200],
  ];

  test.each(roles)('%s can view alerts', async (role, getToken, expectedStatus) => {
    const r = await request(app).get('/api/operations/alerts').set('Authorization', `Bearer ${getToken()}`);
    expect(r.status).toBe(expectedStatus);
  });
});

describe('P3 RBAC — alerts.manage', () => {
  test('Cashier 403 on generate', async () => {
    const r = await request(app).post('/api/operations/alerts/generate')
      .set('Authorization', `Bearer ${cashierToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('Authority User 403 on generate', async () => {
    const r = await request(app).post('/api/operations/alerts/generate')
      .set('Authorization', `Bearer ${authToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('Park Manager 200 on generate', async () => {
    const r = await request(app).post('/api/operations/alerts/generate')
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(200);
  });
});

describe('P3 RBAC — incidents.view', () => {
  const viewers = [
    ['Super Admin',    () => saToken,    200],
    ['Park Manager',   () => pmToken,    200],
    ['Corporate Admin',() => corpToken,  200],
    ['Authority User', () => authToken,  200],
  ];

  test.each(viewers)('%s can view incidents', async (role, getToken, expectedStatus) => {
    const r = await request(app).get('/api/operations/incidents').set('Authorization', `Bearer ${getToken()}`);
    expect(r.status).toBe(expectedStatus);
  });

  test('Cashier 403 on incidents list (no incidents.view)', async () => {
    const r = await request(app).get('/api/operations/incidents').set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });
});

describe('P3 RBAC — incidents.create', () => {
  test('Cashier 403 cannot create incident', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'RB001', title: 'Not allowed', incident_type: 'custom', severity: 'low' });
    expect(r.status).toBe(403);
  });

  test('Authority User 403 cannot create incident', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ park_id: 'RB001', title: 'Not allowed', incident_type: 'custom', severity: 'low' });
    expect(r.status).toBe(403);
  });

  test('Park Manager 201 can create incident', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'RB001', title: 'PM incident', incident_type: 'custom', severity: 'medium' });
    expect(r.status).toBe(201);
  });
});

describe('P3 RBAC — occupancy.view', () => {
  test('Park Manager 200 can view occupancy summary', async () => {
    const r = await request(app).get('/api/operations/occupancy/summary?park_id=RB001')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
  });

  test('Unauthenticated 401 on occupancy', async () => {
    const r = await request(app).get('/api/operations/occupancy/live?park_id=RB001');
    expect(r.status).toBe(401);
  });
});

describe('P3 RBAC — ops dashboard', () => {
  test('Cashier 200 on ops dashboard (counters.view)', async () => {
    const r = await request(app).get('/api/operations/dashboard')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('counters');
    expect(r.body).toHaveProperty('alerts');
    expect(r.body).toHaveProperty('incidents');
  });

  test('Auth User 200 on ops dashboard', async () => {
    const r = await request(app).get('/api/operations/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(r.status).toBe(200);
  });
});
