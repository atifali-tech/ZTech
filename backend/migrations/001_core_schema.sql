-- Migration 001: Core schema — parks, users, tickets, user_parks, audit_log
-- Designed for a FRESH database. If upgrading an existing DB, drop it first:
--   psql -U postgres -c "DROP DATABASE zingparks;" && psql -U postgres -c "CREATE DATABASE zingparks;"
-- Safe to re-run on a blank DB: all statements use IF NOT EXISTS.

-- ── Parks ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS parks (
  id        VARCHAR(10)  PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  city      VARCHAR(50)  NOT NULL,
  state     VARCHAR(50)  NOT NULL,
  color_hex VARCHAR(7)   NOT NULL DEFAULT '#16A34A',
  capacity  INTEGER
);

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'Cashier',
  role_id       INTEGER,
  park_id       VARCHAR(10)  REFERENCES parks(id) ON DELETE SET NULL,
  token_version INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── User ↔ Park assignments (many-to-many) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_parks (
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  park_id VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, park_id)
);

-- ── Tickets ───────────────────────────────────────────────────────────────────
-- ticket_id is the business key shared across age-category rows for one booking.
-- id (SERIAL) is a surrogate integer PK used by refund_requests and reconciliation FKs.

CREATE TABLE IF NOT EXISTS tickets (
  id             SERIAL,
  ticket_id      VARCHAR(20)   NOT NULL,
  transaction_id VARCHAR(20),
  park_id        VARCHAR(10)   NOT NULL REFERENCES parks(id),
  age_category   VARCHAR(20)   NOT NULL,
  quantity       SMALLINT      NOT NULL DEFAULT 1,
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  cgst_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  sgst_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  upi_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  card_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode   VARCHAR(20)   NOT NULL DEFAULT 'Cash',
  status         VARCHAR(20)   NOT NULL DEFAULT 'Confirmed',
  source         VARCHAR(20),
  cashier_id     VARCHAR(36)   REFERENCES users(id) ON DELETE SET NULL,
  device_id      VARCHAR(50),
  gender         VARCHAR(10),
  is_reversal    BOOLEAN       NOT NULL DEFAULT FALSE,
  reversal_of    INTEGER,
  gst_rate_id    INTEGER,
  tax_invoice_no VARCHAR(64),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticket_id, age_category)
);

-- Unique index on the surrogate id column (used as FK target by refund_requests etc.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_id ON tickets (id);

-- Self-referencing FK for reversals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tickets_reversal_of'
      AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_reversal_of
      FOREIGN KEY (reversal_of) REFERENCES tickets(id)
      NOT VALID;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id  ON tickets (ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_park_date  ON tickets (park_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets (created_at DESC);

-- ── Audit log ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL    PRIMARY KEY,
  actor_id    TEXT,
  actor_email VARCHAR(150),
  action      VARCHAR(128) NOT NULL,
  target_type VARCHAR(64),
  target_id   TEXT,
  meta        JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
