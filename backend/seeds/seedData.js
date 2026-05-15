'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'zingparks_local',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
});

// ─── Parks (IDs locked to zingparks_local) ────────────────────────────────────
const PARKS = [
  { name: 'Jungle Trail',  id: 'ca7c5d0f-a524-4caa-90c9-4ffbc7417f1a', w: 30, visMin: 200, visMax: 400 },
  { name: 'UP Darshan',    id: 'aa22ff42-1bb2-4dda-8ba4-20cc5f8b5aeb', w: 20, visMin: 150, visMax: 300 },
  { name: 'Harmony',       id: '061f08a0-0a82-41d4-8048-e72b20f9787e', w: 12, visMin: 100, visMax: 200 },
  { name: 'Gautam Buddha', id: '7d777110-e019-48a5-8f66-a260384790b6', w: 12, visMin: 100, visMax: 200 },
  { name: 'Shivalaya',     id: 'f05aa07f-b769-4652-98ce-9d9876fee669', w: 10, visMin:  80, visMax: 160 },
  { name: 'Saat Ajoobe',   id: '35f2b4f6-db63-4f6a-a011-e9952d785cca', w:  9, visMin:  70, visMax: 140 },
  { name: 'World Park',    id: '16f8d92f-6abc-48bf-8c21-224f0461065a', w:  7, visMin:  90, visMax: 180 },
];

// Cumulative weights for O(1) weighted park selection
const PARK_CUMW   = PARKS.reduce((a, p, i) => { a.push((a[i - 1] || 0) + p.w); return a; }, []);
const PARK_TOTALW = PARK_CUMW[PARK_CUMW.length - 1]; // 100

function pickPark() {
  const r = Math.random() * PARK_TOTALW;
  return PARKS[PARK_CUMW.findIndex(w => r < w)];
}

// ─── Users (2 cashiers per park) ──────────────────────────────────────────────
const USERS_DEF = [
  { name: 'Priya Sharma',  park: 'Jungle Trail',  email: 'priya.sharma@zingparks.in'  },
  { name: 'Vikram Nair',   park: 'Jungle Trail',  email: 'vikram.nair@zingparks.in'   },
  { name: 'Rahul Verma',   park: 'UP Darshan',    email: 'rahul.verma@zingparks.in'   },
  { name: 'Kavita Rao',    park: 'UP Darshan',    email: 'kavita.rao@zingparks.in'    },
  { name: 'Anita Singh',   park: 'Harmony',       email: 'anita.singh@zingparks.in'   },
  { name: 'Ravi Kumar',    park: 'Harmony',       email: 'ravi.kumar@zingparks.in'    },
  { name: 'Mohan Das',     park: 'Gautam Buddha', email: 'mohan.das@zingparks.in'     },
  { name: 'Neha Gupta',    park: 'Gautam Buddha', email: 'neha.gupta@zingparks.in'    },
  { name: 'Sunita Patel',  park: 'Shivalaya',     email: 'sunita.patel@zingparks.in'  },
  { name: 'Arjun Mehta',   park: 'Shivalaya',     email: 'arjun.mehta@zingparks.in'   },
  { name: 'Deepak Kumar',  park: 'Saat Ajoobe',   email: 'deepak.kumar@zingparks.in'  },
  { name: 'Pooja Tiwari',  park: 'Saat Ajoobe',   email: 'pooja.tiwari@zingparks.in'  },
  { name: 'Fatima Sheikh', park: 'World Park',    email: 'fatima.sheikh@zingparks.in' },
  { name: 'Suresh Iyer',   park: 'World Park',    email: 'suresh.iyer@zingparks.in'   },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;

// Local date string — avoids UTC offset shifting the date
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Timestamp string — stored as-is; PostgreSQL uses session timezone
function tsStr(d, h, m, s) {
  return `${dateStr(d)} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Hour pool — peak hours (10-11, 15-17) have 3× probability vs off-peak
const HOUR_POOL = [
  9,
  10, 10, 10,  11, 11, 11,
  12, 13, 14,
  15, 15, 15,  16, 16, 16,  17, 17, 17,
  18, 19, 20,
];

// Pre-built weighted pools for O(1) pick
const SOURCE_POOL  = [...Array(54).fill('Counter'), ...Array(32).fill('Web'),  ...Array(14).fill('App')];
const STATUS_POOL  = [...Array(85).fill('Completed'), ...Array(8).fill('Pending'), ...Array(5).fill('Cancelled'), ...Array(2).fill('Refunded')];
const PAYMENT_POOL = [...Array(55).fill('UPI'), ...Array(20).fill('Cash'), ...Array(18).fill('Card'), ...Array(7).fill('Split')];

const PRICES = { Adult: 120, Child: 120, Toddler: 0, 'Senior Citizen': 120 };

// Category combos — Toddler never sold alone (free entry, always bundled)
const SINGLE_CATS   = [...Array(6).fill('Adult'), ...Array(2).fill('Child'), ...Array(2).fill('Senior Citizen')];
const DOUBLE_COMBOS = [
  ['Adult', 'Child'], ['Adult', 'Child'],
  ['Adult', 'Toddler'], ['Adult', 'Toddler'],
  ['Adult', 'Senior Citizen'],
  ['Child', 'Toddler'],
];
const TRIPLE_COMBOS = [
  ['Adult', 'Child', 'Toddler'], ['Adult', 'Child', 'Toddler'],
  ['Adult', 'Senior Citizen', 'Child'],
];

const QTY = {
  Adult:            () => rand(1, 4),
  Child:            () => rand(1, 4),
  Toddler:          () => rand(1, 2),
  'Senior Citizen': () => rand(1, 2),
};

function buildCategories() {
  const r    = Math.random();
  const cats = r < 0.60 ? [pick(SINGLE_CATS)]
             : r < 0.85 ? pick(DOUBLE_COMBOS)
             :             pick(TRIPLE_COMBOS);
  return cats.map(c => ({ cat: c, qty: QTY[c]() }));
}

// Returns [cashAmt, upiAmt, cardAmt] for the row total
function splitPayment(mode, total) {
  if (mode === 'Cash') return [total, 0,     0];
  if (mode === 'UPI')  return [0,     total, 0];
  if (mode === 'Card') return [0,     0,     total];
  // Split: 40% cash / 60% UPI
  const cash = parseFloat((total * 0.4).toFixed(2));
  return [cash, parseFloat((total - cash).toFixed(2)), 0];
}

// Batch INSERT — splits into chunks to stay within PostgreSQL's 65 535 param limit
async function batchInsert(client, prefix, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice  = rows.slice(i, i + batchSize);
    const params = [];
    let   p      = 1;
    const vals   = slice.map(row => {
      const ph = row.map(() => `$${p++}`).join(',');
      params.push(...row);
      return `(${ph})`;
    });
    await client.query(`${prefix} ${vals.join(',')}`, params);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  console.log('Connected. Starting seed...\n');

  try {
    await client.query('BEGIN');

    // tickets.ticket_id has a UNIQUE constraint; multi-category rows share the same
    // ticket_id, so we drop the constraint and keep a plain index for search.
    await client.query('ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_id_key');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON tickets(ticket_id)');

    // ── A) Users ──────────────────────────────────────────────────────────────
    process.stdout.write('A) Inserting users...         ');
    const parkIdByName   = Object.fromEntries(PARKS.map(p => [p.name, p.id]));
    const cashiersByPark = {};

    for (const u of USERS_DEF) {
      const pid      = parkIdByName[u.park];
      const { rows } = await client.query(
        `INSERT INTO users (name, role, park_id, email) VALUES ($1,'Cashier',$2,$3) RETURNING id`,
        [u.name, pid, u.email],
      );
      (cashiersByPark[pid] = cashiersByPark[pid] || []).push(rows[0].id);
    }
    console.log(`${USERS_DEF.length} rows`);

    // ── B) Tickets ────────────────────────────────────────────────────────────
    process.stdout.write('B) Building tickets...        ');

    // today at end-of-day so the last iteration (d=0) covers today's full date
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const ticketRows = [];
    let seq = 1;

    for (let d = 89; d >= 0; d--) {
      const day  = new Date(today);
      day.setDate(today.getDate() - d);
      const wknd     = isWeekend(day);
      const dailyTx  = Math.round(rand(10, 18) * (wknd ? 1.4 : 1.0));

      for (let t = 0; t < dailyTx; t++) {
        const park     = pickPark();
        const ticketId = `TK-${String(seq++).padStart(5, '0')}`;
        const h        = pick(HOUR_POOL);
        const ts       = tsStr(day, h, rand(0, 59), rand(0, 59));
        const source   = pick(SOURCE_POOL);
        const payment  = pick(PAYMENT_POOL);
        const status   = pick(STATUS_POOL);
        const cashier  = pick(cashiersByPark[park.id]);

        for (const { cat, qty } of buildCategories()) {
          const base   = PRICES[cat] * qty;
          const cgst   = parseFloat((base * 0.09).toFixed(2));
          const sgst   = parseFloat((base * 0.09).toFixed(2));
          const total  = parseFloat((base + cgst + sgst).toFixed(2));
          const [cash, upi, card] = splitPayment(payment, total);

          ticketRows.push([
            ticketId, ts,       park.id,  cat,   qty,
            base,     cgst,     sgst,     total,
            cash,     upi,      card,
            payment,  status,   cashier,  source,
          ]);
        }
      }
    }

    await batchInsert(client,
      `INSERT INTO tickets
         (ticket_id, created_at, park_id,     age_category, quantity,
          amount,    cgst_amount, sgst_amount, total_amount,
          cash_amount, upi_amount, card_amount,
          payment_mode, status, cashier_id, source)
       VALUES`,
      ticketRows,
    );
    console.log(`${ticketRows.length} rows  (${seq - 1} transactions)`);

    // ── C) Visitor demographics ───────────────────────────────────────────────
    process.stdout.write('C) Building demographics...   ');

    const AGE_GROUPS  = ['0-12', '13-17', '18-35', '36-60', '60+'];
    const AGE_PCTS    = [0.25,   0.10,    0.35,    0.20,    0.10];
    const GENDERS     = ['Male', 'Female', 'Other'];
    const GENDER_PCTS = [0.55,   0.42,     0.03];
    const demoRows    = [];

    for (let d = 89; d >= 0; d--) {
      const day  = new Date(today);
      day.setDate(today.getDate() - d);
      const wknd = isWeekend(day);
      const ds   = dateStr(day);

      for (const park of PARKS) {
        const base     = rand(park.visMin, park.visMax);
        const variance = 1 + (Math.random() * 0.30 - 0.15); // ±15%
        const total    = Math.round(base * variance * (wknd ? 1.4 : 1.0));

        for (let ai = 0; ai < AGE_GROUPS.length; ai++) {
          const ageCnt = Math.round(total * AGE_PCTS[ai]);
          for (let gi = 0; gi < GENDERS.length; gi++) {
            const cnt = Math.max(0, Math.round(ageCnt * GENDER_PCTS[gi]));
            if (cnt > 0) demoRows.push([park.id, ds, AGE_GROUPS[ai], GENDERS[gi], cnt]);
          }
        }
      }
    }

    await batchInsert(client,
      `INSERT INTO visitor_demographics
         (park_id, recorded_date, age_group, gender, count)
       VALUES`,
      demoRows,
    );
    console.log(`${demoRows.length} rows`);

    // ── D) Revenue categories ─────────────────────────────────────────────────
    process.stdout.write('D) Building revenue cats...   ');

    const REV_CATS = [
      { name: 'F&B',        min:  5000, max: 25000 },
      { name: 'Activities', min:  8000, max: 40000 },
      { name: 'Parking',    min:  2000, max: 12000 },
    ];
    const revRows = [];

    for (let d = 89; d >= 0; d--) {
      const day  = new Date(today);
      day.setDate(today.getDate() - d);
      const wknd = isWeekend(day);
      const ds   = dateStr(day);

      for (const park of PARKS) {
        for (const cat of REV_CATS) {
          const base     = rand(cat.min, cat.max);
          const variance = 1 + (Math.random() * 0.30 - 0.15); // ±15%
          const amount   = parseFloat((base * variance * (wknd ? 1.4 : 1.0)).toFixed(2));
          revRows.push([park.id, ds, cat.name, amount]);
        }
      }
    }

    await batchInsert(client,
      `INSERT INTO revenue_categories (park_id, date, category, amount) VALUES`,
      revRows,
    );
    console.log(`${revRows.length} rows`);

    await client.query('COMMIT');
    console.log('\n✅ Seed complete');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
