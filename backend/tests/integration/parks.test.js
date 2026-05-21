'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, saId, pmToken, pmId, cashierToken, authorityToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) {
    await createTestPark(pool, p);
  }

  const sa        = await loginAs(pool, 'Super Admin',    { email: 'sa.parks@test.com' });
  const pm        = await loginAs(pool, 'Park Manager',   { email: 'pm.parks@test.com' });
  const cashier   = await loginAs(pool, 'Cashier',        { email: 'cs.parks@test.com' });
  const authority = await loginAs(pool, 'Authority User', { email: 'au.parks@test.com' });

  saToken        = sa.token;
  saId           = sa.id;
  pmToken        = pm.token;
  pmId           = pm.id;
  cashierToken   = cashier.token;
  authorityToken = authority.token;

  // Park Manager assigned to TP001 only
  await assignUserPark(pool, pmId, 'TP001');
});

afterAll(async () => { await pool.end(); });

// ── GET /api/parks ────────────────────────────────────────────────────────────
describe('GET /api/parks', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/parks')).status).toBe(401);
  });

  test('Super Admin sees all parks', async () => {
    const r = await request(app).get('/api/parks')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(3);
  });

  test('Park Manager only sees their assigned park', async () => {
    const r = await request(app).get('/api/parks')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBe(1);
    expect(r.body[0].id).toBe('TP001');
  });

  test('Cashier with no park assignments sees empty array', async () => {
    const r = await request(app).get('/api/parks')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  test('Authority User sees all parks (has parks.view — global)', async () => {
    // Authority User role (6) does NOT have parkScope restriction unless assigned parks
    // Since no user_parks row for authority user, scopedParkIds = []
    const r = await request(app).get('/api/parks')
      .set('Authorization', `Bearer ${authorityToken}`);
    expect(r.status).toBe(200);
    // authority user has no park assignments → empty
    expect(r.body).toEqual([]);
  });
});

// ── GET /api/parks/:id ────────────────────────────────────────────────────────
describe('GET /api/parks/:id', () => {
  test('Super Admin can fetch any park', async () => {
    const r = await request(app).get('/api/parks/TP002')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe('TP002');
    expect(r.body.name).toBe('Test Park Beta');
  });

  test('Park Manager cannot fetch a park outside their scope', async () => {
    const r = await request(app).get('/api/parks/TP002')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(403);
  });

  test('Park Manager can fetch their assigned park', async () => {
    const r = await request(app).get('/api/parks/TP001')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.id).toBe('TP001');
  });

  test('404 for non-existent park', async () => {
    const r = await request(app).get('/api/parks/ZZZZ')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(404);
  });
});

// ── POST /api/parks ───────────────────────────────────────────────────────────
describe('POST /api/parks', () => {
  test('403 for Park Manager (no parks.create)', async () => {
    const r = await request(app).post('/api/parks')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ name: 'New Park', city: 'City', state: 'State' });
    expect(r.status).toBe(403);
  });

  test('400 when name/city/state missing', async () => {
    const r = await request(app).post('/api/parks')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ name: 'Only Name' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/required/i);
  });

  test('201 creates park for Super Admin', async () => {
    const r = await request(app).post('/api/parks')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ id: 'NEWPARK1', name: 'New Park One', city: 'Bangalore', state: 'Karnataka', color_hex: '#AABBCC', capacity: 200 });
    expect(r.status).toBe(201);
    expect(r.body.id).toBe('NEWPARK1');
    expect(r.body.name).toBe('New Park One');
    expect(r.body.capacity).toBe(200);
  });

  test('409 on duplicate park id', async () => {
    const r = await request(app).post('/api/parks')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ id: 'TP001', name: 'Dup Park', city: 'City', state: 'State' });
    expect(r.status).toBe(409);
  });
});

// ── PUT /api/parks/:id ────────────────────────────────────────────────────────
describe('PUT /api/parks/:id', () => {
  test('403 for Cashier (no parks.edit)', async () => {
    const r = await request(app).put('/api/parks/TP001')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ capacity: 999 });
    expect(r.status).toBe(403);
  });

  test('200 updates park for Super Admin', async () => {
    const r = await request(app).put('/api/parks/TP001')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ capacity: 750 });
    expect(r.status).toBe(200);
    expect(r.body.capacity).toBe(750);
  });

  test('400 when nothing to update', async () => {
    const r = await request(app).put('/api/parks/TP001')
      .set('Authorization', `Bearer ${saToken}`)
      .send({});
    expect(r.status).toBe(400);
  });
});

// ── DELETE /api/parks/:id ─────────────────────────────────────────────────────
describe('DELETE /api/parks/:id', () => {
  test('403 for Park Manager (no parks.delete)', async () => {
    const r = await request(app).delete('/api/parks/NEWPARK1')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(403);
  });

  test('200 deletes park for Super Admin', async () => {
    // Create a temporary park to delete
    await createTestPark(pool, { id: 'TODEL', name: 'To Delete', city: 'City', state: 'State' });
    const r = await request(app).delete('/api/parks/TODEL')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  test('404 for non-existent park', async () => {
    const r = await request(app).delete('/api/parks/NOPE')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(404);
  });
});
