-- Migration 003: Analytics tables — visitor_demographics, revenue_categories
-- Safe to re-run: all statements use IF NOT EXISTS.

-- ── visitor_demographics ──────────────────────────────────────────────────────
-- Used by: GET /api/dashboard/demographics
-- age_group values: '0-12', '13-17', '18-35', '36-60', '60+'
-- gender values:    'Male', 'Female', 'Other'

CREATE TABLE IF NOT EXISTS visitor_demographics (
  recorded_date DATE        NOT NULL,
  park_id       VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  age_group     VARCHAR(20) NOT NULL,
  gender        VARCHAR(10) NOT NULL,
  count         INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (recorded_date, park_id, age_group, gender)
);

CREATE INDEX IF NOT EXISTS idx_visitor_demographics_date_park
  ON visitor_demographics (recorded_date, park_id);

-- ── revenue_categories ────────────────────────────────────────────────────────
-- Used by: GET /api/dashboard/revenue-splits, /top-parks
-- category values: 'F&B', 'Activities', 'Parking', 'Events'
-- ('Tickets' revenue comes from the tickets table directly, not stored here)

CREATE TABLE IF NOT EXISTS revenue_categories (
  date      DATE          NOT NULL,
  park_id   VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  category  VARCHAR(50)   NOT NULL,
  amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (date, park_id, category)
);

CREATE INDEX IF NOT EXISTS idx_revenue_categories_date_park
  ON revenue_categories (date, park_id);
