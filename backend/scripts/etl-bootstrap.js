'use strict';

/**
 * ETL Bootstrap — populates all analytics tables from the tickets table.
 *
 * Safe to run multiple times: all inserts use ON CONFLICT DO UPDATE.
 * Run after migration 002 has been applied.
 *
 * Usage:
 *   node backend/scripts/etl-bootstrap.js
 *   node backend/scripts/etl-bootstrap.js --dry-run   (reports counts without writing)
 *
 * Tables populated:
 *   visitor_demographics  — from tickets.age_category + tickets.gender
 *   revenue_categories    — 'Tickets' category from tickets; ancillary categories zeroed
 *   quarterly_revenue     — from tickets grouped by year/quarter
 *   monthly_revenue       — from tickets grouped by year/month
 *   revenue_trend         — from tickets grouped by park_id/year/month
 *
 * Tables that read directly from tickets (no ETL needed):
 *   /kpis, /today-stats, /hourly, /busiest-by-park, /heatmap,
 *   /weekend-weekday, /top-parks-revenue — all live-query tickets.
 */

const path   = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Age category → demographics age_group mapping ───────────────────────────
// tickets.age_category → visitor_demographics.age_group
const AGE_GROUP_CASE = `
  CASE t.age_category
    WHEN 'Toddler'        THEN '0-12'
    WHEN 'Child'          THEN '13-17'
    WHEN 'Adult'          THEN '18-35'
    WHEN 'Senior Citizen' THEN '60+'
    ELSE                       '18-35'
  END
`;

// ─── Table creation (idempotent — mirrors migration 002) ─────────────────────
async function ensureTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_demographics (
      recorded_date DATE         NOT NULL,
      park_id       VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
      age_group     VARCHAR(20)  NOT NULL,
      gender        VARCHAR(10)  NOT NULL,
      count         INT          NOT NULL DEFAULT 0,
      PRIMARY KEY (recorded_date, park_id, age_group, gender)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_visitor_demographics_date_park
      ON visitor_demographics (recorded_date, park_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue_categories (
      date      DATE          NOT NULL,
      park_id   VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
      category  VARCHAR(50)   NOT NULL,
      amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (date, park_id, category)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_revenue_categories_date_park
      ON revenue_categories (date, park_id)
  `);
}

// ─── Step 1: visitor_demographics ────────────────────────────────────────────
// Derives age_group from age_category, uses gender directly.
// Tickets with NULL gender default to 'Unknown' (not counted as Male/Female/Other).
async function populateVisitorDemographics(pool) {
  const { rowCount } = await pool.query(`
    INSERT INTO visitor_demographics (recorded_date, park_id, age_group, gender, count)
    SELECT
      DATE(t.created_at)                                     AS recorded_date,
      t.park_id,
      ${AGE_GROUP_CASE}                                      AS age_group,
      COALESCE(NULLIF(TRIM(t.gender), ''), 'Unknown')        AS gender,
      SUM(t.quantity)::int                                   AS count
    FROM tickets t
    WHERE t.status != 'Cancelled'
      AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
    GROUP BY DATE(t.created_at), t.park_id, t.age_category, COALESCE(NULLIF(TRIM(t.gender), ''), 'Unknown')
    ON CONFLICT (recorded_date, park_id, age_group, gender)
    DO UPDATE SET count = EXCLUDED.count
  `);
  return rowCount;
}

// ─── Step 2: revenue_categories ──────────────────────────────────────────────
// Populates 'Tickets' category from tickets table.
// Ancillary categories (Parking, Activities, F&B, Events) are not sourced from
// tickets — they require integration with a secondary revenue system.
// Existing ancillary rows are left untouched (DO NOTHING).
async function populateRevenueCategories(pool) {
  const { rowCount } = await pool.query(`
    INSERT INTO revenue_categories (date, park_id, category, amount)
    SELECT
      DATE(t.created_at)      AS date,
      t.park_id,
      'Tickets'               AS category,
      SUM(t.total_amount)     AS amount
    FROM tickets t
    WHERE t.status != 'Cancelled'
      AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
    GROUP BY DATE(t.created_at), t.park_id
    ON CONFLICT (date, park_id, category)
    DO UPDATE SET amount = EXCLUDED.amount
  `);
  return rowCount;
}

// ─── Step 3: quarterly_revenue ───────────────────────────────────────────────
async function populateQuarterlyRevenue(pool) {
  const { rowCount } = await pool.query(`
    INSERT INTO quarterly_revenue (fiscal_year, quarter, revenue)
    SELECT
      EXTRACT(YEAR    FROM t.created_at)::smallint AS fiscal_year,
      EXTRACT(QUARTER FROM t.created_at)::smallint AS quarter,
      SUM(t.total_amount)
    FROM tickets t
    WHERE t.status != 'Cancelled'
      AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
    GROUP BY 1, 2
    ON CONFLICT (fiscal_year, quarter)
    DO UPDATE SET revenue = EXCLUDED.revenue
  `);
  return rowCount;
}

// ─── Step 4: monthly_revenue ─────────────────────────────────────────────────
async function populateMonthlyRevenue(pool) {
  const { rowCount } = await pool.query(`
    INSERT INTO monthly_revenue (year, month, revenue)
    SELECT
      EXTRACT(YEAR  FROM t.created_at)::smallint AS year,
      EXTRACT(MONTH FROM t.created_at)::smallint AS month,
      SUM(t.total_amount)
    FROM tickets t
    WHERE t.status != 'Cancelled'
      AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
    GROUP BY 1, 2
    ON CONFLICT (year, month)
    DO UPDATE SET revenue = EXCLUDED.revenue
  `);
  return rowCount;
}

// ─── Step 5: revenue_trend (per park) ────────────────────────────────────────
async function populateRevenueTrend(pool) {
  const { rowCount } = await pool.query(`
    INSERT INTO revenue_trend (park_id, year, month, revenue)
    SELECT
      t.park_id,
      EXTRACT(YEAR  FROM t.created_at)::smallint AS year,
      EXTRACT(MONTH FROM t.created_at)::smallint AS month,
      SUM(t.total_amount)
    FROM tickets t
    WHERE t.status != 'Cancelled'
      AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
    GROUP BY t.park_id, 2, 3
    ON CONFLICT (park_id, year, month)
    DO UPDATE SET revenue = EXCLUDED.revenue
  `);
  return rowCount;
}

// ─── Dry-run counters (no writes) ────────────────────────────────────────────
async function dryRunCounts(pool) {
  const [d, rc, qr, mr, rt, tix] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS n FROM (
      SELECT DATE(created_at), park_id, age_category, COALESCE(NULLIF(TRIM(gender),''),'Unknown')
      FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE) GROUP BY 1,2,3,4
    ) s`),
    pool.query(`SELECT COUNT(*) AS n FROM (
      SELECT DATE(created_at), park_id FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE) GROUP BY 1,2
    ) s`),
    pool.query(`SELECT COUNT(*) AS n FROM (
      SELECT EXTRACT(YEAR FROM created_at), EXTRACT(QUARTER FROM created_at)
      FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE) GROUP BY 1,2
    ) s`),
    pool.query(`SELECT COUNT(*) AS n FROM (
      SELECT EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
      FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE) GROUP BY 1,2
    ) s`),
    pool.query(`SELECT COUNT(*) AS n FROM (
      SELECT park_id, EXTRACT(YEAR FROM created_at), EXTRACT(MONTH FROM created_at)
      FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE) GROUP BY 1,2,3
    ) s`),
    pool.query(`SELECT COUNT(*) AS n FROM tickets WHERE status != 'Cancelled' AND (is_reversal IS NULL OR is_reversal = FALSE)`),
  ]);
  return {
    source_tickets:          parseInt(tix.rows[0].n),
    visitor_demographics:    parseInt(d.rows[0].n),
    revenue_categories:      parseInt(rc.rows[0].n),
    quarterly_revenue:       parseInt(qr.rows[0].n),
    monthly_revenue:         parseInt(mr.rows[0].n),
    revenue_trend:           parseInt(rt.rows[0].n),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'zingparks',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  console.log(`\n[ETL Bootstrap] DB: ${process.env.DB_NAME || 'zingparks'} @ ${process.env.DB_HOST || 'localhost'}`);
  console.log(`[ETL Bootstrap] Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  try {
    if (DRY_RUN) {
      const counts = await dryRunCounts(pool);
      console.log('[ETL Bootstrap] Rows that would be upserted:');
      for (const [table, n] of Object.entries(counts)) {
        console.log(`  ${table.padEnd(26)} ${n.toLocaleString()}`);
      }
      console.log('\n  Re-run without --dry-run to apply.\n');
      return;
    }

    console.log('[ETL Bootstrap] Ensuring analytics tables exist...');
    await ensureTables(pool);
    console.log('  ✓ Tables ready');

    const steps = [
      { name: 'visitor_demographics', fn: populateVisitorDemographics },
      { name: 'revenue_categories',   fn: populateRevenueCategories   },
      { name: 'quarterly_revenue',    fn: populateQuarterlyRevenue    },
      { name: 'monthly_revenue',      fn: populateMonthlyRevenue      },
      { name: 'revenue_trend',        fn: populateRevenueTrend        },
    ];

    console.log('\n[ETL Bootstrap] Populating tables...');
    for (const { name, fn } of steps) {
      try {
        const n = await fn(pool);
        console.log(`  ✓ ${name.padEnd(26)} ${n.toLocaleString()} rows upserted`);
      } catch (err) {
        console.error(`  ✗ ${name.padEnd(26)} FAILED: ${err.message}`);
      }
    }

    console.log('\n[ETL Bootstrap] Complete. Dashboard analytics tables are now populated.\n');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[ETL Bootstrap] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  ensureTables,
  populateVisitorDemographics,
  populateRevenueCategories,
  populateQuarterlyRevenue,
  populateMonthlyRevenue,
  populateRevenueTrend,
  dryRunCounts,
};
