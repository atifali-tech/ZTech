'use strict';
const path     = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TEST_DB = 'zingparks_test';

module.exports = async function globalTeardown() {
  // Terminate active connections to the test DB before dropping
  const adminPool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM   pg_stat_activity
      WHERE  datname = $1 AND pid <> pg_backend_pid()
    `, [TEST_DB]);
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    console.log('[globalTeardown] Test database dropped:', TEST_DB);
  } finally {
    await adminPool.end();
  }
};
