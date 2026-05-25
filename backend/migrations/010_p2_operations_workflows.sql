-- Migration 010: Phase P2 — Operational Workflow enhancements.
-- Additive only. Safe to re-run: IF NOT EXISTS + DO $$ blocks throughout.

-- ── Extend shift_sessions with full lifecycle fields ──────────────────────────

DO $$
BEGIN
  -- opening cash captured at shift open
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_sessions' AND column_name='opening_cash') THEN
    ALTER TABLE shift_sessions ADD COLUMN opening_cash NUMERIC(12,2);
  END IF;
  -- declared cash captured at close
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_sessions' AND column_name='declared_cash') THEN
    ALTER TABLE shift_sessions ADD COLUMN declared_cash NUMERIC(12,2);
  END IF;
  -- supervisor who signed off on close / reconciliation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_sessions' AND column_name='supervisor_id') THEN
    ALTER TABLE shift_sessions ADD COLUMN supervisor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
  -- transaction count during shift
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_sessions' AND column_name='transaction_count') THEN
    ALTER TABLE shift_sessions ADD COLUMN transaction_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- refund count during shift
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shift_sessions' AND column_name='refund_count') THEN
    ALTER TABLE shift_sessions ADD COLUMN refund_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- P2 expands status set; drop old check, re-add with new values
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chk_shift_status') THEN
    ALTER TABLE shift_sessions DROP CONSTRAINT chk_shift_status;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chk_shift_status') THEN
    ALTER TABLE shift_sessions
      ADD CONSTRAINT chk_shift_status
      CHECK (status IN ('Open','Operating','Closed','Reconciled','Variance Flagged'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_shift_sessions_supervisor ON shift_sessions (supervisor_id);

-- ── Extend park_counters with operational status ──────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='park_counters' AND column_name='op_status') THEN
    ALTER TABLE park_counters ADD COLUMN op_status VARCHAR(20) NOT NULL DEFAULT 'Inactive';
  END IF;
  -- link to currently open shift at this counter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='park_counters' AND column_name='current_shift_id') THEN
    ALTER TABLE park_counters ADD COLUMN current_shift_id VARCHAR(36) REFERENCES shift_sessions(id) ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chk_counter_op_status') THEN
    ALTER TABLE park_counters
      ADD CONSTRAINT chk_counter_op_status
      CHECK (op_status IN ('Active','Inactive','Maintenance','Shift Open','Shift Closed'));
  END IF;
END$$;

-- ── Extend park_gates with operational status ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='park_gates' AND column_name='op_status') THEN
    ALTER TABLE park_gates ADD COLUMN op_status VARCHAR(20) NOT NULL DEFAULT 'Inactive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='park_gates' AND column_name='throughput_today') THEN
    ALTER TABLE park_gates ADD COLUMN throughput_today INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='park_gates' AND column_name='rejection_count_today') THEN
    ALTER TABLE park_gates ADD COLUMN rejection_count_today INTEGER NOT NULL DEFAULT 0;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chk_gate_op_status') THEN
    ALTER TABLE park_gates
      ADD CONSTRAINT chk_gate_op_status
      CHECK (op_status IN ('Active','Inactive','Congested','Maintenance'));
  END IF;
END$$;

-- ── device_assignments — full assignment history ───────────────────────────────

CREATE TABLE IF NOT EXISTS device_assignments (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  device_id      VARCHAR(36)  NOT NULL REFERENCES park_devices(id) ON DELETE CASCADE,
  counter_id     VARCHAR(36)  REFERENCES park_counters(id) ON DELETE SET NULL,
  user_id        VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  assigned_by    VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  unassigned_by  VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  assigned_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  unassigned_at  TIMESTAMPTZ,
  reason         TEXT
);

CREATE INDEX IF NOT EXISTS idx_device_assignments_device  ON device_assignments (device_id);
CREATE INDEX IF NOT EXISTS idx_device_assignments_counter ON device_assignments (counter_id);
CREATE INDEX IF NOT EXISTS idx_device_assignments_user    ON device_assignments (user_id);

-- ── occupancy_events — foundation only, no live engine ───────────────────────

CREATE TABLE IF NOT EXISTS occupancy_events (
  id           BIGSERIAL    PRIMARY KEY,
  park_id      VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  gate_id      VARCHAR(36)  REFERENCES park_gates(id) ON DELETE SET NULL,
  event_type   VARCHAR(10)  NOT NULL,             -- 'entry' | 'exit' | 'est_exit'
  ticket_ref   VARCHAR(20),                        -- ticket_id reference (no FK, denormalised)
  recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  meta         JSONB        NOT NULL DEFAULT '{}',
  CONSTRAINT chk_occ_event_type CHECK (event_type IN ('entry','exit','est_exit'))
);

CREATE INDEX IF NOT EXISTS idx_occ_events_park_id     ON occupancy_events (park_id);
CREATE INDEX IF NOT EXISTS idx_occ_events_gate_id     ON occupancy_events (gate_id);
CREATE INDEX IF NOT EXISTS idx_occ_events_recorded_at ON occupancy_events (recorded_at);

-- ── operational_events — standardised event log (Step 7) ─────────────────────
-- Separate from audit_log; audit_log = who did what, op_events = what happened operationally.

CREATE TABLE IF NOT EXISTS operational_events (
  id          BIGSERIAL    PRIMARY KEY,
  event_type  VARCHAR(60)  NOT NULL,
  park_id     VARCHAR(10)  REFERENCES parks(id) ON DELETE SET NULL,
  actor_id    VARCHAR(36),
  target_type VARCHAR(50),
  target_id   VARCHAR(36),
  payload     JSONB        NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_events_type        ON operational_events (event_type);
CREATE INDEX IF NOT EXISTS idx_op_events_park_id     ON operational_events (park_id);
CREATE INDEX IF NOT EXISTS idx_op_events_recorded_at ON operational_events (recorded_at);

-- Allowed event types (enforced in app, not DB — keeps migration additive).
-- shift_opened | shift_closed | shift_reconciled | shift_variance_flagged
-- device_assigned | device_unassigned | device_blocked | device_maintenance
-- gate_enabled | gate_disabled | gate_congested | gate_maintenance
-- counter_activated | counter_deactivated | counter_maintenance
-- occupancy_entry_recorded | occupancy_exit_recorded
