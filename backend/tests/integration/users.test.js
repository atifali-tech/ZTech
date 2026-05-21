'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, createTestUser } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, saId, caToken, caId, pmToken, pmId, cashierToken, cashierId;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa      = await loginAs(pool, 'Super Admin',     { email: 'sa.users@test.com' });
  const ca      = await loginAs(pool, 'Corporate Admin', { email: 'ca.users@test.com' });
  const pm      = await loginAs(pool, 'Park Manager',    { email: 'pm.users@test.com' });
  const cashier = await loginAs(pool, 'Cashier',         { email: 'cs.users@test.com' });

  saToken = sa.token; saId = sa.id;
  caToken = ca.token; caId = ca.id;
  pmToken = pm.token; pmId = pm.id;
  cashierToken = cashier.token; cashierId = cashier.id;
});

afterAll(async () => { await pool.end(); });

// ── GET /api/users ────────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });

  test('403 for Cashier (no users.view)', async () => {
    const r = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('200 returns user list for Corporate Admin', async () => {
    const r = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${caToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThanOrEqual(4);
    expect(r.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      roleId: expect.any(Number),
    });
  });

  test('200 for Park Manager (has users.view)', async () => {
    const r = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
  });
});

// ── POST /api/users ───────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  test('400 when required fields missing', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ name: 'Test', email: 'new@test.com' }); // missing password and role_id
    expect(r.status).toBe(400);
  });

  test('201 creates user for Super Admin', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: 'New Cashier',
        email: 'newcashier@test.com',
        password: 'cashpass123',
        role_id: 5,
        park_ids: ['TP001'],
      });
    expect(r.status).toBe(201);
    expect(r.body.email).toBe('newcashier@test.com');
    expect(r.body.role_id).toBe(5);
    expect(r.body.parkIds).toContain('TP001');
  });

  test('409 on duplicate email', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: 'Dup User', email: 'newcashier@test.com',
        password: 'pass12345', role_id: 5,
      });
    expect(r.status).toBe(409);
  });

  test('403 privilege escalation: Corp Admin cannot create another Corp Admin', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        name: 'Another CA',
        email: 'aca@test.com',
        password: 'pass12345',
        role_id: 2, // Corporate Admin — same privilege as actor
      });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/privilege/i);
  });

  test('403 privilege escalation: Corp Admin cannot create Super Admin', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        name: 'New SA',
        email: 'newsa@test.com',
        password: 'pass12345',
        role_id: 1,
      });
    expect(r.status).toBe(403);
  });

  test('Corp Admin CAN create a Cashier (lower privilege)', async () => {
    const r = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        name: 'CA Creates Cashier',
        email: 'ca.creates.cashier@test.com',
        password: 'pass12345',
        role_id: 5,
      });
    expect(r.status).toBe(201);
  });
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
describe('PUT /api/users/:id', () => {
  let targetId;

  beforeAll(async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, role_id)
       VALUES (gen_random_uuid()::text, 'Edit Target', 'edit.target@test.com',
               '$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashfake', 'Cashier', 5)
       RETURNING id`
    );
    targetId = rows[0].id;
  });

  test('403 when Corp Admin tries to edit Park Manager (equal privilege?)', async () => {
    // Corp Admin (roleId=2) cannot edit Park Manager?
    // privilegeError: target.role_id=4, actor.role_id=2 → 4 > 2 → no error (can edit)
    // Actually Corp Admin CAN edit Park Manager (lower privilege)
    // Let's test Corp Admin CANNOT edit Super Admin (higher privilege)
    const r = await request(app).put(`/api/users/${saId}`)
      .set('Authorization', `Bearer ${caToken}`)
      .send({ name: 'Hacked Name' });
    expect(r.status).toBe(403);
  });

  test('200 Super Admin can edit any user', async () => {
    const r = await request(app).put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ name: 'Updated Name' });
    expect(r.status).toBe(200);
    expect(r.body.name).toBe('Updated Name');
  });

  test('200 updating park assignments returns fresh parkIds', async () => {
    const r = await request(app).put(`/api/users/${targetId}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ park_ids: ['TP001', 'TP002'] });
    expect(r.status).toBe(200);
    expect(r.body.parkIds).toHaveLength(2);
    expect(r.body.parkIds).toContain('TP001');
  });
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
describe('DELETE /api/users/:id', () => {
  test('400 when deleting own account', async () => {
    const r = await request(app).delete(`/api/users/${saId}`)
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/own account/i);
  });

  test('403 Corp Admin cannot delete Super Admin', async () => {
    const r = await request(app).delete(`/api/users/${saId}`)
      .set('Authorization', `Bearer ${caToken}`);
    expect(r.status).toBe(403);
  });

  test('200 Super Admin can delete lower-privilege user', async () => {
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, role_id)
       VALUES (gen_random_uuid()::text, 'To Delete', 'del.target@test.com',
               '$2b$10$fakehashfakehashfakehashfakehashfakehashfakehashfake', 'Cashier', 5)
       RETURNING id`
    );
    const r = await request(app).delete(`/api/users/${rows[0].id}`)
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  test('404 for non-existent user', async () => {
    const r = await request(app).delete(`/api/users/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(404);
  });
});
