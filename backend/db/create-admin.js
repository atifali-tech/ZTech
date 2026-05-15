/**
 * Creates the users table (if not exists) and inserts the default admin user.
 * Run: node db/create-admin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt   = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

async function run() {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(150) NOT NULL UNIQUE,
        password_hash TEXT         NOT NULL,
        role          VARCHAR(30)  NOT NULL DEFAULT 'Cashier',
        park_id       VARCHAR(10)  REFERENCES parks(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ users table ready');

    // Check if admin already exists
    const { rows } = await client.query(`SELECT id FROM users WHERE email = 'admin@zingparks.com'`);
    if (rows.length > 0) {
      console.log('ℹ️  Admin user already exists — skipping insert');
    } else {
      const hash = await bcrypt.hash('Admin@12345', 10);
      await client.query(
        `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)`,
        [uuidv4(), 'Admin', 'admin@zingparks.com', hash, 'Super Admin']
      );
      console.log('✅ Admin user created');
      console.log('   Email:    admin@zingparks.com');
      console.log('   Password: Admin@12345');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
