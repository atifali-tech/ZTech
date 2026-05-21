-- Migration 004: Finance — GST rates, settlements, reconciliation, refunds,
--                          approvals, generated reports, tax invoice sequences,
--                          park settings.
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.

-- ── GST rate table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gst_rates (
  id             SERIAL       PRIMARY KEY,
  category       VARCHAR(64)  NOT NULL,  -- 'Entry' | 'F&B' | 'Merchandise' | 'Event' | 'default'
  cgst_pct       NUMERIC(5,2) NOT NULL,
  sgst_pct       NUMERIC(5,2) NOT NULL,
  igst_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  effective_from DATE         NOT NULL,
  effective_to   DATE,                   -- NULL = currently active
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gst_rates_category_date
  ON gst_rates (category, effective_from, effective_to);

INSERT INTO gst_rates (category, cgst_pct, sgst_pct, effective_from) VALUES
  ('Entry',       5.00, 5.00, '2024-01-01'),
  ('F&B',         5.00, 5.00, '2024-01-01'),
  ('Merchandise', 5.00, 5.00, '2024-01-01'),
  ('Event',       5.00, 5.00, '2024-01-01'),
  ('default',     5.00, 5.00, '2024-01-01')
ON CONFLICT DO NOTHING;

-- Wire up gst_rate_id FK on tickets now that gst_rates exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tickets_gst_rate'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT fk_tickets_gst_rate
      FOREIGN KEY (gst_rate_id) REFERENCES gst_rates(id)
      NOT VALID;
  END IF;
END$$;

-- ── Tax invoice sequences per park ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_invoice_sequences (
  park_id   VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  fy_prefix VARCHAR(12) NOT NULL,  -- e.g. '2025-26'
  last_seq  INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (park_id, fy_prefix)
);

-- ── Park settings ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS park_settings (
  park_id    VARCHAR(10) PRIMARY KEY REFERENCES parks(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Settlement periods ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settlement_periods (
  id           SERIAL       PRIMARY KEY,
  park_id      VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  period_date  DATE         NOT NULL,
  status       VARCHAR(32)  NOT NULL DEFAULT 'open',  -- open | submitted | approved | disputed
  locked       BOOLEAN      NOT NULL DEFAULT FALSE,
  submitted_by VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  approved_by  VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  approved_at  TIMESTAMPTZ,
  expected_rev NUMERIC(14,2),
  actual_rev   NUMERIC(14,2),
  variance     NUMERIC(14,2),
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (park_id, period_date)
);

CREATE INDEX IF NOT EXISTS idx_settlement_park_date ON settlement_periods (park_id, period_date);
CREATE INDEX IF NOT EXISTS idx_settlement_status    ON settlement_periods (status) WHERE locked = FALSE;

-- ── Reconciliation exceptions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
  id             SERIAL      PRIMARY KEY,
  settlement_id  INTEGER     NOT NULL REFERENCES settlement_periods(id) ON DELETE CASCADE,
  ticket_id      INTEGER     REFERENCES tickets(id),
  exception_type VARCHAR(64) NOT NULL,  -- 'missing_payment' | 'amount_mismatch' | 'duplicate' | 'cancelled_charge'
  severity       VARCHAR(16) NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
  expected_amt   NUMERIC(14,2),
  actual_amt     NUMERIC(14,2),
  variance       NUMERIC(14,2),
  resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_by    VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recon_exceptions_settlement
  ON reconciliation_exceptions (settlement_id);
CREATE INDEX IF NOT EXISTS idx_recon_exceptions_unresolved
  ON reconciliation_exceptions (settlement_id) WHERE resolved = FALSE;

-- ── Refund requests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refund_requests (
  id                 SERIAL      PRIMARY KEY,
  ticket_id          INTEGER     NOT NULL REFERENCES tickets(id),
  requested_by       VARCHAR(36) NOT NULL REFERENCES users(id),
  approved_by        VARCHAR(36) REFERENCES users(id),
  reversal_ticket_id INTEGER     REFERENCES tickets(id),
  amount             NUMERIC(14,2) NOT NULL,
  reason             TEXT          NOT NULL,
  status             VARCHAR(32)   NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | processed
  rejection_reason   TEXT,
  requested_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ,
  processed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_ticket ON refund_requests (ticket_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status
  ON refund_requests (status) WHERE status IN ('pending', 'approved');

-- ── Finance approvals (generic approval audit) ────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_approvals (
  id          SERIAL       PRIMARY KEY,
  entity_type VARCHAR(64)  NOT NULL,  -- 'refund_request' | 'settlement_period'
  entity_id   INTEGER      NOT NULL,
  action      VARCHAR(32)  NOT NULL,  -- 'submit' | 'approve' | 'reject' | 'dispute'
  actor_id    VARCHAR(36)  NOT NULL REFERENCES users(id),
  actor_email VARCHAR(255) NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_approvals_entity
  ON finance_approvals (entity_type, entity_id);

-- ── Generated reports ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generated_reports (
  id           SERIAL      PRIMARY KEY,
  report_type  VARCHAR(64) NOT NULL,  -- 'DSR' | 'FY-DSR' | 'reconciliation'
  park_id      VARCHAR(10) REFERENCES parks(id) ON DELETE SET NULL,
  period_start DATE        NOT NULL,
  period_end   DATE        NOT NULL,
  generated_by VARCHAR(36) NOT NULL REFERENCES users(id),
  file_path    TEXT,
  meta         JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_type_period
  ON generated_reports (report_type, period_start, period_end);
