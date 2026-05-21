/**
 * In-process permission cache: roleId → Set<permissionName>
 * TTL = 5 minutes. Invalidated on role permission changes.
 */

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map(); // roleId → { perms: Set<string>, at: number }

async function getPermissions(pool, roleId) {
  if (roleId == null) return new Set();
  // Normalise to integer so invalidate(2) and cache.get(2) are consistent
  // regardless of whether roleId arrived as number or numeric string.
  const key = parseInt(roleId, 10);
  if (isNaN(key)) return new Set();

  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < CACHE_TTL) return entry.perms;

  const { rows } = await pool.query(
    `SELECT p.name
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1`,
    [key]
  );
  const perms = new Set(rows.map(r => r.name));
  cache.set(key, { perms, at: Date.now() });
  return perms;
}

function invalidate(roleId) {
  if (roleId != null) cache.delete(parseInt(roleId, 10));
  else cache.clear();
}

module.exports = { getPermissions, invalidate };
