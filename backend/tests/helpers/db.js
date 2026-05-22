'use strict';
const path     = require('path');
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');
const { randomUUID: uuid } = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TEST_DB = 'zingparks_test';

function createTestPool() {
  return new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: TEST_DB,
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });
}

async function createTestUser(pool, { name, email, role, roleId, password = 'testpass123', id } = {}) {
  const userId = id || uuid();
  const hash   = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, role_id)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, role = EXCLUDED.role, role_id = EXCLUDED.role_id
     RETURNING id, name, email, role, role_id`,
    [userId, name, email, hash, role, roleId]
  );
  return rows[0];
}

async function createTestPark(pool, { id, name, city = 'Test City', state = 'Test State', color_hex = '#1D9E75', capacity = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO parks (id, name, city, state, color_hex, capacity)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state
     RETURNING id, name, city, state, color_hex, capacity`,
    [id, name, city, state, color_hex, capacity]
  );
  return rows[0];
}

async function assignUserPark(pool, userId, parkId) {
  await pool.query(
    `INSERT INTO user_parks (user_id, park_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [userId, parkId]
  );
}

async function assignRolePermissions(pool, roleId, permissionNames) {
  const { rows } = await pool.query(
    `SELECT id, name FROM permissions WHERE name = ANY($1::text[])`,
    [permissionNames]
  );
  const pid = Object.fromEntries(rows.map(p => [p.name, p.id]));

  await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  for (const name of permissionNames) {
    if (pid[name]) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [roleId, pid[name]]
      );
    }
  }
}

// Wipes all transactional data; keeps roles / permissions / role_permissions seed data.
async function resetDatabase(pool) {
  await pool.query(`
    TRUNCATE
      operational_incidents,
      operational_alerts,
      occupancy_snapshots,
      operational_events,
      occupancy_events,
      device_heartbeats,
      device_assignments,
      shift_sessions,
      park_devices,
      park_counters,
      park_gates,
      park_zones,
      park_operational_settings,
      finance_approvals,
      refund_requests,
      reconciliation_exceptions,
      settlement_periods,
      generated_reports,
      gst_rates,
      tax_invoice_sequences,
      park_settings,
      workflow_events,
      notifications,
      audit_log,
      tickets,
      user_parks,
      users,
      daily_stats,
      demographics,
      revenue_by_demographic,
      revenue_by_category,
      revenue_by_source,
      revenue_by_payment,
      hourly_stats,
      heatmap_data,
      weekend_weekday,
      quarterly_revenue,
      monthly_revenue,
      top_parks_metrics,
      revenue_trend,
      visitor_demographics,
      revenue_categories,
      parks
    RESTART IDENTITY CASCADE
  `);
}

// ── Operations test helpers ───────────────────────────────────────────────────

async function createTestZone(pool, { park_id, name = 'Test Zone', zone_type = 'General' } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO park_zones (park_id, name, zone_type) VALUES ($1,$2,$3) RETURNING *`,
    [park_id, name, zone_type]
  );
  return rows[0];
}

async function createTestCounter(pool, { park_id, name = 'Counter A', counter_type = 'Ticketing', zone_id = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO park_counters (park_id, name, counter_type, zone_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [park_id, name, counter_type, zone_id]
  );
  return rows[0];
}

async function createTestDevice(pool, { park_id, name = 'POS-01', device_type = 'POS', counter_id = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO park_devices (park_id, name, device_type, counter_id) VALUES ($1,$2,$3,$4) RETURNING *`,
    [park_id, name, device_type, counter_id]
  );
  return rows[0];
}

async function createTestGate(pool, { park_id, name = 'Main Gate', gate_type = 'Entry', zone_id = null, occupancy_enabled = false } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO park_gates (park_id, name, gate_type, zone_id, occupancy_enabled) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [park_id, name, gate_type, zone_id, occupancy_enabled]
  );
  return rows[0];
}

async function createTestShift(pool, { park_id, user_id, counter_id = null, status = 'Open', opening_cash = null, expected_rev = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO shift_sessions (park_id, user_id, counter_id, status, opening_cash, expected_rev)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [park_id, user_id, counter_id, status, opening_cash, expected_rev]
  );
  return rows[0];
}

async function enableParkCapability(pool, park_id, capabilities = {}) {
  const defaults = {
    supports_entry_tracking: false, supports_devices: false,
    supports_zones: false, supports_gates: false, supports_shifts: false,
    ...capabilities,
  };
  const { rows } = await pool.query(
    `INSERT INTO park_operational_settings (park_id, supports_entry_tracking, supports_devices, supports_zones, supports_gates, supports_shifts)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (park_id) DO UPDATE SET
       supports_entry_tracking = EXCLUDED.supports_entry_tracking,
       supports_devices = EXCLUDED.supports_devices,
       supports_zones = EXCLUDED.supports_zones,
       supports_gates = EXCLUDED.supports_gates,
       supports_shifts = EXCLUDED.supports_shifts,
       updated_at = NOW()
     RETURNING *`,
    [park_id, defaults.supports_entry_tracking, defaults.supports_devices,
     defaults.supports_zones, defaults.supports_gates, defaults.supports_shifts]
  );
  return rows[0];
}

async function createTestAlert(pool, { park_id, alert_type = 'stale_heartbeat', severity = 'medium', title = 'Test Alert', status = 'open', target_type = null, target_id = null, auto_resolve = true } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO operational_alerts (park_id, alert_type, severity, title, status, target_type, target_id, auto_resolve)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [park_id, alert_type, severity, title, status, target_type, target_id, auto_resolve]
  );
  return rows[0];
}

async function createTestIncident(pool, { park_id, incident_type = 'custom', severity = 'medium', title = 'Test Incident', status = 'open', reported_by = null, assigned_to = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO operational_incidents (park_id, incident_type, severity, title, status, reported_by, assigned_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [park_id, incident_type, severity, title, status, reported_by, assigned_to]
  );
  return rows[0];
}

async function recordOccupancyEvent(pool, { park_id, gate_id = null, event_type = 'entry', ticket_ref = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO occupancy_events (park_id, gate_id, event_type, ticket_ref) VALUES ($1,$2,$3,$4) RETURNING *`,
    [park_id, gate_id, event_type, ticket_ref]
  );
  return rows[0];
}

module.exports = {
  createTestPool,
  createTestUser,
  createTestPark,
  assignUserPark,
  assignRolePermissions,
  resetDatabase,
  createTestZone,
  createTestCounter,
  createTestDevice,
  createTestGate,
  createTestShift,
  enableParkCapability,
  createTestAlert,
  createTestIncident,
  recordOccupancyEvent,
};
