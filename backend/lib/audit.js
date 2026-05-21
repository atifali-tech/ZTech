/**
 * Write an audit log entry. Non-fatal — never throws.
 * @param {object} pool   - pg Pool
 * @param {object} actor  - { id, email } from req.user
 * @param {string} action - e.g. 'user.create', 'park.delete'
 * @param {string} targetType - 'user' | 'park' | 'role' | ...
 * @param {string} targetId   - the ID of the affected record
 * @param {object} meta       - arbitrary JSON (before/after values, etc.)
 */
async function logAudit(pool, actor, action, targetType, targetId, meta = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        actor?.id   || null,
        actor?.email || null,
        action,
        targetType || null,
        targetId   != null ? String(targetId) : null,
        JSON.stringify(meta),
      ]
    );
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

module.exports = logAudit;
