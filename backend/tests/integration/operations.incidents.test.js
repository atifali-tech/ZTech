'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestIncident,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken;
let park1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'INC01', name: 'Incident Park' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.inc@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.inc@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.inc@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token; pmId = pm.id;
  cashierToken = cashier.token;

  await assignUserPark(pool, pmId, 'INC01');
});

afterAll(async () => { await pool.end(); });

describe('GET /api/operations/incidents', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/operations/incidents')).status).toBe(401);
  });

  test('200 empty initially', async () => {
    const r = await request(app).get('/api/operations/incidents').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});

describe('POST /api/operations/incidents', () => {
  test('401 without token', async () => {
    expect((await request(app).post('/api/operations/incidents').send({ park_id: 'INC01', title: 'Test' })).status).toBe(401);
  });

  test('403 cashier cannot create incident', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ park_id: 'INC01', title: 'Gate blocked', incident_type: 'gate_blocked', severity: 'high' });
    expect(r.status).toBe(403);
  });

  test('400 missing park_id', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'No park', incident_type: 'custom', severity: 'low' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/park_id/i);
  });

  test('400 invalid incident_type', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'INC01', title: 'Bad type', incident_type: 'explode', severity: 'low' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/incident_type/i);
  });

  test('201 creates incident', async () => {
    const r = await request(app).post('/api/operations/incidents')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'INC01', title: 'Scanner down', incident_type: 'scanner_failure', severity: 'high' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ title: 'Scanner down', severity: 'high', status: 'open', incident_type: 'scanner_failure' });
    expect(r.body.park_id).toBe('INC01');
    expect(r.body.park_name).toBe('Incident Park');
  });
});

describe('Incident lifecycle', () => {
  let incId;

  beforeAll(async () => {
    const inc = await createTestIncident(pool, { park_id: 'INC01', title: 'Lifecycle Inc', incident_type: 'custom', severity: 'medium' });
    incId = inc.id;
  });

  test('GET /:id returns incident', async () => {
    const r = await request(app).get(`/api/operations/incidents/${incId}`).set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(incId);
    expect(r.body.status).toBe('open');
  });

  test('GET /summary returns counts', async () => {
    const r = await request(app).get('/api/operations/incidents/summary').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('open');
    expect(r.body).toHaveProperty('investigating');
    expect(r.body).toHaveProperty('total_active');
  });

  test('403 cashier cannot investigate', async () => {
    const r = await request(app).post(`/api/operations/incidents/${incId}/investigate`)
      .set('Authorization', `Bearer ${cashierToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('200 investigate transitions to investigating', async () => {
    const r = await request(app).post(`/api/operations/incidents/${incId}/investigate`)
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('investigating');
    expect(r.body.assigned_to).toBeTruthy();
  });

  test('404 investigate a non-open incident again', async () => {
    const r = await request(app).post(`/api/operations/incidents/${incId}/investigate`)
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(404);
  });

  test('200 resolve with notes', async () => {
    const r = await request(app).post(`/api/operations/incidents/${incId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ resolution_notes: 'Fixed the scanner unit' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('resolved');
    expect(r.body.resolution_notes).toBe('Fixed the scanner unit');
    expect(r.body.resolved_at).toBeTruthy();
  });

  test('404 resolve already-resolved incident', async () => {
    const r = await request(app).post(`/api/operations/incidents/${incId}/resolve`)
      .set('Authorization', `Bearer ${pmToken}`).send({});
    expect(r.status).toBe(404);
  });

  test('park manager only sees scoped park incidents', async () => {
    const r = await request(app).get('/api/operations/incidents').set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(i => i.park_id === 'INC01')).toBe(true);
  });

  test('PUT /:id updates fields', async () => {
    const inc2 = await createTestIncident(pool, { park_id: 'INC01', title: 'Update test' });
    const r = await request(app).put(`/api/operations/incidents/${inc2.id}`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ title: 'Updated Title', severity: 'critical' });
    expect(r.status).toBe(200);
    expect(r.body.title).toBe('Updated Title');
    expect(r.body.severity).toBe('critical');
  });
});

describe('Incident filters', () => {
  test('filter by status', async () => {
    const r = await request(app).get('/api/operations/incidents?status=open').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(i => i.status === 'open')).toBe(true);
  });

  test('filter by severity', async () => {
    const r = await request(app).get('/api/operations/incidents?severity=medium').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(i => i.severity === 'medium')).toBe(true);
  });
});
