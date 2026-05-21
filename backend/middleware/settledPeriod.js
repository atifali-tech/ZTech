'use strict';
// Blocks ticket creation when the target settlement period is already locked.
// Reads park_id and visit_date from req.body; defaults visit_date to today.

module.exports = async function settledPeriod(req, res, next) {
  const pool    = req.app.locals.pool;
  const parkId  = req.body?.park_id;
  const rawDate = req.body?.visit_date;

  if (!parkId) return next(); // no park context — let downstream validation handle it

  const periodDate = rawDate
    ? new Date(rawDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  try {
    const { rows } = await pool.query(
      `SELECT locked FROM settlement_periods
        WHERE park_id = $1 AND period_date = $2
        LIMIT 1`,
      [parkId, periodDate],
    );

    if (rows.length && rows[0].locked) {
      return res.status(423).json({
        error: 'Settlement period is locked',
        detail: `The settlement period for park ${parkId} on ${periodDate} has been approved and locked. Ticket creation is not allowed for locked periods.`,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};
