'use strict';

const express        = require('express');
const bcrypt         = require('bcrypt');
const jwt            = require('jsonwebtoken');
const rateLimit      = require('express-rate-limit');
const logAudit       = require('../lib/audit');
const permCache      = require('../lib/permCache');
const sessionCache   = require('../lib/sessionCache');

const router = express.Router();

// SECRET validated at startup (lib/env.js) — no fallback.
const SECRET = process.env.JWT_SECRET;

// SEC-03: secure=true in production; sameSite=strict closes CSRF surface on HTTPS.
const COOKIE_BASE = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  secure:   process.env.NODE_ENV === 'production',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

// SEC-06: brute-force protection — 20 attempts per 15-minute window per IP.
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              20,
  standardHeaders:  true,
  legacyHeaders:    false,
  skip:             () => process.env.NODE_ENV === 'test',
  message:          { error: 'Too many login attempts. Please try again later.' },
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, u.park_id,
              u.password_hash, u.token_version,
              COALESCE(ARRAY_AGG(up.park_id) FILTER (WHERE up.park_id IS NOT NULL), '{}') AS park_ids
       FROM users u
       LEFT JOIN user_parks up ON up.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       GROUP BY u.id`,
      [email]
    );
    const user = rows[0];
    if (!user) {
      await logAudit(pool, { email }, 'auth.login.failed', 'user', null, { reason: 'user_not_found' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await logAudit(pool, { id: user.id, email: user.email }, 'auth.login.failed', 'user', user.id, { reason: 'wrong_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = {
      id:      user.id,
      email:   user.email,
      name:    user.name,
      role:    user.role,
      roleId:  user.role_id  || null,
      parkId:  user.park_id  || null,
      parkIds: user.park_ids || [],
      tv:      user.token_version ?? 0,   // RBAC-01: session invalidation version
    };
    const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE_BASE);
    await logAudit(pool, payload, 'auth.login', 'user', user.id, {});
    res.json({ user: payload });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// RBAC-01: Increments token_version so all existing JWTs for this user become invalid.
// Operates with or without a valid token — always clears the cookie.
router.post('/logout', async (req, res) => {
  const token = req.cookies?.token
    || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET);
      const pool = req.app.locals.pool;
      await sessionCache.incrementTokenVersion(pool, decoded.id);
      await logAudit(pool, decoded, 'auth.logout', 'user', decoded.id, {});
    } catch {
      // Expired or invalid token — clear the cookie anyway, no DB action needed.
    }
  }

  res.clearCookie('token', {
    httpOnly: true,
    sameSite: COOKIE_BASE.sameSite,
    secure:   COOKIE_BASE.secure,
  });
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, u.park_id,
              COALESCE(ARRAY_AGG(up.park_id) FILTER (WHERE up.park_id IS NOT NULL), '{}') AS park_ids
       FROM users u
       LEFT JOIN user_parks up ON up.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let permissions = [];
    try {
      const perms = await permCache.getPermissions(pool, user.role_id);
      permissions = [...perms];
    } catch { /* RBAC tables not migrated yet */ }

    res.json({
      user: {
        id:          user.id,
        email:       user.email,
        name:        user.name,
        role:        user.role,
        roleId:      user.role_id  || null,
        parkId:      user.park_id  || null,
        parkIds:     user.park_ids || [],
        permissions,
      },
    });
  } catch (err) {
    console.error('[auth/me]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
// RBAC-01: Invalidates all existing sessions after a successful password change.
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    // Invalidate all sessions for this user (logout from all devices)
    await sessionCache.incrementTokenVersion(pool, req.user.id);

    await logAudit(pool, req.user, 'auth.change_password', 'user', req.user.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth/change-password]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
