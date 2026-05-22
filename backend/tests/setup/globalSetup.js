'use strict';
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TEST_DB = 'zingparks_test';

module.exports = async function globalSetup() {
  // ── 1. Create test database if it doesn't exist ───────────────────────────
  const adminPool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    const { rows } = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]
    );
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE ${TEST_DB}`);
    }
  } finally {
    await adminPool.end();
  }

  // ── 2. Connect to test DB and build schema ────────────────────────────────
  const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: TEST_DB,
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── Parks (no FK dependencies) ────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS parks (
          id        VARCHAR(10)  PRIMARY KEY,
          name      VARCHAR(100) NOT NULL,
          city      VARCHAR(50)  NOT NULL,
          state     VARCHAR(50)  NOT NULL,
          color_hex VARCHAR(7)   NOT NULL,
          capacity  INT
        )
      `);

      // ── RBAC lookup tables (needed by users FK) ───────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS roles (
          id          SERIAL PRIMARY KEY,
          name        VARCHAR(50) UNIQUE NOT NULL,
          description TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS permissions (
          id    SERIAL PRIMARY KEY,
          name  VARCHAR(100) UNIQUE NOT NULL,
          label VARCHAR(150)
        )
      `);

      // ── Users (references parks + roles) ─────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          name          VARCHAR(100) NOT NULL,
          email         VARCHAR(150) NOT NULL UNIQUE,
          password_hash TEXT         NOT NULL,
          role          VARCHAR(30)  NOT NULL DEFAULT 'Cashier',
          role_id       INT          REFERENCES roles(id) ON DELETE SET NULL,
          park_id       VARCHAR(10)  REFERENCES parks(id) ON DELETE SET NULL,
          token_version INT          NOT NULL DEFAULT 0,
          created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      // ── role_permissions + user_parks + audit_log ─────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          role_id       INT REFERENCES roles(id)       ON DELETE CASCADE,
          permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
          PRIMARY KEY (role_id, permission_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_parks (
          user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
          park_id VARCHAR(10) REFERENCES parks(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, park_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id          BIGSERIAL PRIMARY KEY,
          actor_id    VARCHAR(36),
          actor_email VARCHAR(150),
          action      VARCHAR(100) NOT NULL,
          target_type VARCHAR(50),
          target_id   VARCHAR(100),
          meta        JSONB,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // ── Tickets with composite PK (ticket_id, age_category) ──────────────
      // DROP first so tests always get the correct schema definition.
      await client.query(`DROP TABLE IF EXISTS tickets CASCADE`);
      await client.query(`
        CREATE TABLE tickets (
          ticket_id      VARCHAR(20)   NOT NULL,
          transaction_id VARCHAR(20),
          created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
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
          PRIMARY KEY (ticket_id, age_category)
        )
      `);

      // ── Analytics tables ──────────────────────────────────────────────────
      await client.query(`
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
        )
      `);

      await client.query(`CREATE TABLE IF NOT EXISTS demographics (
        stat_date DATE NOT NULL, age_group VARCHAR(20) NOT NULL,
        male_count INTEGER NOT NULL DEFAULT 0, female_count INTEGER NOT NULL DEFAULT 0,
        other_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, age_group)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS revenue_by_demographic (
        stat_date DATE NOT NULL, demo_group VARCHAR(20) NOT NULL,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, demo_group)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS revenue_by_category (
        stat_date DATE NOT NULL, category VARCHAR(50) NOT NULL,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, category)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS revenue_by_source (
        stat_date DATE NOT NULL, source_name VARCHAR(50) NOT NULL,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, source_name)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS revenue_by_payment (
        stat_date DATE NOT NULL, payment_mode VARCHAR(50) NOT NULL,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, payment_mode)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS hourly_stats (
        stat_date DATE NOT NULL, hour_of_day SMALLINT NOT NULL,
        footfall INTEGER NOT NULL DEFAULT 0, revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
        PRIMARY KEY (stat_date, hour_of_day)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS heatmap_data (
        day_of_week SMALLINT NOT NULL, hour_of_day SMALLINT NOT NULL,
        footfall INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day_of_week, hour_of_day)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS weekend_weekday (
        park_id VARCHAR(10) REFERENCES parks(id),
        weekend_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
        weekday_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
        weekend_footfall INTEGER NOT NULL DEFAULT 0,
        weekday_footfall INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (park_id)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS quarterly_revenue (
        fiscal_year SMALLINT NOT NULL, quarter SMALLINT NOT NULL,
        revenue NUMERIC(14,2) NOT NULL DEFAULT 0, PRIMARY KEY (fiscal_year, quarter)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS monthly_revenue (
        year SMALLINT NOT NULL, month SMALLINT NOT NULL,
        revenue NUMERIC(14,2) NOT NULL DEFAULT 0, PRIMARY KEY (year, month)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS top_parks_metrics (
        park_id VARCHAR(10) REFERENCES parks(id), metric_name VARCHAR(20) NOT NULL,
        metric_value NUMERIC(14,2) NOT NULL DEFAULT 0, PRIMARY KEY (park_id, metric_name)
      )`);

      await client.query(`CREATE TABLE IF NOT EXISTS revenue_trend (
        park_id VARCHAR(10) REFERENCES parks(id),
        year SMALLINT NOT NULL, month SMALLINT NOT NULL,
        revenue NUMERIC(12,2) NOT NULL DEFAULT 0, PRIMARY KEY (park_id, year, month)
      )`);

      // ── Analytics tables required by dashboard routes (migration 002) ─────
      await client.query(`
        CREATE TABLE IF NOT EXISTS visitor_demographics (
          recorded_date DATE        NOT NULL,
          park_id       VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          age_group     VARCHAR(20) NOT NULL,
          gender        VARCHAR(10) NOT NULL,
          count         INT         NOT NULL DEFAULT 0,
          PRIMARY KEY (recorded_date, park_id, age_group, gender)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS revenue_categories (
          date     DATE          NOT NULL,
          park_id  VARCHAR(10)   NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          category VARCHAR(50)   NOT NULL,
          amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
          PRIMARY KEY (date, park_id, category)
        )
      `);

      // ── Notifications (migration 004) ─────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id         SERIAL        PRIMARY KEY,
          user_id    VARCHAR(36)   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type       VARCHAR(64)   NOT NULL,
          title      VARCHAR(255)  NOT NULL,
          body       TEXT,
          meta       JSONB         NOT NULL DEFAULT '{}',
          park_id    VARCHAR(10),
          is_read    BOOLEAN       NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);

      // ── Workflow Events (migration 004) ───────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS workflow_events (
          id          SERIAL        PRIMARY KEY,
          event_type  VARCHAR(64)   NOT NULL,
          actor_id    VARCHAR(36),
          actor_email VARCHAR(255),
          entity_type VARCHAR(50),
          entity_id   VARCHAR(100),
          park_id     VARCHAR(10),
          meta        JSONB         NOT NULL DEFAULT '{}',
          created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        )
      `);

      // ── Seed roles (fixed IDs) ────────────────────────────────────────────
      const roleRows = [
        [1, 'Super Admin',     'Full system access across all parks'],
        [2, 'Corporate Admin', 'Cross-park analytics and user management'],
        [3, 'Finance Head',    'Revenue, finance data, and approvals'],
        [4, 'Park Manager',    'Single or multi-park operational management'],
        [5, 'Cashier',         'Ticket sales and daily operations'],
        [6, 'Authority User',  'Read-only regulatory and audit access'],
      ];
      for (const [id, name, description] of roleRows) {
        await client.query(
          `INSERT INTO roles (id, name, description) VALUES ($1,$2,$3)
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
          [id, name, description]
        );
      }
      await client.query(`SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles))`);

      // ── Operations tables (P1 + P2) ──────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS park_operational_settings (
          park_id                 VARCHAR(10) PRIMARY KEY REFERENCES parks(id) ON DELETE CASCADE,
          supports_entry_tracking BOOLEAN NOT NULL DEFAULT false,
          supports_devices        BOOLEAN NOT NULL DEFAULT false,
          supports_zones          BOOLEAN NOT NULL DEFAULT false,
          supports_gates          BOOLEAN NOT NULL DEFAULT false,
          supports_shifts         BOOLEAN NOT NULL DEFAULT false,
          extra                   JSONB   NOT NULL DEFAULT '{}',
          updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS park_zones (
          id         VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          park_id    VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          name       VARCHAR(100) NOT NULL,
          zone_type  VARCHAR(50)  NOT NULL DEFAULT 'General',
          is_active  BOOLEAN      NOT NULL DEFAULT true,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS park_gates (
          id                    VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          park_id               VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          zone_id               VARCHAR(36)  REFERENCES park_zones(id) ON DELETE SET NULL,
          name                  VARCHAR(100) NOT NULL,
          gate_type             VARCHAR(30)  NOT NULL DEFAULT 'Entry',
          occupancy_enabled     BOOLEAN      NOT NULL DEFAULT false,
          is_active             BOOLEAN      NOT NULL DEFAULT true,
          op_status             VARCHAR(20)  NOT NULL DEFAULT 'Inactive',
          throughput_today      INTEGER      NOT NULL DEFAULT 0,
          rejection_count_today INTEGER      NOT NULL DEFAULT 0,
          deleted_at            TIMESTAMPTZ,
          created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_gate_type CHECK (gate_type IN ('Entry','Exit','Mixed','VIP','Staff','Emergency','Validation Only')),
          CONSTRAINT chk_gate_op_status CHECK (op_status IN ('Active','Inactive','Congested','Maintenance'))
        )
      `);

      await client.query(`
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS park_counters (
          id                 VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          park_id            VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          zone_id            VARCHAR(36)  REFERENCES park_zones(id) ON DELETE SET NULL,
          name               VARCHAR(100) NOT NULL,
          counter_type       VARCHAR(30)  NOT NULL DEFAULT 'Ticketing',
          is_active          BOOLEAN      NOT NULL DEFAULT true,
          op_status          VARCHAR(20)  NOT NULL DEFAULT 'Inactive',
          assigned_user_id   VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          assigned_device_id VARCHAR(36)  REFERENCES park_devices(id) ON DELETE SET NULL,
          current_shift_id   VARCHAR(36),
          deleted_at         TIMESTAMPTZ,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_counter_type CHECK (counter_type IN ('Ticketing','Refund','VIP','Self-Service','Parking','Temporary')),
          CONSTRAINT chk_counter_op_status CHECK (op_status IN ('Active','Inactive','Maintenance','Shift Open','Shift Closed'))
        )
      `);

      await client.query(`
        ALTER TABLE park_devices ADD COLUMN IF NOT EXISTS counter_id VARCHAR(36) REFERENCES park_counters(id) ON DELETE SET NULL
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS shift_sessions (
          id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          park_id           VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          counter_id        VARCHAR(36)  REFERENCES park_counters(id) ON DELETE SET NULL,
          user_id           VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          supervisor_id     VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          status            VARCHAR(20)  NOT NULL DEFAULT 'Open',
          opened_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          closed_at         TIMESTAMPTZ,
          opening_cash      NUMERIC(12,2),
          declared_cash     NUMERIC(12,2),
          expected_rev      NUMERIC(12,2),
          actual_rev        NUMERIC(12,2),
          variance          NUMERIC(12,2) GENERATED ALWAYS AS (actual_rev - expected_rev) STORED,
          transaction_count INTEGER      NOT NULL DEFAULT 0,
          refund_count      INTEGER      NOT NULL DEFAULT 0,
          notes             TEXT,
          created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_shift_status CHECK (status IN ('Open','Operating','Closed','Reconciled','Variance Flagged'))
        )
      `);

      /* Add FK from park_counters.current_shift_id → shift_sessions — ignore if already exists */
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_counter_current_shift'
          ) THEN
            ALTER TABLE park_counters
              ADD CONSTRAINT fk_counter_current_shift
              FOREIGN KEY (current_shift_id) REFERENCES shift_sessions(id) ON DELETE SET NULL;
          END IF;
        END$$
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS device_heartbeats (
          id          BIGSERIAL   PRIMARY KEY,
          device_id   VARCHAR(36) NOT NULL REFERENCES park_devices(id) ON DELETE CASCADE,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          status      VARCHAR(20) NOT NULL DEFAULT 'Online',
          meta        JSONB       NOT NULL DEFAULT '{}'
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS device_assignments (
          id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
          device_id     VARCHAR(36)  NOT NULL REFERENCES park_devices(id) ON DELETE CASCADE,
          counter_id    VARCHAR(36)  REFERENCES park_counters(id) ON DELETE SET NULL,
          user_id       VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          assigned_by   VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          unassigned_by VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          unassigned_at TIMESTAMPTZ,
          reason        TEXT
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS occupancy_events (
          id          BIGSERIAL   PRIMARY KEY,
          park_id     VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          gate_id     VARCHAR(36) REFERENCES park_gates(id) ON DELETE SET NULL,
          event_type  VARCHAR(10) NOT NULL,
          ticket_ref  VARCHAR(20),
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          meta        JSONB       NOT NULL DEFAULT '{}',
          CONSTRAINT chk_occ_event_type CHECK (event_type IN ('entry','exit','est_exit'))
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS operational_events (
          id          BIGSERIAL   PRIMARY KEY,
          event_type  VARCHAR(60) NOT NULL,
          park_id     VARCHAR(10) REFERENCES parks(id) ON DELETE SET NULL,
          actor_id    VARCHAR(36),
          target_type VARCHAR(50),
          target_id   VARCHAR(36),
          payload     JSONB       NOT NULL DEFAULT '{}',
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // ── P3: Extend park_operational_settings with alert thresholds ────────
      await client.query(`ALTER TABLE park_operational_settings ADD COLUMN IF NOT EXISTS occupancy_warning_pct NUMERIC(5,2) NOT NULL DEFAULT 80`);
      await client.query(`ALTER TABLE park_operational_settings ADD COLUMN IF NOT EXISTS occupancy_critical_pct NUMERIC(5,2) NOT NULL DEFAULT 95`);
      await client.query(`ALTER TABLE park_operational_settings ADD COLUMN IF NOT EXISTS heartbeat_stale_mins INT NOT NULL DEFAULT 15`);
      await client.query(`ALTER TABLE park_operational_settings ADD COLUMN IF NOT EXISTS offline_alert_mins INT NOT NULL DEFAULT 30`);

      // ── P3: Operational alerts ────────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS operational_alerts (
          id              BIGSERIAL   PRIMARY KEY,
          park_id         VARCHAR(10) REFERENCES parks(id) ON DELETE CASCADE,
          alert_type      VARCHAR(60) NOT NULL,
          severity        VARCHAR(10) NOT NULL DEFAULT 'medium',
          title           VARCHAR(200) NOT NULL,
          body            TEXT,
          target_type     VARCHAR(50),
          target_id       VARCHAR(36),
          status          VARCHAR(20) NOT NULL DEFAULT 'open',
          auto_resolve    BOOLEAN     NOT NULL DEFAULT true,
          acknowledged_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
          acknowledged_at TIMESTAMPTZ,
          resolved_at     TIMESTAMPTZ,
          meta            JSONB       NOT NULL DEFAULT '{}',
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_alert_severity CHECK (severity IN ('critical','high','medium','low','info')),
          CONSTRAINT chk_alert_status   CHECK (status   IN ('open','acknowledged','resolved','suppressed'))
        )
      `);

      // ── P3: Occupancy snapshots ───────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS occupancy_snapshots (
          id                 BIGSERIAL   PRIMARY KEY,
          park_id            VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          tracking_mode      VARCHAR(20) NOT NULL DEFAULT 'none',
          entries_total      INTEGER     NOT NULL DEFAULT 0,
          exits_total        INTEGER     NOT NULL DEFAULT 0,
          current_occupancy  INTEGER     NOT NULL DEFAULT 0,
          peak_occupancy     INTEGER     NOT NULL DEFAULT 0,
          capacity           INTEGER     NOT NULL DEFAULT 0,
          occupancy_pct      NUMERIC(5,1),
          status             VARCHAR(30) NOT NULL DEFAULT 'unknown',
          snapshot_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // ── P3: Operational incidents ─────────────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS operational_incidents (
          id               BIGSERIAL    PRIMARY KEY,
          park_id          VARCHAR(10)  REFERENCES parks(id) ON DELETE CASCADE,
          incident_type    VARCHAR(60)  NOT NULL DEFAULT 'custom',
          severity         VARCHAR(10)  NOT NULL DEFAULT 'medium',
          title            VARCHAR(200) NOT NULL,
          description      TEXT,
          status           VARCHAR(20)  NOT NULL DEFAULT 'open',
          target_type      VARCHAR(50),
          target_id        VARCHAR(36),
          reported_by      VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          assigned_to      VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          alert_id         BIGINT       REFERENCES operational_alerts(id) ON DELETE SET NULL,
          resolved_by      VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
          resolved_at      TIMESTAMPTZ,
          resolution_notes TEXT,
          meta             JSONB        NOT NULL DEFAULT '{}',
          created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_incident_severity CHECK (severity IN ('critical','high','medium','low','info')),
          CONSTRAINT chk_incident_status   CHECK (status   IN ('open','investigating','resolved','closed'))
        )
      `);

      // ── Finance tables (migration 004) ──────────────────────────────────
      await client.query(`
        CREATE TABLE IF NOT EXISTS gst_rates (
          id             SERIAL       PRIMARY KEY,
          category       VARCHAR(64)  NOT NULL,
          cgst_pct       NUMERIC(5,2) NOT NULL,
          sgst_pct       NUMERIC(5,2) NOT NULL,
          igst_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
          effective_from DATE         NOT NULL,
          effective_to   DATE,
          created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        INSERT INTO gst_rates (category, cgst_pct, sgst_pct, effective_from) VALUES
          ('Entry',5.00,5.00,'2024-01-01'),('F&B',5.00,5.00,'2024-01-01'),
          ('Merchandise',5.00,5.00,'2024-01-01'),('Event',5.00,5.00,'2024-01-01'),
          ('default',5.00,5.00,'2024-01-01')
        ON CONFLICT DO NOTHING
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS tax_invoice_sequences (
          park_id   VARCHAR(10) NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          fy_prefix VARCHAR(12) NOT NULL,
          last_seq  INTEGER     NOT NULL DEFAULT 0,
          PRIMARY KEY (park_id, fy_prefix)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS park_settings (
          park_id    VARCHAR(10) PRIMARY KEY REFERENCES parks(id) ON DELETE CASCADE,
          settings   JSONB       NOT NULL DEFAULT '{}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS settlement_periods (
          id           SERIAL       PRIMARY KEY,
          park_id      VARCHAR(10)  NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
          period_date  DATE         NOT NULL,
          status       VARCHAR(32)  NOT NULL DEFAULT 'open',
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
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
          id             SERIAL      PRIMARY KEY,
          settlement_id  INTEGER     NOT NULL REFERENCES settlement_periods(id) ON DELETE CASCADE,
          exception_type VARCHAR(64) NOT NULL,
          severity       VARCHAR(16) NOT NULL DEFAULT 'medium',
          expected_amt   NUMERIC(14,2),
          actual_amt     NUMERIC(14,2),
          variance       NUMERIC(14,2),
          resolved       BOOLEAN     NOT NULL DEFAULT FALSE,
          resolved_by    VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
          resolved_at    TIMESTAMPTZ,
          notes          TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS refund_requests (
          id                 SERIAL      PRIMARY KEY,
          ticket_id          INTEGER,
          requested_by       VARCHAR(36) NOT NULL REFERENCES users(id),
          approved_by        VARCHAR(36) REFERENCES users(id),
          reversal_ticket_id INTEGER,
          amount             NUMERIC(14,2) NOT NULL,
          reason             TEXT          NOT NULL,
          status             VARCHAR(32)   NOT NULL DEFAULT 'pending',
          rejection_reason   TEXT,
          requested_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
          approved_at        TIMESTAMPTZ,
          processed_at       TIMESTAMPTZ
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS finance_approvals (
          id          SERIAL       PRIMARY KEY,
          entity_type VARCHAR(64)  NOT NULL,
          entity_id   INTEGER      NOT NULL,
          action      VARCHAR(32)  NOT NULL,
          actor_id    VARCHAR(36)  NOT NULL REFERENCES users(id),
          actor_email VARCHAR(255) NOT NULL,
          notes       TEXT,
          created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS generated_reports (
          id           SERIAL      PRIMARY KEY,
          report_type  VARCHAR(64) NOT NULL,
          park_id      VARCHAR(10) REFERENCES parks(id) ON DELETE SET NULL,
          period_start DATE        NOT NULL,
          period_end   DATE        NOT NULL,
          generated_by VARCHAR(36) NOT NULL REFERENCES users(id),
          file_path    TEXT,
          meta         JSONB       NOT NULL DEFAULT '{}',
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      // ── Seed permissions ──────────────────────────────────────────────────
      const permRows = [
        ['dashboard.view','View Dashboard'], ['analytics.view','View Analytics'],
        ['analytics.export','Export Analytics'], ['tickets.view','View Tickets'],
        ['tickets.create','Create Tickets'], ['tickets.cancel','Cancel Tickets'],
        ['parks.view','View Parks'], ['parks.create','Create Parks'],
        ['parks.edit','Edit Parks'], ['parks.delete','Delete Parks'],
        ['users.view','View Users'], ['users.create','Create Users'],
        ['users.edit','Edit Users'], ['users.delete','Delete Users'],
        ['roles.view','View Roles'], ['roles.manage','Manage Roles'],
        ['finance.view','View Finance'], ['finance.approve','Approve Finance'],
        ['finance.refund','Submit and process refund requests'],
        ['finance.reconcile','View and manage reconciliation exceptions'],
        ['reports.view','View Reports'], ['reports.export','Export Reports'],
        // P1 operations permissions
        ['zones.view','View Zones'], ['zones.create','Create Zones'],
        ['zones.edit','Edit Zones'], ['zones.delete','Delete Zones'],
        ['counters.view','View Counters'], ['counters.create','Create Counters'],
        ['counters.edit','Edit Counters'], ['counters.delete','Delete Counters'],
        ['devices.view','View Devices'], ['devices.create','Create Devices'],
        ['devices.edit','Edit Devices'], ['devices.delete','Delete Devices'],
        ['gates.view','View Gates'], ['gates.create','Create Gates'],
        ['gates.edit','Edit Gates'], ['gates.delete','Delete Gates'],
        ['shifts.view','View Shifts'], ['shifts.create','Open Shifts'],
        ['shifts.edit','Edit Shifts'], ['shifts.close','Close and Settle Shifts'],
        // P3 permissions
        ['alerts.view','View Operational Alerts'], ['alerts.manage','Manage Operational Alerts'],
        ['incidents.view','View Incidents'], ['incidents.create','Create Incidents'],
        ['incidents.manage','Manage Incidents'], ['occupancy.view','View Occupancy'],
      ];
      for (const [name, label] of permRows) {
        await client.query(
          `INSERT INTO permissions (name, label) VALUES ($1,$2)
           ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label`,
          [name, label]
        );
      }

      const { rows: pl } = await client.query('SELECT id, name FROM permissions');
      const pid = Object.fromEntries(pl.map(p => [p.name, p.id]));
      const ALL = pl.map(p => p.id);

      const rolePerms = {
        1: ALL,
        2: ['dashboard.view','analytics.view','analytics.export','tickets.view',
            'parks.view','users.view','users.create','users.edit',
            'finance.view','reports.view','reports.export',
            'zones.view','counters.view','devices.view','gates.view','shifts.view',
            'alerts.view','incidents.view','occupancy.view'].map(n => pid[n]).filter(Boolean),
        3: ['dashboard.view','analytics.view','analytics.export',
            'tickets.view','finance.view','finance.approve',
            'finance.refund','finance.reconcile',
            'reports.view','reports.export',
            'shifts.view','counters.view',
            'alerts.view','occupancy.view'].map(n => pid[n]).filter(Boolean),
        4: ['dashboard.view','analytics.view','tickets.view','tickets.create',
            'tickets.cancel','parks.view','parks.edit','users.view','reports.view',
            'zones.view','zones.create','zones.edit','zones.delete',
            'counters.view','counters.create','counters.edit','counters.delete',
            'devices.view','devices.create','devices.edit','devices.delete',
            'gates.view','gates.create','gates.edit','gates.delete',
            'shifts.view','shifts.create','shifts.edit','shifts.close',
            'alerts.view','alerts.manage','incidents.view','incidents.create','incidents.manage','occupancy.view'].map(n => pid[n]).filter(Boolean),
        5: ['dashboard.view','tickets.view','tickets.create',
            'counters.view','devices.view','shifts.view','shifts.create','shifts.close',
            'alerts.view','occupancy.view'].map(n => pid[n]).filter(Boolean),
        6: ['dashboard.view','analytics.view','parks.view','reports.view',
            'zones.view','counters.view','devices.view','gates.view','shifts.view',
            'alerts.view','incidents.view','occupancy.view'].map(n => pid[n]).filter(Boolean),
      };

      for (const [roleId, permIds] of Object.entries(rolePerms)) {
        for (const permId of permIds) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)
             ON CONFLICT DO NOTHING`,
            [parseInt(roleId), permId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log('[globalSetup] Test database ready:', TEST_DB);
  } finally {
    await pool.end();
  }
};
