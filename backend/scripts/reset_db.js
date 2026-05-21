'use strict';
/**
 * Development helper — drops and recreates the DB, then runs all migrations.
 * WARNING: Destroys all data. For dev/fresh-server setup only.
 *
 * Usage: node scripts/reset_db.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const { execSync } = require('child_process');

const DB_NAME = process.env.DB_NAME || 'zingparks';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASS = process.env.DB_PASSWORD || '';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';

async function main() {
  // Connect to postgres (maintenance DB) to drop/create
  const adminPool = new Pool({
    host: DB_HOST, port: DB_PORT,
    database: 'postgres',
    user: DB_USER, password: DB_PASS,
  });

  try {
    console.log(`Dropping database "${DB_NAME}" (if it exists)...`);
    // Terminate active connections first
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [DB_NAME]);

    await adminPool.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
    console.log(`Creating database "${DB_NAME}"...`);
    await adminPool.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log('Database reset complete.\n');
  } finally {
    await adminPool.end();
  }

  // Run migrations
  console.log('Running migrations...\n');
  execSync('node scripts/migrate.js', { stdio: 'inherit' });
}

main().catch(err => {
  console.error('Reset failed:', err.message);
  process.exit(1);
});
