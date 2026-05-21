'use strict';
// ═══════════════════════════════════════════════════════════════
// Unit tests for middleware pure logic
//
// Covers:
//   - requireAuth behaviour (already-authenticated, missing token, invalid JWT)
//   - parkScope behaviour (global roles, non-global, no user)
//   - privilegeError from users.js (role-based permission hierarchy)
//
// All logic is copied inline — no backend source files are required
// so that pg/jwt side-effects are never triggered.
// ═══════════════════════════════════════════════════════════════

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

// ─── Inline: requireAuth pure logic ──────────────────────────────────────────
//
// Original: backend/middleware/auth.js
// We replicate the control-flow decisions without actually calling jwt.verify.
// The JWT library's verify behaviour is simulated via a replaceable shim.

const SECRET = 'zingparks_dev_secret_change_in_prod';

function makeRequireAuth(jwtVerify) {
  return function requireAuth(req, res, next) {
    if (req.user) return next();

    const token =
      (req.cookies && req.cookies.token) ||
      (req.headers && req.headers.authorization
        ? req.headers.authorization.replace('Bearer ', '')
        : undefined);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
      req.user = jwtVerify(token, SECRET);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

// ─── Inline: parkScope pure logic ────────────────────────────────────────────
//
// Original: backend/middleware/parkScope.js
// We test the branching logic for global-role vs. scoped users.
// DB interaction (pool.query) is exercised in permCache tests instead.

const GLOBAL_ROLES = new Set(['Super Admin', 'Corporate Admin']);

async function parkScopeLogic(req, next) {
  if (!req.user) {
    req.scopedParkIds = null;
    return next();
  }
  if (GLOBAL_ROLES.has(req.user.role)) {
    req.scopedParkIds = null;
    return next();
  }

  // Simulate DB-resolved parks that were injected by the caller for these tests
  req.scopedParkIds = req._resolvedParkIds !== undefined ? req._resolvedParkIds : [];
  next();
}

// ─── Inline: privilegeError from users.js ────────────────────────────────────
//
// Original: backend/routes/users.js  (lines 12-19)
// Role IDs: 1=Super Admin, 2=Corporate Admin, 3=Park Admin, 4=Park Manager, …
// Lower numeric ID = higher privilege. null actorRoleId → treated as 99 (lowest).
// null targetRoleId → allow (unmigrated user).

function privilegeError(actorRoleId, targetRoleId) {
  if (targetRoleId == null) return null; // unmigrated target — allow
  const actor  = actorRoleId  || 99;    // null → lowest privilege
  const target = parseInt(targetRoleId);
  if (actor === 1) return null;          // Super Admin can manage everyone
  if (target <= actor) return 'Cannot assign or manage a user with equal or higher privileges';
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {
    _status: null,
    _body:   null,
    status(code) { this._status = code; return this; },
    json(body)   { this._body   = body; return this; },
  };
  return res;
}

// ─── Tests: requireAuth ───────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('calls next() immediately when req.user is already set', () => {
    const requireAuth = makeRequireAuth(() => { throw new Error('should not be called'); });
    const req  = { user: { id: 'u1', role: 'Park Manager' }, cookies: {}, headers: {} };
    const res  = makeRes();
    let called = false;
    requireAuth(req, res, () => { called = true; });
    assert.ok(called, 'next() should have been called');
    assert.strictEqual(res._status, null, 'res.status() should not have been called');
  });

  it('returns 401 when no token is present', () => {
    const requireAuth = makeRequireAuth(() => ({ id: 'u1' }));
    const req = { cookies: {}, headers: {} };
    const res = makeRes();
    requireAuth(req, res, () => { throw new Error('next() should not be called'); });
    assert.strictEqual(res._status, 401);
    assert.deepStrictEqual(res._body, { error: 'Not authenticated' });
  });

  it('returns 401 when the JWT token is invalid', () => {
    const requireAuth = makeRequireAuth(() => { throw new Error('invalid signature'); });
    const req = { cookies: { token: 'bad.token.here' }, headers: {} };
    const res = makeRes();
    requireAuth(req, res, () => { throw new Error('next() should not be called'); });
    assert.strictEqual(res._status, 401);
    assert.deepStrictEqual(res._body, { error: 'Invalid or expired token' });
  });

  it('reads token from Authorization header and calls next() on valid JWT', () => {
    const fakeUser = { id: 'u2', role: 'Park Manager' };
    const requireAuth = makeRequireAuth(() => fakeUser);
    const req = { cookies: {}, headers: { authorization: 'Bearer valid.token.here' } };
    const res = makeRes();
    let called = false;
    requireAuth(req, res, () => { called = true; });
    assert.ok(called, 'next() should have been called');
    assert.deepStrictEqual(req.user, fakeUser);
  });
});

// ─── Tests: parkScope ────────────────────────────────────────────────────────

describe('parkScope', () => {
  it('sets scopedParkIds = null for Super Admin', async () => {
    const req  = { user: { id: 'u1', role: 'Super Admin' } };
    let called = false;
    await parkScopeLogic(req, () => { called = true; });
    assert.strictEqual(req.scopedParkIds, null);
    assert.ok(called);
  });

  it('sets scopedParkIds = null for Corporate Admin', async () => {
    const req = { user: { id: 'u2', role: 'Corporate Admin' } };
    await parkScopeLogic(req, () => {});
    assert.strictEqual(req.scopedParkIds, null);
  });

  it('sets scopedParkIds to the user\'s park list for a non-global role', async () => {
    const parks = ['ZP001', 'ZP002'];
    const req   = { user: { id: 'u3', role: 'Park Manager' }, _resolvedParkIds: parks };
    await parkScopeLogic(req, () => {});
    assert.deepStrictEqual(req.scopedParkIds, ['ZP001', 'ZP002']);
  });

  it('sets scopedParkIds = [] for a non-global role with no parks', async () => {
    const req = { user: { id: 'u4', role: 'Park Manager' }, _resolvedParkIds: [] };
    await parkScopeLogic(req, () => {});
    assert.deepStrictEqual(req.scopedParkIds, []);
  });

  it('sets scopedParkIds = null when req.user is absent', async () => {
    const req = {};
    await parkScopeLogic(req, () => {});
    assert.strictEqual(req.scopedParkIds, null);
  });
});

// ─── Tests: privilegeError ───────────────────────────────────────────────────

describe('privilegeError (permission hierarchy from users.js)', () => {
  it('Super Admin (roleId=1) can manage anyone — returns null', () => {
    assert.strictEqual(privilegeError(1, 1),  null);
    assert.strictEqual(privilegeError(1, 2),  null);
    assert.strictEqual(privilegeError(1, 99), null);
  });

  it('Corporate Admin (roleId=2) cannot create Super Admin (target roleId=1)', () => {
    const result = privilegeError(2, 1);
    assert.ok(result !== null, 'should return an error string');
    assert.ok(typeof result === 'string');
  });

  it('Corporate Admin (roleId=2) cannot create another Corporate Admin (target roleId=2)', () => {
    const result = privilegeError(2, 2);
    assert.ok(result !== null, 'should return an error string');
  });

  it('Corporate Admin (roleId=2) can create Park Manager (target roleId=4) — returns null', () => {
    assert.strictEqual(privilegeError(2, 4), null);
  });

  it('Park Manager (roleId=4) cannot create Corporate Admin (target roleId=2)', () => {
    const result = privilegeError(4, 2);
    assert.ok(result !== null, 'should return an error string');
  });

  it('null actor roleId is treated as lowest privilege (99)', () => {
    // null actor cannot manage roleId 1, 2, or 99 (target <= 99)
    assert.ok(privilegeError(null, 1)  !== null);
    assert.ok(privilegeError(null, 2)  !== null);
    assert.ok(privilegeError(null, 99) !== null);
  });

  it('null target roleId is treated as allowed (unmigrated user)', () => {
    assert.strictEqual(privilegeError(2,  null), null);
    assert.strictEqual(privilegeError(4,  null), null);
    assert.strictEqual(privilegeError(99, null), null);
  });
});
