-- ZingParks Operations Dashboard — Database Schema
-- Run this after creating the database:
--   psql -U postgres -d zingparks -f schema.sql

-- Parks
CREATE TABLE IF NOT EXISTS parks (
  id         VARCHAR(10)  PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  city       VARCHAR(50)  NOT NULL,
  state      VARCHAR(50)  NOT NULL,
  color_hex  VARCHAR(7)   NOT NULL
);

-- Daily KPI stats (one row per park per day)
CREATE TABLE IF NOT EXISTS daily_stats (
  park_id           VARCHAR(10) REFERENCES parks(id),
  stat_date         DATE        NOT NULL,
  total_visitors    INTEGER     NOT NULL DEFAULT 0,
  total_revenue     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_tickets     INTEGER     NOT NULL DEFAULT 0,
  peak_hour         SMALLINT,
  peak_footfall     INTEGER,
  peak_hour_revenue NUMERIC(10,2),
  PRIMARY KEY (park_id, stat_date)
);

-- Demographics (age group breakdown per day — aggregated across all parks for dashboard)
CREATE TABLE IF NOT EXISTS demographics (
  stat_date     DATE        NOT NULL,
  age_group     VARCHAR(20) NOT NULL,  -- adult, kid, toddler, senior
  male_count    INTEGER     NOT NULL DEFAULT 0,
  female_count  INTEGER     NOT NULL DEFAULT 0,
  other_count   INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, age_group)
);

-- Revenue by demographic category
CREATE TABLE IF NOT EXISTS revenue_by_demographic (
  stat_date    DATE          NOT NULL,
  demo_group   VARCHAR(20)   NOT NULL,  -- Adult, Child, Toddler, Senior
  revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, demo_group)
);

-- Revenue by ticket category
CREATE TABLE IF NOT EXISTS revenue_by_category (
  stat_date  DATE          NOT NULL,
  category   VARCHAR(50)   NOT NULL,  -- Tickets, Parking, Activities, F&B, Events
  revenue    NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, category)
);

-- Revenue by ticket source
CREATE TABLE IF NOT EXISTS revenue_by_source (
  stat_date    DATE          NOT NULL,
  source_name  VARCHAR(50)   NOT NULL,  -- Counter, Web, WhatsApp
  revenue      NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, source_name)
);

-- Revenue by payment mode
CREATE TABLE IF NOT EXISTS revenue_by_payment (
  stat_date     DATE          NOT NULL,
  payment_mode  VARCHAR(50)   NOT NULL,  -- UPI, Cash, Card, Others
  revenue       NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, payment_mode)
);

-- Hourly footfall and revenue (aggregated across all parks for a given day)
CREATE TABLE IF NOT EXISTS hourly_stats (
  stat_date    DATE          NOT NULL,
  hour_of_day  SMALLINT      NOT NULL,  -- 6 to 22
  footfall     INTEGER       NOT NULL DEFAULT 0,
  revenue      NUMERIC(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (stat_date, hour_of_day)
);

-- Heatmap: 7-day rolling, day_of_week × hour (0=Mon … 6=Sun)
CREATE TABLE IF NOT EXISTS heatmap_data (
  day_of_week  SMALLINT      NOT NULL,  -- 0=Mon, 6=Sun
  hour_of_day  SMALLINT      NOT NULL,  -- 6 to 22
  footfall     INTEGER       NOT NULL DEFAULT 0,
  PRIMARY KEY (day_of_week, hour_of_day)
);

-- Weekend vs weekday per park (last 30 days snapshot)
CREATE TABLE IF NOT EXISTS weekend_weekday (
  park_id           VARCHAR(10) REFERENCES parks(id),
  weekend_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
  weekday_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0,
  weekend_footfall  INTEGER       NOT NULL DEFAULT 0,
  weekday_footfall  INTEGER       NOT NULL DEFAULT 0,
  PRIMARY KEY (park_id)
);

-- Quarterly revenue (FY25 and FY26, quarters 1-4)
CREATE TABLE IF NOT EXISTS quarterly_revenue (
  fiscal_year  SMALLINT      NOT NULL,
  quarter      SMALLINT      NOT NULL,
  revenue      NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (fiscal_year, quarter)
);

-- Monthly revenue (for YvY comparison)
CREATE TABLE IF NOT EXISTS monthly_revenue (
  year    SMALLINT      NOT NULL,
  month   SMALLINT      NOT NULL,  -- 1-12
  revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (year, month)
);

-- Top parks by various metrics
CREATE TABLE IF NOT EXISTS top_parks_metrics (
  park_id      VARCHAR(10) REFERENCES parks(id),
  metric_name  VARCHAR(20) NOT NULL,  -- Revenue, Tickets, Footfall, Activities, F&B
  metric_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (park_id, metric_name)
);

-- 6-month revenue trend per park (Dec 2025 – May 2026)
CREATE TABLE IF NOT EXISTS revenue_trend (
  park_id  VARCHAR(10) REFERENCES parks(id),
  year     SMALLINT    NOT NULL,
  month    SMALLINT    NOT NULL,
  revenue  NUMERIC(12,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (park_id, year, month)
);

-- Users (staff accounts)
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'Cashier',
  park_id       VARCHAR(10)  REFERENCES parks(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Tickets (individual ticket transactions)
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id     VARCHAR(20)   PRIMARY KEY,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  park_id       VARCHAR(10)   NOT NULL REFERENCES parks(id),
  age_category  VARCHAR(20)   NOT NULL,  -- adult, kid, toddler, senior
  quantity      SMALLINT      NOT NULL DEFAULT 1,
  amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
  cgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  sgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  upi_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode  VARCHAR(20)   NOT NULL DEFAULT 'Cash',  -- Cash, UPI, Card
  status        VARCHAR(20)   NOT NULL DEFAULT 'Confirmed',  -- Confirmed, Cancelled, Refunded
  cashier_id    VARCHAR(36)   REFERENCES users(id) ON DELETE SET NULL
);
