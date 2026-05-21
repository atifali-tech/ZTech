'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, createTestUser, resetDatabase } = require('../helpers/db');
const { loginAs, generateToken } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');

let pool, app;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);
  // Seed parks so user creation with park_id works
  for (const p of PARKS) {
    await pool.query(
      `INSERT INTO parks (id, name, city, state, color_hex) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [p.id, p.name, p.city, p.state, p.color_hex]
    );
  }
});

afterAll(async () => {
  await pool.end();
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  test('400 when email or password is missing', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'x@x.com' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/required/i);
  });

  test('401 for unknown email', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'ghost@test.com', password: 'pass' });
    expect(r.status).toBe(401);
  });

  test('401 for wrong password', async () => {
    await loginAs(pool, 'Cashier', { email: 'cashier.auth@test.com' });
    const r = await request(app).post('/api/auth/login')
      .send({ email: 'cashier.auth@test.com', password: 'wrongpass' });
    expect(r.status).toBe(401);
  });

  test('200 + user payload + cookie on valid credentials', async () => {
    await loginAs(pool, 'Park Manager', { email: 'pm.login@test.com', password: 'testpass123' });
    const r = await request(app).post('/api/auth/login')
      .send({ email: 'pm.login@test.com', password: 'testpass123' });
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ email: 'pm.login@test.com', roleId: 4 });
    expect(r.headers['set-cookie']).toBeDefined();
  });

  test('response includes correct roleId for Super Admin', async () => {
    await loginAs(pool, 'Super Admin', { email: 'sa.login@test.com', password: 'testpass123' });
    const r = await request(app).post('/api/auth/login')
      .send({ email: 'sa.login@test.com', password: 'testpass123' });
    expect(r.status).toBe(200);
    expect(r.body.user.roleId).toBe(1);
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  test('200 and clears cookie', async () => {
    const r = await request(app).post('/api/auth/logout');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    const setCookie = r.headers['set-cookie'] || [];
    const tokenCookie = setCookie.find(c => c.startsWith('token='));
    // Cookie should be cleared (either absent or has empty/expired value)
    if (tokenCookie) {
      expect(tokenCookie).toMatch(/token=;|Expires=Thu, 01 Jan 1970/i);
    }
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  test('401 without token', async () => {
    const r = await request(app).get('/api/auth/me');
    expect(r.status).toBe(401);
  });

  test('returns fresh user data including permissions', async () => {
    const { token, email } = await loginAs(pool, 'Corporate Admin', { email: 'ca.me@test.com' });
    const r = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ email: 'ca.me@test.com', roleId: 2 });
    expect(Array.isArray(r.body.user.permissions)).toBe(true);
    expect(r.body.user.permissions.length).toBeGreaterThan(0);
  });

  test('permissions include expected entries for Park Manager', async () => {
    const { token } = await loginAs(pool, 'Park Manager', { email: 'pm.me@test.com' });
    const r = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    const perms = r.body.user.permissions;
    expect(perms).toContain('dashboard.view');
    expect(perms).toContain('tickets.create');
    expect(perms).not.toContain('parks.delete');
  });

  test('404 if user was deleted after JWT was issued', async () => {
    const { token, id } = await loginAs(pool, 'Cashier', { email: 'deleted.me@test.com' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    const r = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(404);
  });
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
describe('POST /api/auth/change-password', () => {
  test('401 without auth', async () => {
    const r = await request(app).post('/api/auth/change-password')
      .send({ currentPassword: 'old', newPassword: 'newpass123' });
    expect(r.status).toBe(401);
  });

  test('400 when new password is too short', async () => {
    const { token } = await loginAs(pool, 'Cashier', { email: 'chpw.short@test.com' });
    const r = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'testpass123', newPassword: 'short' });
    expect(r.status).toBe(400);
  });

  test('401 when current password is wrong', async () => {
    const { token } = await loginAs(pool, 'Cashier', { email: 'chpw.wrong@test.com' });
    const r = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'badpassword', newPassword: 'newpass123' });
    expect(r.status).toBe(401);
  });

  test('200 on successful password change', async () => {
    const { token } = await loginAs(pool, 'Finance Head', { email: 'chpw.ok@test.com', password: 'testpass123' });
    const r = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'testpass123', newPassword: 'newpass456' });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});
