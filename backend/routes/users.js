const express = require('express');
const bcrypt  = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const router     = express.Router();
const requireAuth = require('../middleware/auth');

// All users routes require auth
router.use(requireAuth);

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.park_id, p.name AS park_name
       FROM users u LEFT JOIN parks p ON p.id = u.park_id
       ORDER BY u.name`
    );
    res.json(rows);
  } catch (err) {
    console.error('[users/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.park_id, p.name AS park_name
       FROM users u LEFT JOIN parks p ON p.id = u.park_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[users/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, password, role, park_id } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, role required' });
  const validRoles = ['Cashier', 'Park Admin', 'Super Admin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const pool = req.app.locals.pool;
  try {
    const hash = await bcrypt.hash(password, 10);
    const id   = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, park_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, park_id`,
      [id, name, email.toLowerCase(), hash, role, park_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[users/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { name, email, role, park_id, password } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets  = [];
    const vals  = [];
    let   idx   = 1;

    if (name)    { sets.push(`name = $${idx++}`);          vals.push(name); }
    if (email)   { sets.push(`email = $${idx++}`);         vals.push(email.toLowerCase()); }
    if (role)    { sets.push(`role = $${idx++}`);          vals.push(role); }
    if ('park_id' in req.body) { sets.push(`park_id = $${idx++}`); vals.push(park_id || null); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${idx++}`);
      vals.push(hash);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, park_id`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error('[users/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  const pool = req.app.locals.pool;
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[users/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
