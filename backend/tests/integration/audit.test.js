'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;
let saToken, pmToken, cashierToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.audit@test.com',  password: 'testpass123' });
  const pm      = await loginAs(pool, 'Park Manager', { email: 'pm.audit@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.audit@test.com' });

  saToken      = sa.token;
  pmToken      = pm.token;
  cashierToken = cashier.token;
});

afterAll(async () => { await pool.end(); });

// ── GET /api/rbac/audit-log ───────────────────────────────────────────────────
describe('GET /api/rbac/audit-log', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/rbac/audit-log')).status).toBe(401);
  });

  test('403 for Park Manager (no roles.view)', async () => {
    const r = await request(app).get('/api/rbac/audit-log')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(403);
  });

  test('403 for Cashier (no roles.view)', async () => {
    const r = await request(app).get('/api/rbac/audit-log')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('200 returns paginated audit log for Super Admin', async () => {
    const r = await request(app).get('/api/rbac/audit-log')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      pagination: { page: 1, limit: 50, total: expect.any(Number) },
      entries:    expect.any(Array),
    });
  });

  test('pagination params respected', async () => {
    const r = await request(app).get('/api/rbac/audit-log?page=1&limit=2')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.pagination.limit).toBe(2);
    expect(r.body.entries.length).toBeLessThanOrEqual(2);
  });
});

// ── Audit log capture via login ───────────────────────────────────────────────
describe('Audit log entries', () => {
  test('login creates auth.login audit entry', async () => {
    // Create a user and log in via API so the audit entry is written
    await loginAs(pool, 'Cashier', { email: 'audit.login@test.com', password: 'testpass123' });
    await request(app).post('/api/auth/login')
      .send({ email: 'audit.login@test.com', password: 'testpass123' });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE actor_email = 'audit.login@test.com' AND action = 'auth.login'
       ORDER BY created_at DESC LIMIT 1`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('auth.login');
  });

  test('failed login creates auth.login.failed audit entry', async () => {
    await request(app).post('/api/auth/login')
      .send({ email: 'nonexistent.audit@test.com', password: 'badpass' });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'auth.login.failed'
       ORDER BY created_at DESC LIMIT 1`
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  test('park creation creates park.create audit entry', async () => {
    await request(app).post('/api/parks')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ id: 'AUDIT1', name: 'Audit Test Park', city: 'City', state: 'State' });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'park.create' AND target_id = 'AUDIT1'`
    );
    expect(rows.length).toBe(1);
  });

  test('user creation creates user.create audit entry', async () => {
    await request(app).post('/api/users')
      .set('Authorization', `Bearer ${saToken}`)
      .send({
        name: 'Audit User', email: 'audit.user.create@test.com',
        password: 'pass12345', role_id: 5,
      });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'user.create'
       AND meta->>'email' = 'audit.user.create@test.com'`
    );
    expect(rows.length).toBe(1);
  });
});
