-- Migration 002: Create missing analytics tables required by dashboard routes.
-- Safe to re-run: all statements use CREATE TABLE IF NOT EXISTS.
--
-- Run against production:
--   psql -U postgres -d zingparks -f backend/migrations/002_analytics_tables.sql
--
-- After running this migration, execute the ETL bootstrap to populate data:
--   node backend/scripts/etl-bootstrap.js

-- ── visitor_demographics ──────────────────────────────────────────────────────
-- Used by: GET /api/dashboard/demographics
-- Populated by: etl-bootstrap.js (derived from tickets.age_category + tickets.gender)
-- age_group values: '0-12', '13-17', '18-35', '36-60', '60+'
-- gender values:    'Male', 'Female', 'Other'
CREATE TABLE IF NOT EXISTS visitor_demographics (
  recorded_date DATE         NOT NULL,
  park_id       VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  age_group     VARCHAR(20)  NOT NULL,
  gender        VARCHAR(10)  NOT NULL,
  count         INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (recorded_date, park_id, age_group, gender)
);

CREATE INDEX IF NOT EXISTS idx_visitor_demographics_date_park
  ON visitor_demographics (recorded_date, park_id);

-- ── revenue_categories ────────────────────────────────────────────────────────
-- Used by: GET /api/dashboard/revenue-splits, GET /api/dashboard/top-parks
-- Populated by: etl-bootstrap.js (ticket revenue as 'Tickets' category;
--               other categories — Parking, Activities, F&B, Events — seeded as 0
--               until integrated with a POS / secondary revenue system)
-- category values: 'Tickets', 'Parking', 'Activities', 'F&B', 'Events'
CREATE TABLE IF NOT EXISTS revenue_categories (
  date      DATE          NOT NULL,
  park_id   VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  category  VARCHAR(50)   NOT NULL,
  amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (date, park_id, category)
);

CREATE INDEX IF NOT EXISTS idx_revenue_categories_date_park
  ON revenue_categories (date, park_id);
