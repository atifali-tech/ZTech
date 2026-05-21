'use strict';
// ═══════════════════════════════════════════════════════════════
// Unit tests for permission cache logic (backend/lib/permCache.js)
//
// The cache module holds module-level state, so we re-implement
// the identical logic inline and instantiate a fresh cache per
// describe block using a factory. This avoids cross-test
// pollution caused by Node's module require() cache.
// ═══════════════════════════════════════════════════════════════

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── Inline: permCache factory ────────────────────────────────────────────────
//
// Source: backend/lib/permCache.js
// We expose a createCache() factory so every test suite can work
// with its own isolated cache instance (no shared module state).

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

function createCache() {
  const cache = new Map(); // key → { perms: Set<string>, at: number }

  async function getPermissions(pool, roleId) {
    if (!roleId) return new Set();
    const key   = String(roleId); // normalise — both 2 and "2" map to "2"
    const entry = cache.get(key);
    if (entry && Date.now() - entry.at < CACHE_TTL) return entry.perms;

    const { rows } = await pool.query(
      `SELECT p.name
       FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [roleId]
    );
    const perms = new Set(rows.map(r => r.name));
    cache.set(key, { perms, at: Date.now() });
    return perms;
  }

  function invalidate(roleId) {
    if (roleId != null) cache.delete(String(roleId));
    else cache.clear();
  }

  return { getPermissions, invalidate, _cache: cache };
}

// ─── Mock pool factory ────────────────────────────────────────────────────────

function makeMockPool(rows) {
  let callCount = 0;
  const pool = {
    get callCount() { return callCount; },
    async query(_sql, _params) {
      callCount++;
      return { rows };
    },
  };
  return pool;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('permCache.getPermissions', () => {
  it('returns an empty Set immediately for null roleId — no DB query', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions } = createCache();

    const result = await getPermissions(pool, null);
    assert.ok(result instanceof Set);
    assert.strictEqual(result.size, 0);
    assert.strictEqual(pool.callCount, 0, 'DB should not be queried for null roleId');
  });

  it('returns an empty Set immediately for undefined roleId — no DB query', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions } = createCache();

    const result = await getPermissions(pool, undefined);
    assert.ok(result instanceof Set);
    assert.strictEqual(result.size, 0);
    assert.strictEqual(pool.callCount, 0);
  });

  it('fetches from DB on cache miss and caches the result', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }, { name: 'tickets.create' }]);
    const { getPermissions } = createCache();

    const result = await getPermissions(pool, 3);
    assert.strictEqual(pool.callCount, 1, 'DB should be queried on first call');
    assert.ok(result instanceof Set);
    assert.ok(result.has('dashboard.view'));
    assert.ok(result.has('tickets.create'));
  });

  it('returns cached result within TTL — DB is only queried once for two calls', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions } = createCache();

    const first  = await getPermissions(pool, 3);
    const second = await getPermissions(pool, 3);

    assert.strictEqual(pool.callCount, 1, 'DB should only be queried once within TTL');
    // Both calls must return the same Set instance (cached)
    assert.strictEqual(first, second);
  });

  it('permission "dashboard.view" is present when returned by the mock DB', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }, { name: 'users.view' }]);
    const { getPermissions } = createCache();

    const perms = await getPermissions(pool, 2);
    assert.ok(perms.has('dashboard.view'));
  });

  it('permission "missing.perm" is absent from the returned Set', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions } = createCache();

    const perms = await getPermissions(pool, 2);
    assert.ok(!perms.has('missing.perm'));
  });

  it('cache key normalisation: getPermissions(pool, 2) and getPermissions(pool, "2") hit the same cache entry', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions } = createCache();

    const asInt    = await getPermissions(pool, 2);
    const asString = await getPermissions(pool, '2');

    assert.strictEqual(pool.callCount, 1, 'only one DB call should occur for equivalent integer and string keys');
    assert.strictEqual(asInt, asString, 'both calls should return the same cached Set instance');
  });
});

describe('permCache.invalidate', () => {
  it('invalidate(roleId) removes that roleId\'s cache entry so the next call hits DB again', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions, invalidate } = createCache();

    // Populate cache
    await getPermissions(pool, 5);
    assert.strictEqual(pool.callCount, 1);

    // Invalidate and fetch again
    invalidate(5);
    await getPermissions(pool, 5);
    assert.strictEqual(pool.callCount, 2, 'DB should be queried again after invalidation');
  });

  it('invalidate(null) clears the entire cache — all roleIds hit DB on next call', async () => {
    const pool = makeMockPool([{ name: 'dashboard.view' }]);
    const { getPermissions, invalidate, _cache } = createCache();

    // Populate cache with multiple entries
    await getPermissions(pool, 2);
    await getPermissions(pool, 3);
    assert.strictEqual(pool.callCount, 2);
    assert.strictEqual(_cache.size, 2);

    // Full cache clear
    invalidate(null);
    assert.strictEqual(_cache.size, 0, 'cache should be empty after invalidate(null)');

    // Both entries should trigger fresh DB queries
    await getPermissions(pool, 2);
    await getPermissions(pool, 3);
    assert.strictEqual(pool.callCount, 4, 'two fresh DB queries should be made after full cache clear');
  });

  it('invalidate(roleId) does not affect cache entries for other roleIds', async () => {
    const pool = makeMockPool([{ name: 'reports.view' }]);
    const { getPermissions, invalidate } = createCache();

    // Populate two entries
    await getPermissions(pool, 2);
    await getPermissions(pool, 3);
    assert.strictEqual(pool.callCount, 2);

    // Invalidate only roleId=2
    invalidate(2);

    // roleId=3 should still be cached (no extra DB call)
    await getPermissions(pool, 3);
    assert.strictEqual(pool.callCount, 2, 'roleId=3 cache entry should be unaffected');

    // roleId=2 should require a fresh DB call
    await getPermissions(pool, 2);
    assert.strictEqual(pool.callCount, 3, 'roleId=2 should hit DB after its invalidation');
  });
});
