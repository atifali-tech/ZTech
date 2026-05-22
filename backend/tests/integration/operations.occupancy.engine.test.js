'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestGate, enableParkCapability, recordOccupancyEvent,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId;
let park1, gate1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'OCE01', name: 'Engine Park', capacity: 100 });

  const sa = await loginAs(pool, 'Super Admin',  { email: 'sa.oce@test.com' });
  const pm = await loginAs(pool, 'Park Manager', { email: 'pm.oce@test.com' });

  saToken = sa.token;
  pmToken = pm.token; pmId = pm.id;

  await assignUserPark(pool, pmId, 'OCE01');
  gate1 = await createTestGate(pool, { park_id: 'OCE01', name: 'Entry Gate', gate_type: 'Entry', occupancy_enabled: true });
  await enableParkCapability(pool, 'OCE01', { supports_entry_tracking: true });
});

afterAll(async () => { await pool.end(); });

describe('GET /api/operations/occupancy/live', () => {
  test('400 without park_id', async () => {
    const r = await request(app).get('/api/operations/occupancy/live').set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(400);
  });

  test('200 returns live occupancy — mode none (no events)', async () => {
    const park2 = await createTestPark(pool, { id: 'OCE02', name: 'No Track', capacity: 50 });
    await enableParkCapability(pool, 'OCE02', { supports_entry_tracking: false });

    const r = await request(app).get('/api/operations/occupancy/live?park_id=OCE02')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.tracking_mode).toBe('none');
    expect(r.body.status).toBe('disabled');
    expect(r.body.current_occupancy).toBe(0);
  });

  test('200 entry_only mode with entries', async () => {
    await recordOccupancyEvent(pool, { park_id: 'OCE01', gate_id: gate1.id, event_type: 'entry' });
    await recordOccupancyEvent(pool, { park_id: 'OCE01', gate_id: gate1.id, event_type: 'entry' });
    await recordOccupancyEvent(pool, { park_id: 'OCE01', gate_id: gate1.id, event_type: 'entry' });

    const r = await request(app).get('/api/operations/occupancy/live?park_id=OCE01')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.tracking_mode).toBe('entry_only');
    expect(r.body.current_occupancy).toBe(3);
    expect(r.body.entries_today).toBe(3);
    expect(r.body.capacity).toBe(100);
    expect(r.body.occupancy_pct).toBe(3.0);
    expect(r.body.status).toBe('normal');
  });

  test('200 full mode when exit events exist', async () => {
    await recordOccupancyEvent(pool, { park_id: 'OCE01', gate_id: gate1.id, event_type: 'exit' });

    const r = await request(app).get('/api/operations/occupancy/live?park_id=OCE01')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.tracking_mode).toBe('full');
    expect(r.body.current_occupancy).toBe(2);
    expect(r.body.exits_today).toBe(1);
  });

  test('403 park manager cannot access different park', async () => {
    const r = await request(app).get('/api/operations/occupancy/live?park_id=OCE02')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(403);
  });
});

describe('GET /api/operations/occupancy/live/all', () => {
  test('200 returns array', async () => {
    const r = await request(app).get('/api/operations/occupancy/live/all')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });

  test('park manager gets only scoped parks', async () => {
    const r = await request(app).get('/api/operations/occupancy/live/all')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.every(o => o.park_id === 'OCE01')).toBe(true);
  });
});

describe('POST /api/operations/occupancy/snapshot', () => {
  test('201 creates snapshot', async () => {
    const r = await request(app).post('/api/operations/occupancy/snapshot')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ park_id: 'OCE01' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      park_id: 'OCE01',
      tracking_mode: 'full',
    });
    expect(r.body.current_occupancy).toBeGreaterThanOrEqual(0);
  });

  test('GET /snapshots returns history', async () => {
    const r = await request(app).get('/api/operations/occupancy/snapshots?park_id=OCE01')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body[0]).toHaveProperty('snapshot_at');
    expect(r.body[0]).toHaveProperty('current_occupancy');
  });
});
