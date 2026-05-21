'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
  const checks = [
    ['parks',               'SELECT COUNT(*) FROM parks'],
    ['users',               'SELECT COUNT(*) FROM users'],
    ['tickets',             'SELECT COUNT(*) FROM tickets'],
    ['visitor_demographics','SELECT COUNT(*) FROM visitor_demographics'],
    ['revenue_categories',  'SELECT COUNT(*) FROM revenue_categories'],
    ['sample ticket park_id', "SELECT DISTINCT park_id FROM tickets LIMIT 3"],
    ['parks in DB',         "SELECT id, name FROM parks"],
  ];
  for (const [label, sql] of checks) {
    const { rows } = await pool.query(sql);
    console.log(`${label}:`, JSON.stringify(rows));
  }
}
main().then(() => pool.end()).catch(e => { console.error(e.message); pool.end(); });
