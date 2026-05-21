'use strict';

const jwt          = require('jsonwebtoken');
const sessionCache = require('../lib/sessionCache');

// SECRET is validated at startup (lib/env.js) — no fallback.
const SECRET = process.env.JWT_SECRET;

/**
 * requireAuth — verifies JWT signature then validates token version.
 *
 * Token version check (RBAC-01):
 *   JWTs carry claim `tv` (token version). On logout or password change
 *   the user's token_version in DB is incremented. Any token with an
 *   outdated `tv` is rejected immediately.
 *
 * Backward compat:
 *   Tokens issued before the tv feature (no `tv` claim) are allowed through
 *   until they expire naturally (7-day window). Once a new token is issued
 *   after server upgrade, the old one is invalidated on next logout/pw-change.
 *
 * DB unavailability:
 *   If the version check DB query fails, the middleware falls through rather
 *   than locking out all users. This is the safe-open choice for auth
 *   infrastructure failures; monitor [auth] warnings in logs.
 */
module.exports = async function requireAuth(req, res, next) {
  // Already authenticated by an earlier middleware in the chain (e.g. permission.js)
  if (req.user) return next();

  const token = req.cookies?.token
    || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Token version validation — skip if claim absent (pre-upgrade tokens)
  if (decoded.tv !== undefined) {
    try {
      const pool = req.app.locals.pool;
      const currentVersion = await sessionCache.getTokenVersion(pool, decoded.id);
      if (decoded.tv !== currentVersion) {
        return res.status(401).json({ error: 'Session has been invalidated. Please log in again.' });
      }
    } catch (err) {
      // Pre-migration (42703 = undefined_column) and transient DB errors fall through.
      console.warn('[auth] token version check failed:', err.message);
    }
  }

  req.user = decoded;
  next();
};
