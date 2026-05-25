/**
 * ZingParks — Database Seeder
 * Run: node db/seed.js
 * Seeds all tables with data matching the dashboard design exactly.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ─── SOURCE DATA (mirrors src/data.jsx exactly) ─────────────────────────────
const PARKS = [
  { id: 'jt', name: 'Jungle Trail',  city: 'Noida',        state: 'Uttar Pradesh', color: '#16A34A' },
  { id: 'ud', name: 'UP Darshan',    city: 'Lucknow',      state: 'Uttar Pradesh', color: '#2563EB' },
  { id: 'ha', name: 'Harmony',       city: 'Kanpur',       state: 'Uttar Pradesh', color: '#F59E0B' },
  { id: 'gb', name: 'Gautam Buddha', city: 'Greater Noida',state: 'Uttar Pradesh', color: '#DC2626' },
  { id: 'wp', name: 'World Park',    city: 'Delhi',        state: 'NCT Delhi',     color: '#7C3AED' },
  { id: 'sh', name: 'Shivalaya',     city: 'Varanasi',     state: 'Uttar Pradesh', color: '#06B6D4' },
  { id: 'sa', name: 'Saat Ajoobe',   city: 'Agra',         state: 'Uttar Pradesh', color: '#EC4899' },
];

// 7-day sparklines (today = May 5, 2026)
const sparkVisitors = [1820, 1965, 2110, 1740, 2480, 3120, 2940];
const sparkRevenue  = [298400, 312000, 358200, 271000, 412800, 528900, 489200];
const sparkTickets  = [612, 660, 712, 590, 838, 1042, 980];
const sparkPeak     = [16, 17, 18, 14, 21, 24, 22];
const TODAY = new Date('2026-05-05');

// Demographics for today
const DEMO = [
  { age_group: 'adult',   male: 1024, female: 778, other: 30  },
  { age_group: 'kid',     male: 312,  female: 290, other: 10  },
  { age_group: 'toddler', male: 92,   female: 88,  other: 4   },
  { age_group: 'senior',  male: 174,  female: 132, other: 6   },
];

const REV_BY_DEMO = [
  { demo_group: 'Adult',   revenue: 318400 },
  { demo_group: 'Child',   revenue: 92800  },
  { demo_group: 'Toddler', revenue: 18200  },
  { demo_group: 'Senior',  revenue: 59800  },
];
const REV_BY_CATEGORY = [
  { category: 'Tickets',    revenue: 312800 },
  { category: 'Parking',    revenue: 38400  },
  { category: 'Activities', revenue: 88600  },
  { category: 'F&B',        revenue: 49200  },
  { category: 'Events',     revenue: 0      },
];
const REV_BY_SOURCE = [
  { source_name: 'Counter',  revenue: 198400 },
  { source_name: 'Web',      revenue: 142800 },
  { source_name: 'WhatsApp', revenue: 88600  },
];
const REV_BY_PAYMENT = [
  { payment_mode: 'UPI',    revenue: 248400 },
  { payment_mode: 'Cash',   revenue: 92800  },
  { payment_mode: 'Card',   revenue: 78200  },
  { payment_mode: 'Others', revenue: 19600  },
];

const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i);
const HOURLY_FOOTFALL = [22, 48, 96, 152, 218, 268, 296, 312, 284, 252, 296, 348, 392, 364, 296, 218, 124];
const HOURLY_REVENUE  = [3400, 7200, 14600, 24800, 38400, 49600, 56200, 62400, 51800, 44200, 56400, 68800, 79200, 71600, 56400, 38600, 19800];
const PEAK_HOUR_INDEX = HOURLY_FOOTFALL.indexOf(Math.max(...HOURLY_FOOTFALL)); // index 12 → 6PM

// Heatmap generation (mirrors genHeatmap() in data.jsx)
function genHeatmap() {
  return Array.from({ length: 7 }, (_, di) => {
    const isWk = di >= 5;
    return HOURS.map((h, hi) => {
      const x = hi - 11;
      const curve = Math.exp(-(x * x) / 24);
      const noise = 0.78 + Math.sin(di * 1.7 + hi * 0.9) * 0.18;
      const base = (isWk ? 380 : 220) * curve * noise;
      return Math.max(2, Math.round(base));
    });
  });
}
const HEATMAP = genHeatmap();

// Weekend vs Weekday per park
const WE_WD = [
  { park_id: 'jt', weekend_revenue: 528000, weekday_revenue: 296000, weekend_footfall: 3120, weekday_footfall: 1965 },
  { park_id: 'ud', weekend_revenue: 412000, weekday_revenue: 248000, weekend_footfall: 2480, weekday_footfall: 1640 },
  { park_id: 'dp', weekend_revenue: 386000, weekday_revenue: 224000, weekend_footfall: 2280, weekday_footfall: 1480 },
  { park_id: 'rb', weekend_revenue: 298000, weekday_revenue: 178000, weekend_footfall: 1740, weekday_footfall: 1180 },
  { park_id: 'kk', weekend_revenue: 264000, weekday_revenue: 162000, weekend_footfall: 1520, weekday_footfall: 1060 },
];

// QvQ — totals across all parks
const QVQ = [
  { fiscal_year: 2026, quarter: 1, revenue: 4820000 },
  { fiscal_year: 2026, quarter: 2, revenue: 5980000 },
  { fiscal_year: 2026, quarter: 3, revenue: 7240000 },
  { fiscal_year: 2026, quarter: 4, revenue: 6840000 },
  { fiscal_year: 2025, quarter: 1, revenue: 4120000 },
  { fiscal_year: 2025, quarter: 2, revenue: 5240000 },
  { fiscal_year: 2025, quarter: 3, revenue: 6480000 },
  { fiscal_year: 2025, quarter: 4, revenue: 6180000 },
];

// YvY — monthly
const prevAmounts = [1280, 1340, 1420, 1680, 2120, 2480, 2840, 2960, 2620, 2240, 1980, 1840].map(v => v * 1000);
const MONTHLY = prevAmounts.flatMap((prev, i) => {
  const curr = Math.round(prev * (1 + (Math.sin(i * 0.7) * 0.1 + 0.14)));
  return [
    { year: 2025, month: i + 1, revenue: prev },
    { year: 2026, month: i + 1, revenue: curr },
  ];
});

// Top parks metrics
const TOP_PARK_IDS = ['jt', 'ud', 'dp', 'rb', 'kk'];
const TOP_METRICS = [
  // [park_id, metric, value]
  ['jt', 'Revenue',    1842000], ['dp', 'Revenue',    1428000], ['ud', 'Revenue',    1186000], ['rb', 'Revenue',    842000],  ['kk', 'Revenue',    684000],
  ['jt', 'Tickets',   8420],    ['ud', 'Tickets',   6940],    ['dp', 'Tickets',   5820],    ['rb', 'Tickets',   4280],    ['kk', 'Tickets',   3640],
  ['jt', 'Footfall',  23420],   ['dp', 'Footfall',  18460],   ['ud', 'Footfall',  16280],   ['rb', 'Footfall',  12480],   ['kk', 'Footfall',  10240],
  ['ud', 'Activities',412000],  ['jt', 'Activities',368000],  ['dp', 'Activities',298000],  ['kk', 'Activities',184000],  ['rb', 'Activities',162000],
  ['jt', 'F&B',       298000],  ['dp', 'F&B',       248000],  ['ud', 'F&B',       198000],  ['rb', 'F&B',       142000],  ['kk', 'F&B',       118000],
];

// 6-month revenue trend
const TREND_MONTHS = [
  { year: 2025, month: 12 },
  { year: 2026, month: 1  },
  { year: 2026, month: 2  },
  { year: 2026, month: 3  },
  { year: 2026, month: 4  },
  { year: 2026, month: 5  },
];
const TREND_VALUES = {
  jt: [248, 272, 318, 296, 348, 398],
  ud: [186, 212, 242, 228, 278, 312],
  dp: [218, 248, 286, 272, 316, 358],
  rb: [142, 168, 194, 178, 218, 248],
  kk: [118, 142, 162, 148, 184, 212],
};

// ─── HELPER ─────────────────────────────────────────────────────────────────
function dateStr(daysAgo) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

// ─── MAIN SEED FUNCTION ──────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seed...\n');

    // Run schema first
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema created');

    // Clear existing data (in reverse dependency order)
    await client.query(`
      TRUNCATE revenue_trend, top_parks_metrics, monthly_revenue, quarterly_revenue,
               weekend_weekday, heatmap_data, hourly_stats,
               revenue_by_payment, revenue_by_source, revenue_by_category,
               revenue_by_demographic, demographics, daily_stats, parks CASCADE
    `);
    console.log('✅ Old data cleared');

    // 1. Parks
    for (const p of PARKS) {
      await client.query(
        `INSERT INTO parks(id, name, city, state, color_hex) VALUES($1,$2,$3,$4,$5)`,
        [p.id, p.name, p.city, p.state, p.color]
      );
    }
    console.log('✅ Parks seeded (5 parks)');

    // 2. Daily stats — 7 days of sparkline data (aggregate across all parks)
    for (let i = 0; i < 7; i++) {
      const date = dateStr(6 - i); // oldest first
      // We distribute the day's totals evenly across parks for simplicity
      const visitors = sparkVisitors[i];
      const revenue  = sparkRevenue[i];
      const tickets  = sparkTickets[i];
      const peakIdx  = HOURLY_FOOTFALL.indexOf(Math.max(...HOURLY_FOOTFALL));
      const peakHour = HOURS[peakIdx];
      const peakFF   = HOURLY_FOOTFALL[peakIdx];
      const peakRev  = HOURLY_REVENUE[peakIdx];

      // Insert one row per park (split roughly proportionally)
      const splits = [0.38, 0.22, 0.18, 0.12, 0.10]; // park share
      for (let pi = 0; pi < PARKS.length; pi++) {
        await client.query(
          `INSERT INTO daily_stats(park_id, stat_date, total_visitors, total_revenue, total_tickets, peak_hour, peak_footfall, peak_hour_revenue)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            PARKS[pi].id,
            date,
            Math.round(visitors * splits[pi]),
            Math.round(revenue  * splits[pi] * 100) / 100,
            Math.round(tickets  * splits[pi]),
            peakHour,
            Math.round(peakFF   * splits[pi]),
            Math.round(peakRev  * splits[pi] * 100) / 100,
          ]
        );
      }
    }
    console.log('✅ Daily stats seeded (7 days × 5 parks)');

    // 3. Demographics (today only)
    const today = dateStr(0);
    for (const d of DEMO) {
      await client.query(
        `INSERT INTO demographics(stat_date, age_group, male_count, female_count, other_count)
         VALUES($1,$2,$3,$4,$5)`,
        [today, d.age_group, d.male, d.female, d.other]
      );
    }
    console.log('✅ Demographics seeded');

    // 4. Revenue splits (today)
    for (const r of REV_BY_DEMO) {
      await client.query(
        `INSERT INTO revenue_by_demographic(stat_date, demo_group, revenue) VALUES($1,$2,$3)`,
        [today, r.demo_group, r.revenue]
      );
    }
    for (const r of REV_BY_CATEGORY) {
      await client.query(
        `INSERT INTO revenue_by_category(stat_date, category, revenue) VALUES($1,$2,$3)`,
        [today, r.category, r.revenue]
      );
    }
    for (const r of REV_BY_SOURCE) {
      await client.query(
        `INSERT INTO revenue_by_source(stat_date, source_name, revenue) VALUES($1,$2,$3)`,
        [today, r.source_name, r.revenue]
      );
    }
    for (const r of REV_BY_PAYMENT) {
      await client.query(
        `INSERT INTO revenue_by_payment(stat_date, payment_mode, revenue) VALUES($1,$2,$3)`,
        [today, r.payment_mode, r.revenue]
      );
    }
    console.log('✅ Revenue splits seeded');

    // 5. Hourly stats (today)
    for (let i = 0; i < HOURS.length; i++) {
      await client.query(
        `INSERT INTO hourly_stats(stat_date, hour_of_day, footfall, revenue) VALUES($1,$2,$3,$4)`,
        [today, HOURS[i], HOURLY_FOOTFALL[i], HOURLY_REVENUE[i]]
      );
    }
    console.log('✅ Hourly stats seeded (17 hours)');

    // 6. Heatmap (7 days × 17 hours)
    for (let di = 0; di < 7; di++) {
      for (let hi = 0; hi < HOURS.length; hi++) {
        await client.query(
          `INSERT INTO heatmap_data(day_of_week, hour_of_day, footfall) VALUES($1,$2,$3)`,
          [di, HOURS[hi], HEATMAP[di][hi]]
        );
      }
    }
    console.log('✅ Heatmap seeded (7 × 17 = 119 cells)');

    // 7. Weekend vs weekday
    for (const w of WE_WD) {
      await client.query(
        `INSERT INTO weekend_weekday(park_id, weekend_revenue, weekday_revenue, weekend_footfall, weekday_footfall)
         VALUES($1,$2,$3,$4,$5)`,
        [w.park_id, w.weekend_revenue, w.weekday_revenue, w.weekend_footfall, w.weekday_footfall]
      );
    }
    console.log('✅ Weekend vs Weekday seeded');

    // 8. Quarterly revenue
    for (const q of QVQ) {
      await client.query(
        `INSERT INTO quarterly_revenue(fiscal_year, quarter, revenue) VALUES($1,$2,$3)`,
        [q.fiscal_year, q.quarter, q.revenue]
      );
    }
    console.log('✅ Quarterly revenue seeded');

    // 9. Monthly revenue (YvY)
    for (const m of MONTHLY) {
      await client.query(
        `INSERT INTO monthly_revenue(year, month, revenue) VALUES($1,$2,$3)`,
        [m.year, m.month, m.revenue]
      );
    }
    console.log('✅ Monthly revenue seeded (YvY data)');

    // 10. Top parks metrics
    for (const [park_id, metric_name, metric_value] of TOP_METRICS) {
      await client.query(
        `INSERT INTO top_parks_metrics(park_id, metric_name, metric_value) VALUES($1,$2,$3)`,
        [park_id, metric_name, metric_value]
      );
    }
    console.log('✅ Top parks metrics seeded');

    // 11. Revenue trend (6 months per park)
    for (const [parkId, values] of Object.entries(TREND_VALUES)) {
      for (let i = 0; i < TREND_MONTHS.length; i++) {
        const { year, month } = TREND_MONTHS[i];
        await client.query(
          `INSERT INTO revenue_trend(park_id, year, month, revenue) VALUES($1,$2,$3,$4)`,
          [parkId, year, month, values[i] * 1000]
        );
      }
    }
    console.log('✅ Revenue trend seeded (6 months × 5 parks)');

    console.log('\n🎉 Database seeded successfully! All dashboard data is ready.');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
