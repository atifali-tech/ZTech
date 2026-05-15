const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router      = express.Router();
const requireAuth = require('../middleware/auth');

// ── GET /api/parks  (public — used by FilterBar) ──────────────────────────────
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query('SELECT * FROM parks ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('[parks/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/parks/:id ────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query('SELECT * FROM parks WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Park not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[parks/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/parks ───────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { name, city, state, capacity, latitude, longitude } = req.body;
  if (!name || !city || !state) return res.status(400).json({ error: 'name, city, state required' });

  const pool = req.app.locals.pool;
  try {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO parks (id, name, city, state, capacity, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, name, city, state, capacity || null, latitude || null, longitude || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Park name already exists' });
    console.error('[parks/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/parks/:id ────────────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const { name, city, state, capacity, latitude, longitude } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name      !== undefined) { sets.push(`name = $${idx++}`);      vals.push(name); }
    if (city      !== undefined) { sets.push(`city = $${idx++}`);      vals.push(city); }
    if (state     !== undefined) { sets.push(`state = $${idx++}`);     vals.push(state); }
    if (capacity  !== undefined) { sets.push(`capacity = $${idx++}`);  vals.push(capacity); }
    if (latitude  !== undefined) { sets.push(`latitude = $${idx++}`);  vals.push(latitude); }
    if (longitude !== undefined) { sets.push(`longitude = $${idx++}`); vals.push(longitude); }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE parks SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Park not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Park name already exists' });
    console.error('[parks/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/parks/:id ─────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rowCount } = await pool.query('DELETE FROM parks WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Park not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[parks/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
