'use strict';
/**
 * Seed realistic ticket data for all parks that have fewer than 50 tickets.
 * Generates ~6 months of history so all dashboard widgets have data.
 *
 * Usage:  node scripts/seed-multi-park-tickets.js
 * Safe:   only inserts into parks that are below the ticket threshold.
 *         Run etl-bootstrap.js afterwards to refresh analytics tables.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

const AGE_CATS   = ['Adult', 'Child', 'Toddler', 'Senior Citizen'];
const GENDERS    = ['Male', 'Male', 'Female', 'Female', 'Other'];
const PAY_MODES  = ['UPI', 'UPI', 'Cash', 'Card'];
const SOURCES    = ['Counter', 'Counter', 'Web', 'WhatsApp'];
const PRICES     = { Adult: 350, Child: 200, Toddler: 100, 'Senior Citizen': 150 };
const GST_RATE   = 0.05;

// Relative visitor volume weight per park (ZP001 is the flagship, others smaller)
const PARK_WEIGHT = {
  ZP001: 1.0, ZP002: 0.55, ZP003: 0.42, ZP004: 0.38,
  ZP005: 0.28, ZP006: 0.25, ZP007: 0.32,
};

// Day-of-week multiplier — weekends busier
const DOW_MULT = [0.55, 0.45, 0.50, 0.55, 0.80, 1.20, 1.10]; // Mon–Sun

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }

function makeId(prefix, counter) {
  return prefix + String(Date.now()).slice(-6) + String(counter).padStart(5, '0');
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows: parks }   = await client.query('SELECT id FROM parks ORDER BY id');
    const { rows: cashiers } = await client.query(
      "SELECT id FROM users WHERE role = 'Cashier' OR role = 'Park Manager' LIMIT 10"
    );
    const fallback = (await client.query('SELECT id FROM users LIMIT 1')).rows[0]?.id;

    // Check which parks need seeding
    const { rows: counts } = await client.query(`
      SELECT park_id, COUNT(*) AS cnt FROM tickets GROUP BY park_id
    `);
    const countByPark = Object.fromEntries(counts.map(r => [r.park_id, parseInt(r.cnt)]));

    const parkIds = parks.map(p => p.id);
    const parksToseed = parkIds.filter(id => (countByPark[id] || 0) < 50);

    if (!parksToseed.length) {
      console.log('✅ All parks already have sufficient ticket data. Nothing to seed.');
      return;
    }

    console.log(`Seeding tickets for: ${parksToseed.join(', ')}`);

    // Generate 6 months of history: Dec 2025 → May 2026
    const START = new Date('2025-12-01T00:00:00+05:30');
    const END   = new Date('2026-05-25T23:59:59+05:30');

    let total = 0;
    let counter = 0;

    for (const parkId of parksToseed) {
      const weight   = PARK_WEIGHT[parkId] || 0.3;
      const cashiers = cashiers.length ? cashiers : [{ id: fallback }];

      const cursor = new Date(START);
      while (cursor <= END) {
        const dow       = cursor.getDay(); // 0=Sun, 6=Sat
        const dowIdx    = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
        const dailyMult = DOW_MULT[dowIdx];

        // Base 8–20 tickets/day for ZP001-weight park; scale by weight & dow
        const baseTickets = Math.round((rnd(8, 20) * weight * dailyMult));
        const numTickets  = Math.max(1, baseTickets);

        for (let t = 0; t < numTickets; t++) {
          const ageCat  = pick(AGE_CATS);
          const qty     = rnd(1, 4);
          const base    = qty * PRICES[ageCat];
          const cgst    = parseFloat((base * GST_RATE).toFixed(2));
          const sgst    = parseFloat((base * GST_RATE).toFixed(2));
          const total_amount = base + cgst + sgst;
          const payMode = pick(PAY_MODES);
          const source  = pick(SOURCES);
          const gender  = pick(GENDERS);
          const hour    = rnd(9, 19);
          const min     = rnd(0, 59);
          const sec     = rnd(0, 59);

          const dateStr = cursor.toISOString().slice(0, 10);
          const ts      = `${dateStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}+05:30`;
          const ticketId = makeId('TK', counter++);
          const cashier  = pick(cashiers).id || fallback;

          await client.query(`
            INSERT INTO tickets
              (ticket_id, created_at, park_id, age_category, gender, quantity,
               amount, cgst_amount, sgst_amount, total_amount,
               cash_amount, upi_amount, card_amount,
               payment_mode, source, status, cashier_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (ticket_id) DO NOTHING
          `, [
            ticketId, ts, parkId, ageCat, gender, qty,
            base, cgst, sgst, total_amount,
            payMode === 'Cash' ? total_amount : 0,
            payMode === 'UPI'  ? total_amount : 0,
            payMode === 'Card' ? total_amount : 0,
            payMode, source, 'Confirmed', cashier,
          ]);
          total++;
        }

        cursor.setDate(cursor.getDate() + 1);
      }
      console.log(`  ✅ ${parkId}: done`);
    }

    console.log(`\n🎉 Inserted ${total} tickets across ${parksToseed.length} parks.`);
    console.log('   Now run:  node scripts/etl-bootstrap.js');
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
