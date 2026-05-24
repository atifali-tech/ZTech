-- Migration 014: Park Pricing Rules
-- Implements per-park ticket pricing with weekday/weekend/holiday tiers,
-- GST linkage, effective date ranges, and a full audit trail.
-- Additive only. Safe to re-run: IF NOT EXISTS / ON CONFLICT throughout.

-- ── park_pricing_rules ────────────────────────────────────────────────────────
-- One row per (park, category, day_type, effective period).
-- Overlapping active periods are prevented at the application layer;
-- a partial unique index makes unintentional duplication impossible in the DB.

CREATE TABLE IF NOT EXISTS park_pricing_rules (
  id             SERIAL        PRIMARY KEY,
  park_id        VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  category       VARCHAR(30)   NOT NULL,             -- Adult | Child | Senior Citizen | Toddler
  day_type       VARCHAR(20)   NOT NULL DEFAULT 'Weekday', -- Weekday | Weekend | Holiday
  base_price     NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  gst_rate_id    INTEGER       REFERENCES gst_rates(id) ON DELETE RESTRICT,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  effective_from DATE          NOT NULL,
  effective_to   DATE,                               -- NULL = open-ended / currently active
  created_by     VARCHAR(36)   REFERENCES users(id)  ON DELETE SET NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pricing_category CHECK (category IN ('Adult','Child','Senior Citizen','Toddler')),
  CONSTRAINT chk_pricing_day_type  CHECK (day_type  IN ('Weekday','Weekend','Holiday')),
  CONSTRAINT chk_pricing_date_order CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_pricing_park_id   ON park_pricing_rules (park_id);
CREATE INDEX IF NOT EXISTS idx_pricing_active     ON park_pricing_rules (park_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pricing_park_cat   ON park_pricing_rules (park_id, category, day_type);

-- Prevent two active open-ended rules for the same (park, category, day_type)
-- A rule is "open-ended active" when effective_to IS NULL AND is_active = TRUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_open_active
  ON park_pricing_rules (park_id, category, day_type)
  WHERE is_active = TRUE AND effective_to IS NULL;

-- ── park_pricing_history ──────────────────────────────────────────────────────
-- Immutable log. Written by the application whenever a pricing rule is
-- created, updated, or deactivated. Never updated or deleted.

CREATE TABLE IF NOT EXISTS park_pricing_history (
  id             BIGSERIAL     PRIMARY KEY,
  park_id        VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  rule_id        INTEGER       NOT NULL REFERENCES park_pricing_rules(id) ON DELETE CASCADE,
  action         VARCHAR(20)   NOT NULL,             -- created | updated | deactivated
  category       VARCHAR(30)   NOT NULL,
  day_type       VARCHAR(20)   NOT NULL,
  old_base_price NUMERIC(10,2),
  new_base_price NUMERIC(10,2) NOT NULL,
  old_gst_rate_id INTEGER,
  new_gst_rate_id INTEGER,
  is_active      BOOLEAN       NOT NULL,
  effective_from DATE          NOT NULL,
  effective_to   DATE,
  changed_by_id  VARCHAR(36)   REFERENCES users(id) ON DELETE SET NULL,
  changed_by_email VARCHAR(150),
  changed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_history_park   ON park_pricing_history (park_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_history_rule   ON park_pricing_history (rule_id);
