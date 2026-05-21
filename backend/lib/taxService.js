'use strict';
// Tax rate lookup from gst_rates table.
// Falls back to 5%+5% (CGST+SGST) for any category not found — preserves
// existing behaviour for tickets that predate the configurable rates table.

const DEFAULT_RATE = { cgst_pct: 5, sgst_pct: 5, igst_pct: 0 };

/**
 * Look up the applicable GST rate for a category on a given date.
 * @param {import('pg').Pool} pool
 * @param {string} category  — e.g. 'Entry', 'F&B', 'Merchandise', 'Event'
 * @param {Date|string} date — the transaction date
 * @returns {Promise<{id:number, cgst_pct:number, sgst_pct:number, igst_pct:number}>}
 */
async function getRateForCategory(pool, category, date) {
  const txDate = date instanceof Date ? date.toISOString().slice(0, 10) : date;

  const { rows } = await pool.query(
    `SELECT id, cgst_pct, sgst_pct, igst_pct
       FROM gst_rates
      WHERE category = $1
        AND effective_from <= $2
        AND (effective_to IS NULL OR effective_to >= $2)
      ORDER BY effective_from DESC
      LIMIT 1`,
    [category, txDate],
  );

  if (rows.length) return rows[0];

  // Fall back to 'default' row, then hard-coded constant
  const { rows: def } = await pool.query(
    `SELECT id, cgst_pct, sgst_pct, igst_pct
       FROM gst_rates
      WHERE category = 'default'
        AND effective_from <= $1
        AND (effective_to IS NULL OR effective_to >= $1)
      ORDER BY effective_from DESC
      LIMIT 1`,
    [txDate],
  );

  return def.length ? def[0] : { id: null, ...DEFAULT_RATE };
}

/**
 * Calculate GST amounts for a base amount.
 * @param {number} baseAmount   — pre-tax amount
 * @param {object} rate         — {cgst_pct, sgst_pct, igst_pct}
 * @returns {{ cgst_amount, sgst_amount, igst_amount, total_tax, total_amount }}
 */
function calculateTax(baseAmount, rate) {
  const r = { ...DEFAULT_RATE, ...rate };
  const cgst = parseFloat(((baseAmount * r.cgst_pct) / 100).toFixed(2));
  const sgst = parseFloat(((baseAmount * r.sgst_pct) / 100).toFixed(2));
  const igst = parseFloat(((baseAmount * r.igst_pct) / 100).toFixed(2));
  return {
    cgst_amount:  cgst,
    sgst_amount:  sgst,
    igst_amount:  igst,
    total_tax:    parseFloat((cgst + sgst + igst).toFixed(2)),
    total_amount: parseFloat((baseAmount + cgst + sgst + igst).toFixed(2)),
  };
}

/**
 * One-call helper: fetch rate then compute tax.
 * @param {import('pg').Pool} pool
 * @param {number} baseAmount
 * @param {string} category
 * @param {Date|string} date
 * @returns {Promise<{rate_id, cgst_amount, sgst_amount, igst_amount, total_tax, total_amount}>}
 */
async function computeTax(pool, baseAmount, category, date) {
  const rate = await getRateForCategory(pool, category, date);
  return { rate_id: rate.id ?? null, ...calculateTax(baseAmount, rate) };
}

module.exports = { getRateForCategory, calculateTax, computeTax };
