'use strict';

/**
 * Token version cache: userId → { version: int, at: timestamp }
 *
 * token_version is an integer stored on each user row.
 * It is incremented on logout and password change.
 * JWTs carry the version at issuance time (claim: tv).
 * requireAuth rejects tokens whose tv differs from the current DB version.
 *
 * TTL mirrors permCache (5 minutes). A revoked session remains valid for at
 * most 5 minutes while the cache entry lives — acceptable for this architecture.
 * Replace with Redis for sub-second revocation in multi-instance deployments.
 */

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map(); // userId → { version: int, at: number }

/**
 * Returns the current token_version for a user.
 * Falls back to 0 if the column doesn't exist yet (pre-migration path).
 */
async function getTokenVersion(pool, userId) {
  if (!userId) return 0;

  const entry = cache.get(userId);
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.version;

  try {
    const { rows } = await pool.query(
      'SELECT token_version FROM users WHERE id = $1',
      [userId]
    );
    const version = rows[0]?.token_version ?? 0;
    cache.set(userId, { version, at: Date.now() });
    return version;
  } catch (err) {
    if (err.code === '42703') return 0; // column doesn't exist yet — pre-migration
    throw err;
  }
}

/**
 * Increments token_version for a user and updates the cache immediately.
 * Call on logout and password change.
 */
async function incrementTokenVersion(pool, userId) {
  const { rows } = await pool.query(
    `UPDATE users SET token_version = token_version + 1
     WHERE id = $1 RETURNING token_version`,
    [userId]
  );
  const version = rows[0]?.token_version ?? 1;
  cache.set(userId, { version, at: Date.now() });
  return version;
}

/**
 * Evict one user's entry (pass userId) or clear all (pass nothing).
 * Called by tests via jest.setup.js or when you need hard invalidation.
 */
function invalidate(userId) {
  if (userId != null) cache.delete(userId);
  else cache.clear();
}

module.exports = { getTokenVersion, incrementTokenVersion, invalidate };
