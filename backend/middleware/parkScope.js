/**
 * parkScope middleware — injects req.scopedParkIds with a fresh DB lookup.
 *
 * null  → user sees all parks (Super Admin / Corporate Admin)
 * []    → user has no park access
 * [ids] → user can only see data from these park IDs
 *
 * Always fetches from DB (not JWT) so revoked park assignments are honoured
 * immediately rather than waiting for JWT expiry.
 *
 * Must run AFTER requireAuth.
 */

const GLOBAL_ROLES = new Set(['Super Admin', 'Corporate Admin']);

module.exports = async function parkScope(req, _res, next) {
  if (!req.user) {
    req.scopedParkIds = null;
    return next();
  }
  if (GLOBAL_ROLES.has(req.user.role)) {
    req.scopedParkIds = null;
    return next();
  }

  try {
    const { rows } = await req.app.locals.pool.query(
      'SELECT park_id FROM user_parks WHERE user_id = $1',
      [req.user.id]
    );
    req.scopedParkIds = rows.map(r => r.park_id);
  } catch (err) {
    if (err.code === '42P01') {
      // user_parks table not yet migrated — fall back to JWT payload
      req.scopedParkIds = req.user.parkIds || [];
    } else {
      console.error('[parkScope]', err.message);
      req.scopedParkIds = []; // deny on unexpected DB error — safe default
    }
  }
  next();
};
