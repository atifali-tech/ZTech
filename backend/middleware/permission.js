/**
 * requirePermission(perm) — Express middleware factory.
 * Returns [requireAuth, asyncGuard] — compose both in a single array.
 *
 * Usage:
 *   router.get('/sensitive', requirePermission('analytics.view'), handler)
 *   router.use(requirePermission('dashboard.view'))
 */

const requireAuth = require('./auth');
const permCache   = require('../lib/permCache');

function requirePermission(perm) {
  return [
    requireAuth,
    async (req, res, next) => {
      try {
        const perms = await permCache.getPermissions(req.app.locals.pool, req.user.roleId);
        if (!perms.has(perm)) {
          return res.status(403).json({ error: 'Permission denied', required: perm });
        }
        next();
      } catch (err) {
        // If RBAC tables don't exist yet (pre-migration), fall through gracefully
        if (err.code === '42P01') return next(); // undefined_table
        console.error('[permission]', err.message);
        res.status(500).json({ error: 'Server error' });
      }
    },
  ];
}

module.exports = requirePermission;
