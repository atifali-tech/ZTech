-- Migration 012: P0 Production Blocker Remediation
-- Additive only. Safe to re-run: IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.

-- ── must_change_password flag for admin password resets (P0-3) ───────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ── park_operational_settings (P0-4) — add management columns if missing ─────
-- The table was created in migration 008 with basic capability flags.
-- These additional columns support the UI management experience.

ALTER TABLE park_operational_settings
  ADD COLUMN IF NOT EXISTS max_daily_capacity       INTEGER,
  ADD COLUMN IF NOT EXISTS alert_threshold_pct      SMALLINT NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS occupancy_warning_pct    SMALLINT NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS occupancy_critical_pct   SMALLINT NOT NULL DEFAULT 95,
  ADD COLUMN IF NOT EXISTS shift_variance_threshold NUMERIC(12,2) NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS auto_close_shifts        BOOLEAN NOT NULL DEFAULT FALSE;

-- ── finance.submit permission (P0-2) ─────────────────────────────────────────

INSERT INTO permissions (name, label)
  VALUES ('finance.submit', 'Submit Settlement Periods')
ON CONFLICT (name) DO NOTHING;

-- Super Admin: gets all permissions automatically via the wildcard grant in 009
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name = 'finance.submit'
ON CONFLICT DO NOTHING;

-- Finance Head: can submit settlements
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name = 'finance.submit'
ON CONFLICT DO NOTHING;

-- Park Manager: can submit their park's settlements
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name = 'finance.submit'
ON CONFLICT DO NOTHING;
