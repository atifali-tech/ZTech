'use strict';
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase } = require('../helpers/db');
const { loginAs, generateToken } = require('../helpers/auth');

let pool, app;
let saToken, caToken, pmToken, cashierToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);
  const sa      = await loginAs(pool, 'Super Admin',    { email: 'sa.rbac@test.com' });
  const ca      = await loginAs(pool, 'Corporate Admin',{ email: 'ca.rbac@test.com' });
  const pm      = await loginAs(pool, 'Park Manager',   { email: 'pm.rbac@test.com' });
  const cashier = await loginAs(pool, 'Cashier',        { email: 'cs.rbac@test.com' });
  saToken      = sa.token;
  caToken      = ca.token;
  pmToken      = pm.token;
  cashierToken = cashier.token;
});

afterAll(async () => { await pool.end(); });

// ── GET /api/rbac/roles ───────────────────────────────────────────────────────
describe('GET /api/rbac/roles', () => {
  test('401 without token', async () => {
    expect((await request(app).get('/api/rbac/roles')).status).toBe(401);
  });

  test('403 for Cashier (no roles.view)', async () => {
    const r = await request(app).get('/api/rbac/roles')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
    expect(r.body.required).toBe('roles.view');
  });

  test('403 for Park Manager (no roles.view)', async () => {
    const r = await request(app).get('/api/rbac/roles')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(403);
  });

  test('200 returns roles array for Super Admin', async () => {
    const r = await request(app).get('/api/rbac/roles')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThanOrEqual(6);
    const sa = r.body.find(role => role.id === 1);
    expect(sa).toBeDefined();
    expect(sa.name).toBe('Super Admin');
    expect(Array.isArray(sa.permissions)).toBe(true);
  });
});

// ── GET /api/rbac/permissions ─────────────────────────────────────────────────
describe('GET /api/rbac/permissions', () => {
  test('200 returns all permissions for Super Admin', async () => {
    const r = await request(app).get('/api/rbac/permissions')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body.length).toBeGreaterThanOrEqual(20);
    expect(r.body[0]).toMatchObject({ id: expect.any(Number), name: expect.any(String) });
  });
});

// ── PUT /api/rbac/roles/:id/permissions ───────────────────────────────────────
describe('PUT /api/rbac/roles/:id/permissions', () => {
  test('401 without token', async () => {
    const r = await request(app).put('/api/rbac/roles/5/permissions').send({ permissionIds: [] });
    expect(r.status).toBe(401);
  });

  test('403 for Corporate Admin (no roles.manage)', async () => {
    const r = await request(app).put('/api/rbac/roles/5/permissions')
      .set('Authorization', `Bearer ${caToken}`)
      .send({ permissionIds: [] });
    expect(r.status).toBe(403);
  });

  test('400 when permissionIds is not an array', async () => {
    const r = await request(app).put('/api/rbac/roles/5/permissions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ permissionIds: 'not-array' });
    expect(r.status).toBe(400);
  });

  test('403 when trying to modify Super Admin (id=1)', async () => {
    const r = await request(app).put('/api/rbac/roles/1/permissions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ permissionIds: [] });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/Super Admin/i);
  });

  test('200 updates Cashier permissions and cache is cleared', async () => {
    // Get current cashier permissions
    const rolesRes = await request(app).get('/api/rbac/permissions')
      .set('Authorization', `Bearer ${saToken}`);
    const allPerms = rolesRes.body;
    const dashPerm = allPerms.find(p => p.name === 'dashboard.view');
    expect(dashPerm).toBeDefined();

    const r = await request(app).put('/api/rbac/roles/5/permissions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ permissionIds: [dashPerm.id] });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // Verify by fetching roles again — Cashier should now only have dashboard.view
    const rolesAfter = await request(app).get('/api/rbac/roles')
      .set('Authorization', `Bearer ${saToken}`);
    const cashierRole = rolesAfter.body.find(role => role.id === 5);
    expect(cashierRole.permissions).toHaveLength(1);
    expect(cashierRole.permissions[0].name).toBe('dashboard.view');

    // Restore standard Cashier permissions
    const stdPerms = allPerms
      .filter(p => ['dashboard.view','tickets.view','tickets.create'].includes(p.name))
      .map(p => p.id);
    await request(app).put('/api/rbac/roles/5/permissions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ permissionIds: stdPerms });
  });

  test('creates audit_log entry on permission update', async () => {
    const rolesRes = await request(app).get('/api/rbac/permissions')
      .set('Authorization', `Bearer ${saToken}`);
    const allPerms = rolesRes.body;
    const permIds = allPerms.filter(p =>
      ['dashboard.view','analytics.view'].includes(p.name)
    ).map(p => p.id);

    await request(app).put('/api/rbac/roles/6/permissions')
      .set('Authorization', `Bearer ${saToken}`)
      .send({ permissionIds: permIds });

    const { rows } = await pool.query(
      `SELECT * FROM audit_log WHERE action = 'role.permissions.update' AND target_id = '6'
       ORDER BY created_at DESC LIMIT 1`
    );
    expect(rows.length).toBe(1);
    expect(rows[0].meta.permissionIds).toEqual(expect.arrayContaining(permIds));
  });
});
