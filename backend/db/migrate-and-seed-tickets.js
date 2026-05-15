/**
 * Creates tickets table and seeds ~300 sample transactions using real park UUIDs.
 * Run: node db/migrate-and-seed-tickets.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

const AGE_CATS   = ['adult', 'kid', 'toddler', 'senior'];
const PAY_MODES  = ['Cash', 'UPI', 'Card'];
const STATUSES   = ['Confirmed', 'Confirmed', 'Confirmed', 'Confirmed', 'Cancelled', 'Refunded'];
const PRICES     = { adult: 350, kid: 200, toddler: 100, senior: 150 };
const GST_RATE   = 0.05;

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(rnd(9, 20), rnd(0, 59), rnd(0, 59));
  return d.toISOString();
}

async function run() {
  const client = await pool.connect();
  try {
    // Fetch real park UUIDs
    const { rows: parks } = await client.query('SELECT id FROM parks');
    if (!parks.length) { console.error('❌ No parks found — run seed.js first'); process.exit(1); }
    const parkIds = parks.map(p => p.id);

    // Fetch admin user UUID for cashier_id
    const { rows: users } = await client.query('SELECT id FROM users LIMIT 1');
    const cashierId = users[0]?.id || null;

    // Drop & recreate tickets table with correct UUID references
    await client.query('DROP TABLE IF EXISTS tickets CASCADE');
    await client.query(`
      CREATE TABLE tickets (
        ticket_id     VARCHAR(20)   PRIMARY KEY,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        park_id       UUID          NOT NULL REFERENCES parks(id),
        age_category  VARCHAR(20)   NOT NULL,
        quantity      SMALLINT      NOT NULL DEFAULT 1,
        amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
        cgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
        sgst_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
        total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
        cash_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
        upi_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
        card_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
        payment_mode  VARCHAR(20)   NOT NULL DEFAULT 'Cash',
        status        VARCHAR(20)   NOT NULL DEFAULT 'Confirmed',
        cashier_id    UUID          REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ tickets table created');

    // Seed 300 tickets over last 30 days
    for (let i = 0; i < 300; i++) {
      const parkId    = pick(parkIds);
      const ageCat    = pick(AGE_CATS);
      const qty       = rnd(1, 6);
      const amount    = qty * PRICES[ageCat];
      const cgst      = parseFloat((amount * GST_RATE).toFixed(2));
      const sgst      = parseFloat((amount * GST_RATE).toFixed(2));
      const total     = amount + cgst + sgst;
      const payMode   = pick(PAY_MODES);
      const status    = pick(STATUSES);
      const daysAgo   = rnd(0, 29);
      const ticketId  = 'TKT' + String(Date.now()).slice(-5) + String(i).padStart(5, '0');

      const cashAmt = payMode === 'Cash' ? total : 0;
      const upiAmt  = payMode === 'UPI'  ? total : 0;
      const cardAmt = payMode === 'Card' ? total : 0;

      await client.query(`
        INSERT INTO tickets
          (ticket_id, created_at, park_id, age_category, quantity,
           amount, cgst_amount, sgst_amount, total_amount,
           cash_amount, upi_amount, card_amount, payment_mode, status, cashier_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      `, [
        ticketId, randomDate(daysAgo), parkId, ageCat, qty,
        amount, cgst, sgst, total,
        cashAmt, upiAmt, cardAmt, payMode, status, cashierId,
      ]);
    }

    console.log('✅ Seeded 300 tickets across last 30 days');
    console.log('\n🎉 /api/tickets is ready.');
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
