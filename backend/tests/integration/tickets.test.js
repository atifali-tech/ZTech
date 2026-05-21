'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS, makeTicket } = require('../fixtures/seeds');

let pool, app;
let saToken, saId, cashierToken, cashierId, authorityToken, authorityId;
let pmToken, pmId;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa        = await loginAs(pool, 'Super Admin',    { email: 'sa.tickets@test.com' });
  const cashier   = await loginAs(pool, 'Cashier',        { email: 'cs.tickets@test.com' });
  const authority = await loginAs(pool, 'Authority User', { email: 'au.tickets@test.com' });
  const pm        = await loginAs(pool, 'Park Manager',   { email: 'pm.tickets@test.com' });

  saToken        = sa.token;        saId        = sa.id;
  cashierToken   = cashier.token;   cashierId   = cashier.id;
  authorityToken = authority.token; authorityId = authority.id;
  pmToken        = pm.token;        pmId        = pm.id;

  // Cashier assigned to TP001 only
  await assignUserPark(pool, cashierId, 'TP001');
  // Park Manager assigned to TP001 + TP002
  await assignUserPark(pool, pmId, 'TP001');
  await assignUserPark(pool, pmId, 'TP002');
});

afterAll(async () => { await pool.end(); });

// ── POST /api/tickets ─────────────────────────────────────────────────────────
describe('POST /api/tickets', () => {
  test('401 without token', async () => {
    const r = await request(app).post('/api/tickets')
      .send(makeTicket());
    expect(r.status).toBe(401);
  });

  test('403 for Authority User (no tickets.create)', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${authorityToken}`)
      .send(makeTicket());
    expect(r.status).toBe(403);
    expect(r.body.required).toBe('tickets.create');
  });

  test('400 for missing park_id', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({ park_id: '' }));
    expect(r.status).toBe(400);
    expect(r.body.details).toEqual(expect.arrayContaining([expect.stringMatching(/park_id/)]));
  });

  test('400 for empty visitor_summary', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({
        visitor_summary: { total_adults: 0, total_children: 0, total_toddlers: 0, total_seniors: 0 },
        total_amount: 0,
        cash_amount: 0,
      }));
    expect(r.status).toBe(400);
  });

  test('400 for invalid payment_mode', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({ payment_mode: 'Bitcoin' }));
    expect(r.status).toBe(400);
  });

  test('201 creates ticket for Cashier in their assigned park', async () => {
    const ticket = makeTicket({ park_id: 'TP001' });
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(ticket);
    expect(r.status).toBe(201);
    expect(r.body.ok).toBe(true);
    expect(r.body.inserted).toBe(1);
  });

  test('cashier_id is stamped from JWT (not from request body)', async () => {
    const ticket = makeTicket({ park_id: 'TP001', cashier_id: '00000000-fake' });
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(ticket);
    expect(r.status).toBe(201);

    const { rows } = await pool.query(
      'SELECT cashier_id FROM tickets WHERE ticket_id = $1 LIMIT 1',
      [ticket.ticket_id]
    );
    expect(rows[0].cashier_id).toBe(cashierId); // JWT id, not the fake one
  });

  test('403 when Cashier tries to create ticket for unassigned park', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(makeTicket({ park_id: 'TP002' })); // cashier only has TP001
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/scope/i);
  });

  test('accepts VARCHAR(10) park_id like TP001 (not UUID)', async () => {
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${saToken}`)
      .send(makeTicket({ park_id: 'TP001' }));
    expect(r.status).toBe(201);
  });

  test('409 on duplicate ticket_id', async () => {
    const ticket = makeTicket({ park_id: 'TP001' });
    await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${saToken}`)
      .send(ticket);
    const r = await request(app).post('/api/tickets')
      .set('Authorization', `Bearer ${saToken}`)
      .send(ticket); // same ticket_id
    expect(r.status).toBe(409);
  });
});

// ── POST /api/tickets/batch ───────────────────────────────────────────────────
describe('POST /api/tickets/batch', () => {
  test('400 for empty array', async () => {
    const r = await request(app).post('/api/tickets/batch')
      .set('Authorization', `Bearer ${saToken}`)
      .send([]);
    expect(r.status).toBe(400);
  });

  test('207 inserts valid bookings and reports errors for invalid ones', async () => {
    const valid   = makeTicket({ park_id: 'TP001' });
    const invalid = { ticket_id: 'BAD', park_id: 'TP001', payment_mode: 'Cash', source: 'Counter' };
    const r = await request(app).post('/api/tickets/batch')
      .set('Authorization', `Bearer ${saToken}`)
      .send([valid, invalid]);
    expect(r.status).toBe(207);
    expect(r.body.inserted).toBe(1);
    expect(r.body.errors.length).toBeGreaterThan(0);
  });

  test('Park Manager can batch-create only for their assigned parks', async () => {
    const allowed  = makeTicket({ park_id: 'TP001' });
    const blocked  = makeTicket({ park_id: 'TP003' }); // PM not assigned to TP003
    const r = await request(app).post('/api/tickets/batch')
      .set('Authorization', `Bearer ${pmToken}`)
      .send([allowed, blocked]);
    expect(r.status).toBe(207);
    expect(r.body.inserted).toBe(1);
    const scopeErr = r.body.errors.find(e => e.error?.includes('scope'));
    expect(scopeErr).toBeDefined();
  });
});

// ── GET /api/tickets ──────────────────────────────────────────────────────────
describe('GET /api/tickets', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/tickets')).status).toBe(401);
  });

  test('403 for Authority User (no tickets.view)', async () => {
    const r = await request(app).get('/api/tickets')
      .set('Authorization', `Bearer ${authorityToken}`);
    expect(r.status).toBe(403);
  });

  test('returns paginated tickets for Super Admin', async () => {
    const r = await request(app).get('/api/tickets')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      pagination: { page: 1, limit: 50 },
      summary: { count: expect.any(Number) },
      tickets: expect.any(Array),
    });
  });

  test('Cashier only sees tickets for their assigned park', async () => {
    const r = await request(app).get('/api/tickets')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
    const parks = r.body.tickets.map(t => t.park);
    const nonAlpha = parks.filter(p => p !== 'Test Park Alpha');
    expect(nonAlpha).toHaveLength(0);
  });
});
