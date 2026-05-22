'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const {
  createTestPool, resetDatabase, createTestPark, assignUserPark,
  createTestGate, enableParkCapability,
} = require('../helpers/db');
const { loginAs } = require('../helpers/auth');

let pool, app;
let saToken, pmToken, pmId, cashierToken;
let park1, gate1;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  park1 = await createTestPark(pool, { id: 'OP001', name: 'Occ Park', city: 'City', state: 'State' });

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.occ@test.com' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.occ@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.occ@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token; pmId = pm.id;
  cashierToken = cashier.token;

  await assignUserPark(pool, pmId, 'OP001');

  gate1 = await createTestGate(pool, { park_id: 'OP001', name: 'Main Entry', gate_type: 'Entry', occupancy_enabled: true });

  // Enable entry tracking
  await enableParkCapability(pool, 'OP001', { supports_entry_tracking: true });
});

afterAll(async () => { await pool.end(); });

// ── Record occupancy events ───────────────────────────────────────────────────
describe('POST /api/operations/occupancy/event', () => {
  test('401 without token', async () => {
    expect((await request(app).post('/api/operations/occupancy/event').send({ park_id: 'OP001', event_type: 'entry' })).status).toBe(401);
  });

  test('400 missing park_id', async () => {
    const r = await request(app).post('/api/operations/occupancy/event')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ event_type: 'entry' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/park_id/i);
  });

  test('400 for invalid event_type', async () => {
    const r = await request(app).post('/api/operations/occupancy/event')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'OP001', event_type: 'teleport' });
    expect(r.status).toBe(400);
  });

  test('201 records entry event', async () => {
    const r = await request(app).post('/api/operations/occupancy/event')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'OP001', gate_id: gate1.id, event_type: 'entry', ticket_ref: 'TKT001' });
    expect(r.status).toBe(201);
    expect(r.body.event_type).toBe('entry');
    expect(r.body.park_id).toBe('OP001');
  });

  test('201 records exit event', async () => {
    const r = await request(app).post('/api/operations/occupancy/event')
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ park_id: 'OP001', gate_id: gate1.id, event_type: 'exit' });
    expect(r.status).toBe(201);
  });

  test('gate throughput incremented', async () => {
    const { rows } = await pool.query('SELECT throughput_today FROM park_gates WHERE id = $1', [gate1.id]);
    expect(rows[0].throughput_today).toBeGreaterThanOrEqual(2);
  });
});

// ── Park without entry tracking ───────────────────────────────────────────────
describe('Park capability guard — no entry tracking', () => {
  let park2;

  beforeAll(async () => {
    park2 = await createTestPark(pool, { id: 'OP002', name: 'No Track Park', city: 'City', state: 'State' });
    await enableParkCapability(pool, 'OP002', { supports_entry_tracking: false });
  });

  test('422 when park has entry tracking disabled', async () => {
    const r = await request(app).post('/api/operations/occupancy/event')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ park_id: 'OP002', event_type: 'entry' });
    expect(r.status).toBe(422);
    expect(r.body.error).toMatch(/entry tracking/i);
  });
});

// ── Query and summary ─────────────────────────────────────────────────────────
describe('GET /api/operations/occupancy', () => {
  test('returns events list', async () => {
    const r = await request(app).get('/api/operations/occupancy/events?park_id=OP001')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);
    expect(r.body[0]).toHaveProperty('event_type');
  });

  test('returns summary with occupancy estimate', async () => {
    const r = await request(app).get('/api/operations/occupancy/summary?park_id=OP001')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('entries_today');
    expect(r.body).toHaveProperty('exits_today');
    expect(r.body).toHaveProperty('estimated_occupancy');
    expect(r.body.entries_today).toBeGreaterThan(0);
  });
});
