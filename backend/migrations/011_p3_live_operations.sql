-- Migration 011: Phase P3 — Live Operations & Operational Intelligence Foundation.
-- Additive only. Safe to re-run: IF NOT EXISTS / DO $$ blocks throughout.

-- ── operational_alerts ────────────────────────────────────────────────────────
-- Generated alerts from the alert engine. Replaces ad-hoc dashboard alerts array.
-- Severity: critical > high > medium > low > info

CREATE TABLE IF NOT EXISTS operational_alerts (
  id           BIGSERIAL    PRIMARY KEY,
  park_id      VARCHAR(10)  REFERENCES parks(id) ON DELETE CASCADE,
  alert_type   VARCHAR(60)  NOT NULL,   -- 'device_offline' | 'gate_congested' | 'shift_variance' | etc.
  severity     VARCHAR(10)  NOT NULL DEFAULT 'medium',
  title        VARCHAR(200) NOT NULL,
  body         TEXT,
  target_type  VARCHAR(50),             -- 'device' | 'gate' | 'counter' | 'shift' | 'occupancy'
  target_id    VARCHAR(36),
  status       VARCHAR(20)  NOT NULL DEFAULT 'open',  -- open | acknowledged | resolved | suppressed
  acknowledged_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ,
  auto_resolve BOOLEAN      NOT NULL DEFAULT false,   -- if true, resolved automatically when condition clears
  meta         JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('critical','high','medium','low','info')),
  CONSTRAINT chk_alert_status   CHECK (status IN ('open','acknowledged','resolved','suppressed'))
);

CREATE INDEX IF NOT EXISTS idx_op_alerts_park_id    ON operational_alerts (park_id);
CREATE INDEX IF NOT EXISTS idx_op_alerts_status     ON operational_alerts (status) WHERE status IN ('open','acknowledged');
CREATE INDEX IF NOT EXISTS idx_op_alerts_severity   ON operational_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_op_alerts_type       ON operational_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_op_alerts_target     ON operational_alerts (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_op_alerts_created_at ON operational_alerts (created_at DESC);

-- ── occupancy_snapshots ───────────────────────────────────────────────────────
-- Periodic snapshots of park occupancy state for trend analysis.
-- Populated by the occupancy engine on demand / scheduled basis.

CREATE TABLE IF NOT EXISTS occupancy_snapshots (
  id                  BIGSERIAL    PRIMARY KEY,
  park_id             VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  snapshot_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  tracking_mode       VARCHAR(20)  NOT NULL DEFAULT 'none',  -- full | entry_only | none
  entries_total       INTEGER      NOT NULL DEFAULT 0,
  exits_total         INTEGER      NOT NULL DEFAULT 0,
  current_occupancy   INTEGER      NOT NULL DEFAULT 0,       -- computed: entries - exits (full) or heuristic (entry_only)
  peak_occupancy      INTEGER      NOT NULL DEFAULT 0,       -- highest recorded so far today
  capacity            INTEGER,                               -- from parks.capacity
  occupancy_pct       NUMERIC(5,2),                          -- current_occupancy / capacity * 100
  status              VARCHAR(20)  NOT NULL DEFAULT 'normal',-- normal | warning | critical | unknown
  meta                JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_occ_snapshots_park_id   ON occupancy_snapshots (park_id);
CREATE INDEX IF NOT EXISTS idx_occ_snapshots_at        ON occupancy_snapshots (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_occ_snapshots_park_date ON occupancy_snapshots (park_id, snapshot_at DESC);

-- ── operational_incidents ─────────────────────────────────────────────────────
-- Structured incident records for gate blocks, scanner failures, occupancy breaches, etc.

CREATE TABLE IF NOT EXISTS operational_incidents (
  id             BIGSERIAL    PRIMARY KEY,
  park_id        VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  incident_type  VARCHAR(60)  NOT NULL,  -- 'gate_blocked' | 'scanner_failure' | 'printer_failure'
                                          -- | 'occupancy_breach' | 'shift_variance' | 'device_offline'
                                          -- | 'stale_heartbeat' | 'counter_inactive' | 'custom'
  severity       VARCHAR(10)  NOT NULL DEFAULT 'medium',
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  status         VARCHAR(20)  NOT NULL DEFAULT 'open',  -- open | investigating | resolved | closed
  target_type    VARCHAR(50),
  target_id      VARCHAR(36),
  reported_by    VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  assigned_to    VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  alert_id       BIGINT       REFERENCES operational_alerts(id) ON DELETE SET NULL,
  resolved_by    VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  resolution_notes TEXT,
  meta           JSONB        NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_incident_severity CHECK (severity IN ('critical','high','medium','low','info')),
  CONSTRAINT chk_incident_status   CHECK (status IN ('open','investigating','resolved','closed'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_park_id    ON operational_incidents (park_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status     ON operational_incidents (status) WHERE status IN ('open','investigating');
CREATE INDEX IF NOT EXISTS idx_incidents_type       ON operational_incidents (incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_target     ON operational_incidents (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON operational_incidents (created_at DESC);

-- ── Extend park_operational_settings with thresholds ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='park_operational_settings' AND column_name='occupancy_warning_pct') THEN
    ALTER TABLE park_operational_settings
      ADD COLUMN occupancy_warning_pct  NUMERIC(5,2) NOT NULL DEFAULT 80.00,
      ADD COLUMN occupancy_critical_pct NUMERIC(5,2) NOT NULL DEFAULT 95.00,
      ADD COLUMN heartbeat_stale_mins   INTEGER      NOT NULL DEFAULT 15,
      ADD COLUMN offline_alert_mins     INTEGER      NOT NULL DEFAULT 30;
  END IF;
END$$;

-- ── Extend park_gates with today reset capability ────────────────────────────
-- throughput_date tracks when throughput_today was last reset (for daily resets)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='park_gates' AND column_name='throughput_date') THEN
    ALTER TABLE park_gates ADD COLUMN throughput_date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END$$;

-- ── RBAC: P3 permissions ──────────────────────────────────────────────────────

INSERT INTO permissions (name, label) VALUES
  ('alerts.view',      'View Operational Alerts'),
  ('alerts.manage',    'Manage / Acknowledge Alerts'),
  ('incidents.view',   'View Operational Incidents'),
  ('incidents.create', 'Create Operational Incidents'),
  ('incidents.manage', 'Manage / Resolve Incidents'),
  ('occupancy.view',   'View Occupancy Data')
ON CONFLICT (name) DO NOTHING;

-- Grant new permissions to roles
DO $$
DECLARE
  _role_id INT;
  _perm_id INT;
BEGIN
  -- Super Admin: all new perms
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','alerts.manage','incidents.view','incidents.create','incidents.manage','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Super Admin'
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Corporate Admin: view only
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','incidents.view','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Corporate Admin'
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Park Manager: full ops control
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','alerts.manage','incidents.view','incidents.create','incidents.manage','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Park Manager'
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Finance Head: view alerts + incidents
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','incidents.view','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Finance Head'
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Cashier: view alerts + occupancy
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Cashier'
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Authority User: view everything
  FOR _perm_id IN
    SELECT id FROM permissions
    WHERE name IN ('alerts.view','incidents.view','occupancy.view')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, _perm_id FROM roles r WHERE r.name = 'Authority User'
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;
