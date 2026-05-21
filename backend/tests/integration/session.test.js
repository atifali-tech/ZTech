'use strict';
/**
 * session.test.js — token invalidation and session lifecycle tests.
 *
 * Validates Phase 10 RBAC-01: logout and password change increment token_version,
 * causing previously issued JWTs to be rejected by requireAuth.
 */
const request      = require('supertest');
const jwt          = require('jsonwebtoken');
const createApp    = require('../../app');
const sessionCache = require('../../lib/sessionCache');
const { createTestPool, resetDatabase, createTestPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { loginAndGetToken, assertAuditEntry } = require('../utils/testHelpers');
const { PARKS } = require('../fixtures/seeds');

const SECRET = process.env.JWT_SECRET;

let pool, app;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);
  for (const p of PARKS) await createTestPark(pool, p);
});

afterAll(async () => { await pool.end(); });

// ── Logout invalidates token ──────────────────────────────────────────────────
describe('Logout — session invalidation', () => {
  test('old token rejected as 401 immediately after logout', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.logout1@test.com', password: 'testpass123' });
    const token = await loginAndGetToken(app, email);

    // Confirm token works before logout
    let r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);

    // Logout
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

    // Same token must now be rejected
    r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/invalidat/i);
  });

  test('logout without any token returns 200 (no crash)', async () => {
    const r = await request(app).post('/api/auth/logout');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  test('logout with already-expired JWT returns 200 (graceful)', async () => {
    // Sign a token that is already past its expiry
    const expired = jwt.sign({ id: 'ghost', email: 'x@x.com', tv: 0 }, SECRET, { expiresIn: '-1s' });
    const r = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${expired}`);
    expect(r.status).toBe(200);
  });

  test('logout writes an audit entry', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.audit@test.com', password: 'testpass123' });
    const token = await loginAndGetToken(app, email);
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    await assertAuditEntry(pool, { action: 'auth.logout', actorEmail: email });
  });
});

// ── Password change invalidates sessions ─────────────────────────────────────
describe('Password change — session invalidation', () => {
  test('old token rejected after password change', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.chpw1@test.com', password: 'testpass123' });
    const oldToken = await loginAndGetToken(app, email);

    // Confirm old token works
    let r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(r.status).toBe(200);

    // Change password (this increments token_version)
    r = await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'testpass123', newPassword: 'newpass456' });
    expect(r.status).toBe(200);

    // Old token must now be rejected
    r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/invalidat/i);
  });

  test('new token obtained after password change works', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.chpw2@test.com', password: 'testpass123' });
    const oldToken = await loginAndGetToken(app, email);

    await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'testpass123', newPassword: 'newpass789' });

    // Login with new password → new token
    const newToken = await loginAndGetToken(app, email, 'newpass789');
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${newToken}`);
    expect(r.status).toBe(200);
  });

  test('simulated second session token rejected after password change', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.chpw3@test.com', password: 'testpass123' });

    // Two independent logins → two tokens
    const token1 = await loginAndGetToken(app, email);
    const token2 = await loginAndGetToken(app, email);

    // Change password using token1
    await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token1}`)
      .send({ currentPassword: 'testpass123', newPassword: 'multidev999' });

    // token2 (the "other device") must also be rejected
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token2}`);
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/invalidat/i);
  });
});

// ── Token integrity checks ────────────────────────────────────────────────────
describe('Token integrity', () => {
  test('token signed with wrong secret returns 401', async () => {
    const badToken = jwt.sign({ id: 'u1', email: 'x@x.com', role: 'Cashier', roleId: 5 }, 'wrong-secret-entirely');
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${badToken}`);
    expect(r.status).toBe(401);
  });

  test('expired token returns 401', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.expired@test.com' });
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const expired = jwt.sign({ id: rows[0].id, email, role: 'Cashier', roleId: 5, tv: 0 }, SECRET, { expiresIn: '-1s' });
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(r.status).toBe(401);
  });

  test('token without tv claim passes through (pre-upgrade backward compat)', async () => {
    // loginAs helper generates tokens without tv — these represent pre-Phase-10 tokens
    const { token } = await loginAs(pool, 'Cashier', { email: 'sess.notvlaim@test.com' });
    // Token has no tv claim — should still be accepted
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
  });

  test('token with stale tv (manually incremented DB version) returns 401', async () => {
    const { email } = await loginAs(pool, 'Cashier', { email: 'sess.staletv@test.com', password: 'testpass123' });
    const token = await loginAndGetToken(app, email); // tv = 0

    // Manually bump token_version in DB (simulates server-side admin invalidation)
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = rows[0].id;
    await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [userId]);
    // Clear in-process cache so requireAuth fetches the updated version from DB
    sessionCache.invalidate(userId);

    // Token still has tv=0 but DB now has tv=1 → reject
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(r.body.error).toMatch(/invalidat/i);
  });
});
