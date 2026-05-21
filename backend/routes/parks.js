const express           = require('express');
const requireAuth       = require('../middleware/auth');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');

const router = express.Router();

function generateParkId(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

// ── GET /api/parks ────────────────────────────────────────────────────────────
// Returns only parks the authenticated user is allowed to see.
// Global roles (Super Admin / Corporate Admin) see all parks.
router.get('/', [requireAuth, parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const scopedIds = req.scopedParkIds;
    let query  = 'SELECT id, name, city, state, color_hex, capacity FROM parks';
    const params = [];

    if (scopedIds !== null) {
      if (scopedIds.length === 0) return res.json([]);
      const phs = scopedIds.map((_, i) => `$${i + 1}`).join(', ');
      query += ` WHERE id IN (${phs})`;
      params.push(...scopedIds);
    }
    query += ' ORDER BY name';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[parks/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/parks/:id ────────────────────────────────────────────────────────
router.get('/:id', [...requirePermission('parks.view'), parkScope], async (req, res) => {
  const scopedIds = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(req.params.id)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      'SELECT id, name, city, state, color_hex, capacity FROM parks WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Park not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[parks/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/parks ───────────────────────────────────────────────────────────
router.post('/', requirePermission('parks.create'), async (req, res) => {
  const { id: providedId, name, city, state, color_hex = '#1D9E75', capacity } = req.body;
  if (!name || !city || !state) return res.status(400).json({ error: 'name, city, state required' });

  const id = (providedId || generateParkId(name)).slice(0, 10).toUpperCase();
  if (!id) return res.status(400).json({ error: 'Could not derive park id from name' });

  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `INSERT INTO parks (id, name, city, state, color_hex, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, city, state, color_hex, capacity`,
      [id, name, city, state, color_hex, capacity || null]
    );
    await logAudit(pool, req.user, 'park.create', 'park', id, { name, city, state });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Park ID or name already exists' });
    console.error('[parks/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/parks/:id ────────────────────────────────────────────────────────
router.put('/:id', requirePermission('parks.edit'), async (req, res) => {
  const { name, city, state, color_hex, capacity } = req.body;
  const pool = req.app.locals.pool;
  try {
    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name      !== undefined) { sets.push(`name = $${idx++}`);      vals.push(name); }
    if (city      !== undefined) { sets.push(`city = $${idx++}`);      vals.push(city); }
    if (state     !== undefined) { sets.push(`state = $${idx++}`);     vals.push(state); }
    if (color_hex !== undefined) { sets.push(`color_hex = $${idx++}`); vals.push(color_hex); }
    if (capacity  !== undefined) { sets.push(`capacity = $${idx++}`);  vals.push(capacity); }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE parks SET ${sets.join(', ')} WHERE id = $${idx}
       RETURNING id, name, city, state, color_hex, capacity`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Park not found' });
    await logAudit(pool, req.user, 'park.update', 'park', req.params.id, { name, city, state });
    res.json(rows[0]);
  } catch (err) {
    console.error('[parks/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/parks/:id ─────────────────────────────────────────────────────
router.delete('/:id', requirePermission('parks.delete'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows: tixCheck } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM tickets WHERE park_id = $1',
      [req.params.id]
    );
    if (tixCheck[0].cnt > 0) {
      return res.status(409).json({
        error: `Cannot delete park — ${tixCheck[0].cnt} ticket(s) exist. Archive instead.`,
      });
    }

    const { rowCount } = await pool.query('DELETE FROM parks WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Park not found' });
    await logAudit(pool, req.user, 'park.delete', 'park', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[parks/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
