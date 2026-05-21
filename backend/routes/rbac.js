/**
 * RBAC management routes
 * GET  /api/rbac/roles              — list roles + their permissions
 * GET  /api/rbac/permissions        — list all permissions
 * PUT  /api/rbac/roles/:id/permissions — replace permissions for a role
 * GET  /api/rbac/audit-log          — paginated audit log
 */

const express          = require('express');
const router           = express.Router();
const requirePermission = require('../middleware/permission');
const permCache        = require('../lib/permCache');
const logAudit         = require('../lib/audit');

// ── GET /api/rbac/roles ───────────────────────────────────────────────────────
router.get('/roles', requirePermission('roles.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const [rolesResult, permResult] = await Promise.all([
      pool.query('SELECT id, name, description FROM roles ORDER BY id'),
      pool.query(`
        SELECT rp.role_id, p.id AS perm_id, p.name, p.label
        FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        ORDER BY rp.role_id, p.name
      `),
    ]);

    const permsByRole = {};
    for (const r of permResult.rows) {
      if (!permsByRole[r.role_id]) permsByRole[r.role_id] = [];
      permsByRole[r.role_id].push({ id: r.perm_id, name: r.name, label: r.label });
    }

    res.json(rolesResult.rows.map(r => ({
      id:          r.id,
      name:        r.name,
      description: r.description,
      permissions: permsByRole[r.id] || [],
    })));
  } catch (err) {
    console.error('[rbac/roles]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/rbac/permissions ─────────────────────────────────────────────────
router.get('/permissions', requirePermission('roles.view'), async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query('SELECT id, name, label FROM permissions ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('[rbac/permissions]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/rbac/roles/:id/permissions ───────────────────────────────────────
router.put('/roles/:id/permissions', requirePermission('roles.manage'), async (req, res) => {
  const { permissionIds } = req.body;
  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ error: 'permissionIds must be an array' });
  }

  const roleId = parseInt(req.params.id);
  if (isNaN(roleId)) return res.status(400).json({ error: 'Invalid role id' });

  const pool = req.app.locals.pool;
  try {
    // Prevent stripping all permissions from Super Admin (id=1)
    if (roleId === 1) return res.status(403).json({ error: 'Cannot modify Super Admin permissions' });

    await pool.query('BEGIN');
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    if (permissionIds.length > 0) {
      const values  = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}
         ON CONFLICT DO NOTHING`,
        [roleId, ...permissionIds]
      );
    }
    await pool.query('COMMIT');

    permCache.invalidate(roleId);
    await logAudit(pool, req.user, 'role.permissions.update', 'role', roleId, { permissionIds });

    res.json({ ok: true });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('[rbac/update-permissions]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/rbac/audit-log ───────────────────────────────────────────────────
router.get('/audit-log', requirePermission('roles.view'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;

  try {
    const [data, count] = await Promise.all([
      pool.query(
        `SELECT id, actor_id, actor_email, action, target_type, target_id, meta, created_at
         FROM audit_log
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM audit_log'),
    ]);

    res.json({
      pagination: { page, limit, total: count.rows[0].total },
      entries:    data.rows,
    });
  } catch (err) {
    console.error('[rbac/audit-log]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
