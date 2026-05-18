/**
 * Inserts tickets for specific dates without touching existing data.
 * Run: node db/topup-tickets.js
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

const AGE_CATS  = ['adult', 'kid', 'toddler', 'senior'];
const PAY_MODES = ['Cash', 'UPI', 'Card'];
const STATUSES  = ['Confirmed', 'Confirmed', 'Confirmed', 'Confirmed', 'Cancelled'];
const PRICES    = { adult: 350, kid: 200, toddler: 100, senior: 150 };
const GST_RATE  = 0.05;

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

async function run() {
  const client = await pool.connect();
  try {
    const { rows: parks } = await client.query('SELECT id FROM parks');
    const { rows: users } = await client.query('SELECT id FROM users LIMIT 1');
    const parkIds  = parks.map(p => p.id);
    const cashierId = users[0]?.id || null;

    // Dates to fill in — add or adjust as needed
    const datesToFill = ['2026-05-16', '2026-05-17', '2026-05-18'];
    let total = 0;

    for (const dateStr of datesToFill) {
      const count = rnd(18, 28);
      for (let i = 0; i < count; i++) {
        const parkId  = pick(parkIds);
        const ageCat  = pick(AGE_CATS);
        const qty     = rnd(1, 5);
        const amount  = qty * PRICES[ageCat];
        const cgst    = parseFloat((amount * GST_RATE).toFixed(2));
        const sgst    = parseFloat((amount * GST_RATE).toFixed(2));
        const totalAmt = amount + cgst + sgst;
        const payMode = pick(PAY_MODES);
        const status  = pick(STATUSES);
        const hour    = rnd(9, 20);
        const min     = rnd(0, 59);
        const sec     = rnd(0, 59);
        const ts      = `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}+05:30`;
        const ticketId = 'TKT' + String(Date.now()).slice(-5) + String(total).padStart(5, '0');

        await client.query(`
          INSERT INTO tickets
            (ticket_id, created_at, park_id, age_category, quantity,
             amount, cgst_amount, sgst_amount, total_amount,
             cash_amount, upi_amount, card_amount, payment_mode, status, cashier_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          ON CONFLICT (ticket_id) DO NOTHING
        `, [
          ticketId, ts, parkId, ageCat, qty,
          amount, cgst, sgst, totalAmt,
          payMode === 'Cash' ? totalAmt : 0,
          payMode === 'UPI'  ? totalAmt : 0,
          payMode === 'Card' ? totalAmt : 0,
          payMode, status, cashierId,
        ]);
        total++;
      }
      console.log(`✅ ${dateStr}: ${count} tickets inserted`);
    }

    console.log(`\n🎉 Done — ${total} tickets added`);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
