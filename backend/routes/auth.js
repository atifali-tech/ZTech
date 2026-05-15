const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');

const router  = express.Router();
const SECRET  = process.env.JWT_SECRET || 'zingparks_dev_secret_change_in_prod';
const COOKIE  = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 };

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, park_id, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: user.id, email: user.email, name: user.name, role: user.role, parkId: user.park_id };
    const token   = jwt.sign(payload, SECRET, { expiresIn: '7d' });

    res.cookie('token', token, COOKIE);
    res.json({ user: payload });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth/change-password]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
