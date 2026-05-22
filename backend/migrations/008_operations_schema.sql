-- Migration 008: Parks Operations Foundation — operational tables.
-- Additive only. Safe to re-run: IF NOT EXISTS + ON CONFLICT throughout.

-- ── park_operational_settings ─────────────────────────────────────────────────
-- Stores capability flags per park (replaces/extends park_settings for ops).

CREATE TABLE IF NOT EXISTS park_operational_settings (
  park_id              VARCHAR(10) PRIMARY KEY REFERENCES parks(id) ON DELETE CASCADE,
  supports_entry_tracking BOOLEAN NOT NULL DEFAULT false,
  supports_devices        BOOLEAN NOT NULL DEFAULT false,
  supports_zones          BOOLEAN NOT NULL DEFAULT false,
  supports_gates          BOOLEAN NOT NULL DEFAULT false,
  supports_shifts         BOOLEAN NOT NULL DEFAULT false,
  extra                   JSONB   NOT NULL DEFAULT '{}',
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── park_zones ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS park_zones (
  id         VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  park_id    VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  zone_type  VARCHAR(50)  NOT NULL DEFAULT 'General',
  is_active  BOOLEAN      NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_park_zones_park_id ON park_zones (park_id);

-- ── park_gates ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS park_gates (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  park_id           VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  zone_id           VARCHAR(36)  REFERENCES park_zones(id) ON DELETE SET NULL,
  name              VARCHAR(100) NOT NULL,
  gate_type         VARCHAR(30)  NOT NULL DEFAULT 'Entry',
  occupancy_enabled BOOLEAN      NOT NULL DEFAULT false,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gate_type CHECK (gate_type IN ('Entry','Exit','Mixed','VIP','Staff','Emergency','Validation Only'))
);

CREATE INDEX IF NOT EXISTS idx_park_gates_park_id ON park_gates (park_id);
CREATE INDEX IF NOT EXISTS idx_park_gates_zone_id ON park_gates (zone_id);

-- ── park_devices ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS park_devices (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  park_id          VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  name             VARCHAR(100) NOT NULL,
  device_type      VARCHAR(50)  NOT NULL DEFAULT 'POS',
  status           VARCHAR(20)  NOT NULL DEFAULT 'Offline',
  last_heartbeat   TIMESTAMPTZ,
  software_version VARCHAR(50),
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_device_type CHECK (device_type IN ('POS','QR Scanner','Printer','Tablet','Kiosk','RFID Reader','Turnstile','Biometric')),
  CONSTRAINT chk_device_status CHECK (status IN ('Online','Offline','Maintenance','Blocked','Outdated'))
);

CREATE INDEX IF NOT EXISTS idx_park_devices_park_id ON park_devices (park_id);

-- ── park_counters ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS park_counters (
  id                 VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  park_id            VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  zone_id            VARCHAR(36)  REFERENCES park_zones(id) ON DELETE SET NULL,
  name               VARCHAR(100) NOT NULL,
  counter_type       VARCHAR(30)  NOT NULL DEFAULT 'Ticketing',
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  assigned_user_id   VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
  assigned_device_id VARCHAR(36)  REFERENCES park_devices(id) ON DELETE SET NULL,
  deleted_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_counter_type CHECK (counter_type IN ('Ticketing','Refund','VIP','Self-Service','Parking','Temporary'))
);

CREATE INDEX IF NOT EXISTS idx_park_counters_park_id ON park_counters (park_id);
CREATE INDEX IF NOT EXISTS idx_park_counters_zone_id ON park_counters (zone_id);

-- device backref to counter (nullable — device may not be at a counter)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'park_devices' AND column_name = 'counter_id'
  ) THEN
    ALTER TABLE park_devices ADD COLUMN counter_id VARCHAR(36) REFERENCES park_counters(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_park_devices_counter_id ON park_devices (counter_id);

-- ── shift_sessions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shift_sessions (
  id           VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  park_id      VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  counter_id   VARCHAR(36)  REFERENCES park_counters(id) ON DELETE SET NULL,
  user_id      VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20)  NOT NULL DEFAULT 'Open',
  opened_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at    TIMESTAMPTZ,
  expected_rev NUMERIC(12,2),
  actual_rev   NUMERIC(12,2),
  variance     NUMERIC(12,2) GENERATED ALWAYS AS (actual_rev - expected_rev) STORED,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_shift_status CHECK (status IN ('Open','Operating','Closed','Settlement','Variance'))
);

CREATE INDEX IF NOT EXISTS idx_shift_sessions_park_id    ON shift_sessions (park_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_user_id    ON shift_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_counter_id ON shift_sessions (counter_id);
CREATE INDEX IF NOT EXISTS idx_shift_sessions_status     ON shift_sessions (status);

-- ── device_heartbeats ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS device_heartbeats (
  id          BIGSERIAL    PRIMARY KEY,
  device_id   VARCHAR(36)  NOT NULL REFERENCES park_devices(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  status      VARCHAR(20)  NOT NULL DEFAULT 'Online',
  meta        JSONB        NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device_id   ON device_heartbeats (device_id);
CREATE INDEX IF NOT EXISTS idx_device_heartbeats_recorded_at ON device_heartbeats (recorded_at);
