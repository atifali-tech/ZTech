-- Migration 006: SQL views — all dashboard aggregate views derived from live tables.
-- Using CREATE OR REPLACE VIEW so this migration is safe to re-run.
-- These replace the physical tables defined in the old schema.sql.

-- ── daily_stats ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW daily_stats AS
WITH ticket_daily AS (
  SELECT DATE(created_at) AS stat_date, park_id,
         SUM(total_amount)         AS total_revenue,
         COUNT(DISTINCT ticket_id) AS total_tickets
  FROM tickets
  GROUP BY 1, 2
),
visitor_daily AS (
  SELECT recorded_date AS stat_date, park_id, SUM(count) AS total_visitors
  FROM visitor_demographics
  GROUP BY 1, 2
),
hourly_peak AS (
  SELECT DISTINCT ON (stat_date, park_id)
    stat_date, park_id, peak_hour, peak_footfall, peak_hour_revenue
  FROM (
    SELECT DATE(created_at) AS stat_date, park_id,
           EXTRACT(HOUR FROM created_at)::int AS peak_hour,
           COUNT(*)                           AS peak_footfall,
           SUM(total_amount)                  AS peak_hour_revenue
    FROM tickets
    GROUP BY DATE(created_at), park_id, EXTRACT(HOUR FROM created_at)
  ) h
  ORDER BY stat_date, park_id, peak_footfall DESC
)
SELECT
  COALESCE(td.stat_date, vd.stat_date) AS stat_date,
  COALESCE(td.park_id,   vd.park_id)   AS park_id,
  COALESCE(vd.total_visitors, 0)        AS total_visitors,
  COALESCE(td.total_revenue,  0)        AS total_revenue,
  COALESCE(td.total_tickets,  0)        AS total_tickets,
  hp.peak_hour,
  hp.peak_footfall,
  hp.peak_hour_revenue
FROM ticket_daily td
FULL JOIN visitor_daily vd ON td.stat_date = vd.stat_date AND td.park_id = vd.park_id
LEFT JOIN hourly_peak   hp ON hp.stat_date = COALESCE(td.stat_date, vd.stat_date)
                           AND hp.park_id  = COALESCE(td.park_id,   vd.park_id);

-- ── demographics ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW demographics AS
SELECT
  recorded_date AS stat_date,
  CASE age_group
    WHEN '0-12'  THEN 'toddler'
    WHEN '13-17' THEN 'kid'
    WHEN '18-35' THEN 'adult'
    WHEN '36-60' THEN 'adult'
    WHEN '60+'   THEN 'senior'
  END AS age_group,
  SUM(CASE WHEN gender = 'Male'   THEN count ELSE 0 END) AS male_count,
  SUM(CASE WHEN gender = 'Female' THEN count ELSE 0 END) AS female_count,
  SUM(CASE WHEN gender = 'Other'  THEN count ELSE 0 END) AS other_count
FROM visitor_demographics
GROUP BY 1, 2;

-- ── revenue_by_demographic ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_by_demographic AS
SELECT
  DATE(created_at) AS stat_date,
  CASE age_category WHEN 'Senior Citizen' THEN 'Senior' ELSE age_category END AS demo_group,
  SUM(total_amount) AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── revenue_by_category ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_by_category AS
SELECT DATE(created_at) AS stat_date, 'Tickets' AS category, SUM(total_amount) AS revenue
FROM tickets
GROUP BY 1
UNION ALL
SELECT date AS stat_date, category, SUM(amount) AS revenue
FROM revenue_categories
GROUP BY 1, 2;

-- ── revenue_by_source ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_by_source AS
SELECT DATE(created_at) AS stat_date, source AS source_name, SUM(total_amount) AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── revenue_by_payment ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_by_payment AS
SELECT
  DATE(created_at) AS stat_date,
  CASE payment_mode WHEN 'Split' THEN 'Others' ELSE payment_mode END AS payment_mode,
  SUM(total_amount) AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── hourly_stats ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW hourly_stats AS
SELECT
  DATE(created_at)                   AS stat_date,
  EXTRACT(HOUR FROM created_at)::int AS hour_of_day,
  SUM(quantity)                      AS footfall,
  SUM(total_amount)                  AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── heatmap_data (rolling 90 days) ───────────────────────────────────────────
CREATE OR REPLACE VIEW heatmap_data AS
SELECT
  ((EXTRACT(DOW FROM created_at)::int + 6) % 7) AS day_of_week,
  EXTRACT(HOUR FROM created_at)::int             AS hour_of_day,
  SUM(quantity)                                  AS footfall
FROM tickets
WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY 1, 2;

-- ── weekend_weekday ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW weekend_weekday AS
SELECT
  park_id,
  SUM(CASE WHEN EXTRACT(DOW FROM created_at) IN (0,6) THEN total_amount ELSE 0 END)     AS weekend_revenue,
  SUM(CASE WHEN EXTRACT(DOW FROM created_at) NOT IN (0,6) THEN total_amount ELSE 0 END) AS weekday_revenue,
  SUM(CASE WHEN EXTRACT(DOW FROM created_at) IN (0,6) THEN quantity ELSE 0 END)         AS weekend_footfall,
  SUM(CASE WHEN EXTRACT(DOW FROM created_at) NOT IN (0,6) THEN quantity ELSE 0 END)     AS weekday_footfall
FROM tickets
GROUP BY park_id;

-- ── quarterly_revenue ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW quarterly_revenue AS
SELECT
  EXTRACT(YEAR    FROM created_at)::int AS fiscal_year,
  EXTRACT(QUARTER FROM created_at)::int AS quarter,
  SUM(total_amount)                     AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── monthly_revenue ───────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  EXTRACT(YEAR  FROM created_at)::int AS year,
  EXTRACT(MONTH FROM created_at)::int AS month,
  SUM(total_amount)                   AS revenue
FROM tickets
GROUP BY 1, 2;

-- ── top_parks_metrics ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW top_parks_metrics AS
SELECT park_id, 'Revenue'    AS metric_name, SUM(total_amount)::numeric        AS metric_value FROM tickets GROUP BY park_id
UNION ALL
SELECT park_id, 'Tickets'    AS metric_name, COUNT(DISTINCT ticket_id)::numeric AS metric_value FROM tickets GROUP BY park_id
UNION ALL
SELECT park_id, 'Footfall'   AS metric_name, SUM(quantity)::numeric             AS metric_value FROM tickets GROUP BY park_id
UNION ALL
SELECT park_id, 'Activities' AS metric_name, SUM(amount)::numeric               AS metric_value FROM revenue_categories WHERE category = 'Activities' GROUP BY park_id
UNION ALL
SELECT park_id, 'F&B'        AS metric_name, SUM(amount)::numeric               AS metric_value FROM revenue_categories WHERE category = 'F&B'        GROUP BY park_id;

-- ── revenue_trend ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW revenue_trend AS
SELECT
  park_id,
  EXTRACT(YEAR  FROM created_at)::int AS year,
  EXTRACT(MONTH FROM created_at)::int AS month,
  SUM(total_amount)                   AS revenue
FROM tickets
GROUP BY 1, 2, 3;
