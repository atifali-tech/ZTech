'use strict';
// Finance utility functions for reconciliation and settlement computations.

const SEVERITY_THRESHOLDS = {
  critical: 0.10,  // >= 10% variance
  high:     0.05,  // >= 5%
  medium:   0.02,  // >= 2%
  // below 2% = low
};

/**
 * Classify variance severity based on percentage difference.
 * @param {number} expected
 * @param {number} actual
 * @returns {'low'|'medium'|'high'|'critical'}
 */
function classifyVarianceSeverity(expected, actual) {
  if (expected === 0 && actual === 0) return 'low';
  const base = expected !== 0 ? Math.abs(expected) : Math.abs(actual);
  const pct  = Math.abs(actual - expected) / base;
  if (pct >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (pct >= SEVERITY_THRESHOLDS.high)     return 'high';
  if (pct >= SEVERITY_THRESHOLDS.medium)   return 'medium';
  return 'low';
}

/**
 * Compute expected settlement revenue for a park on a given date
 * from the tickets table (source of truth).
 *
 * Excludes:
 *   - Cancelled tickets
 *   - Reversal tickets (is_reversal = true) — these offset the originals in accounting
 *
 * @param {import('pg').Pool} pool
 * @param {number} parkId
 * @param {string} date  — 'YYYY-MM-DD'
 * @returns {Promise<{
 *   expected_rev: number,
 *   ticket_count: number,
 *   cash_total: number,
 *   upi_total: number,
 *   card_total: number,
 *   split_total: number,
 * }>}
 */
async function computeSettlementExpected(pool, parkId, date) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(total_amount), 0)                                   AS expected_rev,
       COUNT(*)                                                          AS ticket_count,
       COALESCE(SUM(CASE WHEN payment_mode = 'Cash'  THEN total_amount ELSE 0 END), 0) AS cash_total,
       COALESCE(SUM(CASE WHEN payment_mode = 'UPI'   THEN total_amount ELSE 0 END), 0) AS upi_total,
       COALESCE(SUM(CASE WHEN payment_mode = 'Card'  THEN total_amount ELSE 0 END), 0) AS card_total,
       COALESCE(SUM(CASE WHEN payment_mode = 'Split' THEN total_amount ELSE 0 END), 0) AS split_total
     FROM tickets
    WHERE park_id = $1
      AND DATE(visit_date) = $2
      AND status != 'Cancelled'
      AND (is_reversal IS NULL OR is_reversal = FALSE)`,
    [parkId, date],
  );
  const r = rows[0];
  return {
    expected_rev: parseFloat(r.expected_rev),
    ticket_count: parseInt(r.ticket_count, 10),
    cash_total:   parseFloat(r.cash_total),
    upi_total:    parseFloat(r.upi_total),
    card_total:   parseFloat(r.card_total),
    split_total:  parseFloat(r.split_total),
  };
}

/**
 * Compare expected vs. actual revenue and build a variance summary.
 * @param {number} expected
 * @param {number} actual
 * @returns {{ variance: number, variance_pct: number, severity: string, within_tolerance: boolean }}
 */
function computeVariance(expected, actual) {
  const variance     = parseFloat((actual - expected).toFixed(2));
  const base         = expected !== 0 ? expected : (actual || 1);
  const variance_pct = parseFloat(((variance / base) * 100).toFixed(4));
  const severity     = classifyVarianceSeverity(expected, actual);
  return { variance, variance_pct, severity, within_tolerance: severity === 'low' };
}

/**
 * Build a list of exception objects for tickets that don't match expected state.
 * @param {Array<{id, total_amount, payment_mode, status}>} tickets
 * @param {Array<{ticket_id, expected_amount}>} expectedEntries
 * @returns {Array<{ticket_id, exception_type, severity, expected_amt, actual_amt, variance}>}
 */
function detectExceptions(tickets, expectedEntries) {
  const expectedMap = new Map(expectedEntries.map(e => [e.ticket_id, e.expected_amount]));
  const exceptions  = [];

  for (const t of tickets) {
    const expected = expectedMap.get(t.id);
    if (expected === undefined) {
      exceptions.push({
        ticket_id:      t.id,
        exception_type: 'missing_payment',
        severity:       classifyVarianceSeverity(t.total_amount, 0),
        expected_amt:   t.total_amount,
        actual_amt:     0,
        variance:       -t.total_amount,
      });
      continue;
    }
    if (Math.abs(t.total_amount - expected) > 0.01) {
      exceptions.push({
        ticket_id:      t.id,
        exception_type: 'amount_mismatch',
        severity:       classifyVarianceSeverity(expected, t.total_amount),
        expected_amt:   expected,
        actual_amt:     t.total_amount,
        variance:       parseFloat((t.total_amount - expected).toFixed(2)),
      });
    }
  }

  return exceptions;
}

module.exports = {
  classifyVarianceSeverity,
  computeSettlementExpected,
  computeVariance,
  detectExceptions,
};
