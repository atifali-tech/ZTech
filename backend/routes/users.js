const express           = require('express');
const bcrypt            = require('bcrypt');
const { randomUUID: uuidv4 } = require('crypto');
const requirePermission = require('../middleware/permission');
const logAudit          = require('../lib/audit');

const router = express.Router();

// Role IDs: 1=Super Admin (highest privilege), 2=Corporate Admin, …, 6=Authority User
// A user cannot create, edit, or delete a user whose role_id is <= their own role_id,
// unless they are Super Admin (role_id=1).
const GLOBAL_ROLE_IDS = new Set([1, 2]);

function privilegeError(actorRoleId, targetRoleId) {
  if (targetRoleId == null) return null; // unmigrated target — allow
  const actor  = actorRoleId  || 99;    // null → lowest privilege
  const target = parseInt(targetRoleId);
  if (actor === 1) return null;          // Super Admin can manage everyone
  if (target <= actor) return 'Cannot assign or manage a user with equal or higher privileges';
  return null;
}

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', requirePermission('users.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, u.park_id, u.created_at,
              r.name AS role_name,
              COALESCE(ARRAY_AGG(up.park_id) FILTER (WHERE up.park_id IS NOT NULL), '{}') AS park_ids,
              COALESCE(ARRAY_AGG(p.name)     FILTER (WHERE p.name IS NOT NULL),     '{}') AS park_names
       FROM users u
       LEFT JOIN roles r      ON r.id      = u.role_id
       LEFT JOIN user_parks up ON up.user_id = u.id
       LEFT JOIN parks p       ON p.id      = up.park_id
       GROUP BY u.id, r.name
       ORDER BY u.name`
    );
    res.json(rows.map(u => ({
      id:        u.id,
      name:      u.name,
      email:     u.email,
      role:      u.role,
      roleId:    u.role_id,
      roleName:  u.role_name || u.role,
      parkId:    u.park_id,
      parkIds:   u.park_ids,
      parkNames: u.park_names,
      createdAt: u.created_at,
    })));
  } catch (err) {
    console.error('[users/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', requirePermission('users.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, u.park_id, u.created_at,
              r.name AS role_name,
              COALESCE(ARRAY_AGG(up.park_id) FILTER (WHERE up.park_id IS NOT NULL), '{}') AS park_ids
       FROM users u
       LEFT JOIN roles r       ON r.id       = u.role_id
       LEFT JOIN user_parks up ON up.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id, r.name`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const u = rows[0];
    res.json({
      id: u.id, name: u.name, email: u.email,
      role: u.role, roleId: u.role_id, roleName: u.role_name || u.role,
      parkId: u.park_id, parkIds: u.park_ids, createdAt: u.created_at,
    });
  } catch (err) {
    console.error('[users/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', requirePermission('users.create'), async (req, res) => {
  const { name, email, password, role_id } = req.body;
  const requestedParkIds = Array.isArray(req.body.park_ids) ? req.body.park_ids.filter(Boolean) : [];
  if (!name || !email || !password || !role_id) {
    return res.status(400).json({ error: 'name, email, password, role_id required' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const pool = req.app.locals.pool;
  try {
    // Validate target role exists
    const roleCheck = await pool.query('SELECT id, name FROM roles WHERE id = $1', [role_id]);
    if (!roleCheck.rows[0]) return res.status(400).json({ error: 'Invalid role_id' });
    const roleName = roleCheck.rows[0].name;

    // Privilege escalation guard: actor cannot create a user with higher or equal privilege
    const privErr = privilegeError(req.user.roleId, parseInt(role_id));
    if (privErr) return res.status(403).json({ error: privErr });

    const park_ids = GLOBAL_ROLE_IDS.has(parseInt(role_id)) ? [] : requestedParkIds;
    if (park_ids.length) {
      const { rows: validParks } = await pool.query(
        'SELECT id::text AS id FROM parks WHERE id::text = ANY($1::text[])',
        [park_ids]
      );
      const validSet = new Set(validParks.map(p => p.id));
      const invalid = park_ids.filter(id => !validSet.has(id));
      if (invalid.length) {
        return res.status(400).json({ error: `Invalid park access: ${invalid.join(', ')}` });
      }
    }

    const hash        = await bcrypt.hash(password, 10);
    const id          = uuidv4();
    const primaryPark = park_ids[0] || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, role_id, park_id, token_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
         RETURNING id, name, email, role, role_id, park_id`,
        [id, name, email.toLowerCase(), hash, roleName, role_id, primaryPark]
      );

      for (const parkId of park_ids) {
        await client.query(
          `INSERT INTO user_parks (user_id, park_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, parkId]
        );
      }

      await logAudit(client, req.user, 'user.create', 'user', id, { email, role: roleName, park_ids });
      await client.query('COMMIT');
      res.status(201).json({ ...rows[0], parkIds: park_ids });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'One or more selected parks are invalid' });
    console.error('[users/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
router.put('/:id', requirePermission('users.edit'), async (req, res) => {
  const { name, email, role_id, park_ids, password } = req.body;
  const pool = req.app.locals.pool;
  try {
    // Fetch target user's current role for privilege check
    const targetCheck = await pool.query('SELECT id, role_id FROM users WHERE id = $1', [req.params.id]);
    if (!targetCheck.rows[0]) return res.status(404).json({ error: 'User not found' });

    // Actor cannot edit a user with equal or higher privilege than their own
    const currentRoleErr = privilegeError(req.user.roleId, targetCheck.rows[0].role_id);
    if (currentRoleErr) return res.status(403).json({ error: currentRoleErr });

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name)  { sets.push(`name = $${idx++}`);  vals.push(name); }
    if (email) { sets.push(`email = $${idx++}`); vals.push(email.toLowerCase()); }

    if (role_id != null) {
      const roleCheck = await pool.query('SELECT name FROM roles WHERE id = $1', [role_id]);
      if (!roleCheck.rows[0]) return res.status(400).json({ error: 'Invalid role_id' });

      // Privilege escalation: cannot elevate target to a role with higher/equal privilege than actor
      const newRoleErr = privilegeError(req.user.roleId, parseInt(role_id));
      if (newRoleErr) return res.status(403).json({ error: newRoleErr });

      sets.push(`role = $${idx++}`);    vals.push(roleCheck.rows[0].name);
      sets.push(`role_id = $${idx++}`); vals.push(role_id);
    }

    const effectiveParkIds = GLOBAL_ROLE_IDS.has(parseInt(role_id ?? targetCheck.rows[0].role_id))
      ? []
      : park_ids;

    if (Array.isArray(effectiveParkIds)) {
      if (effectiveParkIds.length) {
        const { rows: validParks } = await pool.query(
          'SELECT id::text AS id FROM parks WHERE id::text = ANY($1::text[])',
          [effectiveParkIds]
        );
        const validSet = new Set(validParks.map(p => p.id));
        const invalid = effectiveParkIds.filter(id => !validSet.has(id));
        if (invalid.length) {
          return res.status(400).json({ error: `Invalid park access: ${invalid.join(', ')}` });
        }
      }
      const primary = effectiveParkIds[0] || null;
      sets.push(`park_id = $${idx++}`); vals.push(primary);
    }

    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      sets.push(`password_hash = $${idx++}`); vals.push(await bcrypt.hash(password, 10));
    }

    let user;
    if (sets.length) {
      vals.push(req.params.id);
      const { rows } = await pool.query(
        `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, name, email, role, role_id, park_id`,
        vals
      );
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      user = rows[0];
    } else {
      const { rows } = await pool.query(
        'SELECT id, name, email, role, role_id, park_id FROM users WHERE id = $1',
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'User not found' });
      user = rows[0];
    }

    if (Array.isArray(effectiveParkIds)) {
      await pool.query('DELETE FROM user_parks WHERE user_id = $1', [req.params.id]);
      for (const parkId of effectiveParkIds) {
        await pool.query(
          `INSERT INTO user_parks (user_id, park_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [req.params.id, parkId]
        );
      }
    }

    // Fetch current park assignments for accurate response (park_ids may not have been updated)
    const { rows: freshParks } = await pool.query(
      'SELECT park_id FROM user_parks WHERE user_id = $1',
      [req.params.id]
    );
    const currentParkIds = freshParks.map(r => r.park_id);

    await logAudit(pool, req.user, 'user.update', 'user', req.params.id, { park_ids: effectiveParkIds });
    res.json({ ...user, parkIds: currentParkIds });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    if (err.code === '23503') return res.status(400).json({ error: 'One or more selected parks are invalid' });
    console.error('[users/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', requirePermission('users.delete'), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const pool = req.app.locals.pool;
  try {
    // Fetch target role before deletion for privilege check
    const { rows: targetRows } = await pool.query(
      'SELECT role_id FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!targetRows[0]) return res.status(404).json({ error: 'User not found' });

    const privErr = privilegeError(req.user.roleId, targetRows[0].role_id);
    if (privErr) return res.status(403).json({ error: privErr });

    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    await logAudit(pool, req.user, 'user.delete', 'user', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[users/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
