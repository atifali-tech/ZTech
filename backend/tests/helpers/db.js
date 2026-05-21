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

module.exports = {
  createTestPool,
  createTestUser,
  createTestPark,
  assignUserPark,
  assignRolePermissions,
  resetDatabase,
};
