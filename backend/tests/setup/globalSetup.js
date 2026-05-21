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
            'finance.view','reports.view','reports.export'].map(n => pid[n]),
        3: ['dashboard.view','analytics.view','analytics.export',
            'tickets.view','finance.view','finance.approve',
            'finance.refund','finance.reconcile',
            'reports.view','reports.export'].map(n => pid[n]),
        4: ['dashboard.view','analytics.view','tickets.view','tickets.create',
            'tickets.cancel','parks.view','parks.edit',
            'users.view','reports.view'].map(n => pid[n]),
        5: ['dashboard.view','tickets.view','tickets.create'].map(n => pid[n]),
        6: ['dashboard.view','analytics.view','parks.view','reports.view'].map(n => pid[n]),
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
