/**
 * ZingParks Dashboard API Routes
 * All endpoints return data that exactly matches the dashboard design.
 */

const express = require('express');
const router  = express.Router();

// ── Filter helpers ────────────────────────────────────────────────────────────

// Convert date-range string to a SQL fragment for columns named stat_date
function dateSQL(range) {
  switch (range) {
    case 'Today':        return `stat_date = CURRENT_DATE`;
    case 'Yesterday':    return `stat_date = CURRENT_DATE - INTERVAL '1 day'`;
    case 'Last 30 days': return `stat_date >= CURRENT_DATE - INTERVAL '30 days'`;
    case 'This Quarter': return `stat_date >= DATE_TRUNC('quarter', CURRENT_DATE)`;
    case 'This Year':    return `stat_date >= DATE_TRUNC('year', CURRENT_DATE)`;
    default:             return `stat_date >= CURRENT_DATE - INTERVAL '7 days'`; // 'Last 7 days'
  }
}

// Build park/state/city WHERE clauses and params array.
// parkCol: the park_id column reference in the target query (e.g. 'park_id', 'w.park_id')
function parkSQL(park, state, city, parkCol = 'park_id') {
  const params  = [];
  const clauses = [];
  if (park && park !== 'All Parks') {
    params.push(park);
    clauses.push(`${parkCol} = (SELECT id FROM parks WHERE LOWER(name) = LOWER($${params.length}))`);
  } else if (state && state !== 'All States') {
    params.push(state);
    clauses.push(`${parkCol} IN (SELECT id FROM parks WHERE LOWER(state) = LOWER($${params.length}))`);
    if (city && city !== 'All Cities') {
      params.push(city);
      clauses.push(`${parkCol} IN (SELECT id FROM parks WHERE LOWER(city) = LOWER($${params.length}))`);
    }
  }
  return { clauses, params };
}

// ─── KPIs ────────────────────────────────────────────────────────────────────
// GET /api/dashboard/kpis?park=&state=&city=&range=
router.get('/kpis', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, city, range } = req.query;
    const { clauses: parkClauses, params } = parkSQL(park, state, city);
    const allClauses = [dateSQL(range), ...parkClauses];
    const WHERE      = `WHERE ${allClauses.join(' AND ')}`;

    // Aggregate totals for the selected period
    const today = await pool.query(`
      SELECT
        SUM(total_visitors)    AS total_visitors,
        SUM(total_revenue)     AS total_revenue,
        SUM(total_tickets)     AS total_tickets,
        MAX(peak_hour)         AS peak_hour,
        MAX(peak_footfall)     AS peak_footfall,
        MAX(peak_hour_revenue) AS peak_hour_revenue
      FROM daily_stats
      ${WHERE}
    `, params);

    // 7-day sparkline — always last 7 days, park filter applied
    const sparkClauses = [`stat_date >= CURRENT_DATE - INTERVAL '7 days'`, ...parkClauses];
    const spark = await pool.query(`
      SELECT
        stat_date,
        SUM(total_visitors)  AS visitors,
        SUM(total_revenue)   AS revenue,
        SUM(total_tickets)   AS tickets,
        SUM(peak_footfall)   AS peak
      FROM daily_stats
      WHERE ${sparkClauses.join(' AND ')}
      GROUP BY stat_date
      ORDER BY stat_date ASC
      LIMIT 7
    `, params);

    const [peakRows, todayCount] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at) AS day, MAX(cnt) AS peak
        FROM (
          SELECT DATE(created_at)             AS day,
                 EXTRACT(hour FROM created_at) AS hr,
                 COUNT(*)                      AS cnt
          FROM tickets
          WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY 1, 2
        ) sub
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT 7
      `),
      pool.query(`
        SELECT COUNT(*) AS cnt
        FROM tickets
        WHERE DATE(created_at) = CURRENT_DATE
      `),
    ]);

    const t    = today.rows[0];
    const rows = spark.rows;

    res.json({
      totalVisitors:    parseInt(t.total_visitors)      || 0,
      totalRevenue:     parseFloat(t.total_revenue)     || 0,
      totalTickets:     parseInt(t.total_tickets)       || 0,
      peakHour:         parseInt(t.peak_hour)           || 18,
      peakFootfall:     parseInt(t.peak_footfall)       || 0,
      peakHourRevenue:  parseFloat(t.peak_hour_revenue) || 0,
      sparkVisitors:    rows.map(r => parseInt(r.visitors)),
      sparkRevenue:     rows.map(r => parseFloat(r.revenue)),
      sparkTickets:     rows.map(r => parseInt(r.tickets)),
      sparkPeak:        peakRows.rows.map(r => parseInt(r.peak)),
      liveCount:        parseInt(todayCount.rows[0].cnt) || 0,
    });
  } catch (err) {
    console.error('/kpis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DEMOGRAPHICS ────────────────────────────────────────────────────────────
// GET /api/dashboard/demographics?range=
router.get('/demographics', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { range } = req.query;

    const result = await pool.query(`
      SELECT age_group,
             SUM(male_count)   AS male_count,
             SUM(female_count) AS female_count,
             SUM(other_count)  AS other_count,
             SUM(male_count + female_count + other_count) AS total
      FROM demographics
      WHERE ${dateSQL(range)}
      GROUP BY age_group
      ORDER BY
        CASE age_group WHEN 'adult' THEN 1 WHEN 'kid' THEN 2 WHEN 'toddler' THEN 3 WHEN 'senior' THEN 4 END
    `);

    const totalAll = result.rows.reduce((s, r) => s + parseInt(r.total), 0);

    const ICON_MAP = { adult: 'adult', kid: 'kid', toddler: 'toddler', senior: 'senior' };
    const NAME_MAP = { adult: 'Adults', kid: 'Kids', toddler: 'Toddlers', senior: 'Senior Citizens' };

    res.json({
      total: totalAll,
      demographics: result.rows.map(r => ({
        id:    r.age_group,
        name:  NAME_MAP[r.age_group],
        icon:  ICON_MAP[r.age_group],
        total: parseInt(r.total),
        m:     parseInt(r.male_count),
        f:     parseInt(r.female_count),
        o:     parseInt(r.other_count),
        pct:   totalAll > 0 ? parseFloat(((parseInt(r.total) / totalAll) * 100).toFixed(1)) : 0,
      })),
    });
  } catch (err) {
    console.error('/demographics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── REVENUE SPLITS ──────────────────────────────────────────────────────────
// GET /api/dashboard/revenue-splits?range=
router.get('/revenue-splits', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { range } = req.query;
    const dateCond  = dateSQL(range);

    const [demo, cat, src, pay] = await Promise.all([
      pool.query(`SELECT demo_group   AS name, SUM(revenue) AS revenue FROM revenue_by_demographic WHERE ${dateCond} GROUP BY demo_group   ORDER BY revenue DESC`),
      pool.query(`SELECT category     AS name, SUM(revenue) AS revenue FROM revenue_by_category    WHERE ${dateCond} GROUP BY category     ORDER BY revenue DESC`),
      pool.query(`SELECT source_name  AS name, SUM(revenue) AS revenue FROM revenue_by_source      WHERE ${dateCond} GROUP BY source_name  ORDER BY revenue DESC`),
      pool.query(`SELECT payment_mode AS name, SUM(revenue) AS revenue FROM revenue_by_payment     WHERE ${dateCond} GROUP BY payment_mode ORDER BY revenue DESC`),
    ]);

    const DEMO_COLORS = { Adult: '#0E7C66', Child: '#5A6BCF', Toddler: '#D89614', Senior: '#8C5BB3' };
    const CAT_COLORS  = { Tickets: '#0E7C66', Parking: '#5A6BCF', Activities: '#D89614', 'F&B': '#E5604D', Events: '#8C5BB3' };
    const SRC_COLORS  = { Counter: '#0E7C66', Web: '#5A6BCF', WhatsApp: '#D89614' };
    const PAY_COLORS  = { UPI: '#0E7C66', Cash: '#5A6BCF', Card: '#D89614', Others: '#8A92A3' };

    const addColors = (rows, colorMap) =>
      rows.map(r => ({ name: r.name, value: parseFloat(r.revenue), color: colorMap[r.name] || '#ccc' }));

    res.json({
      byDemographic: addColors(demo.rows, DEMO_COLORS),
      byCategory:    addColors(cat.rows,  CAT_COLORS),
      bySource:      addColors(src.rows,  SRC_COLORS),
      byPayment:     addColors(pay.rows,  PAY_COLORS),
    });
  } catch (err) {
    console.error('/revenue-splits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HOURLY ──────────────────────────────────────────────────────────────────
// GET /api/dashboard/hourly?range=
router.get('/hourly', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { range } = req.query;

    const result = await pool.query(`
      SELECT hour_of_day,
             SUM(footfall) AS footfall,
             SUM(revenue)  AS revenue
      FROM hourly_stats
      WHERE ${dateSQL(range)}
      GROUP BY hour_of_day
      ORDER BY hour_of_day ASC
    `);

    res.json({
      hours:    result.rows.map(r => parseInt(r.hour_of_day)),
      footfall: result.rows.map(r => parseInt(r.footfall)),
      revenue:  result.rows.map(r => parseFloat(r.revenue)),
    });
  } catch (err) {
    console.error('/hourly error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEATMAP ─────────────────────────────────────────────────────────────────
// GET /api/dashboard/heatmap
router.get('/heatmap', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(`
      SELECT day_of_week, hour_of_day, footfall
      FROM heatmap_data
      ORDER BY day_of_week, hour_of_day
    `);

    const matrix = Array.from({ length: 7 }, () => Array(17).fill(0));
    const hours  = Array.from({ length: 17 }, (_, i) => 6 + i);
    for (const r of result.rows) {
      const di = parseInt(r.day_of_week);
      const hi = parseInt(r.hour_of_day) - 6;
      matrix[di][hi] = parseInt(r.footfall);
    }

    res.json({
      days:  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      hours,
      data:  matrix,
    });
  } catch (err) {
    console.error('/heatmap error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── WEEKEND vs WEEKDAY ──────────────────────────────────────────────────────
// GET /api/dashboard/weekend-weekday?park=&state=&city=
router.get('/weekend-weekday', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, city } = req.query;
    const { clauses, params } = parkSQL(park, state, city, 'w.park_id');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT w.park_id, p.name AS park_name, p.color_hex AS color,
             w.weekend_revenue, w.weekday_revenue,
             w.weekend_footfall, w.weekday_footfall
      FROM weekend_weekday w
      JOIN parks p ON p.id = w.park_id
      ${where}
      ORDER BY w.weekend_revenue DESC
    `, params);

    res.json({
      revenue:  result.rows.map(r => ({
        park:    r.park_name,
        color:   r.color,
        weekend: parseFloat(r.weekend_revenue),
        weekday: parseFloat(r.weekday_revenue),
      })),
      footfall: result.rows.map(r => ({
        park:    r.park_name,
        color:   r.color,
        weekend: parseInt(r.weekend_footfall),
        weekday: parseInt(r.weekday_footfall),
      })),
    });
  } catch (err) {
    console.error('/weekend-weekday error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── COMPARATIVE ─────────────────────────────────────────────────────────────
// GET /api/dashboard/comparative
router.get('/comparative', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const [qvq, yvy] = await Promise.all([
      pool.query(`
        SELECT quarter,
               SUM(CASE WHEN fiscal_year = EXTRACT(YEAR FROM NOW())::int     THEN revenue ELSE 0 END) AS curr,
               SUM(CASE WHEN fiscal_year = EXTRACT(YEAR FROM NOW())::int - 1 THEN revenue ELSE 0 END) AS prev
        FROM quarterly_revenue
        GROUP BY quarter
        ORDER BY quarter
      `),
      pool.query(`
        SELECT month,
               SUM(CASE WHEN year = EXTRACT(YEAR FROM NOW())::int     THEN revenue ELSE 0 END) AS curr,
               SUM(CASE WHEN year = EXTRACT(YEAR FROM NOW())::int - 1 THEN revenue ELSE 0 END) AS prev
        FROM monthly_revenue
        GROUP BY month
        ORDER BY month
      `),
    ]);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    res.json({
      qvq: qvq.rows.map(r => ({
        q:    `Q${r.quarter}`,
        curr: parseFloat(r.curr),
        prev: parseFloat(r.prev),
      })),
      yvy: yvy.rows.map(r => ({
        m:    MONTHS[parseInt(r.month) - 1],
        curr: parseFloat(r.curr),
        prev: parseFloat(r.prev),
      })),
    });
  } catch (err) {
    console.error('/comparative error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── TOP PARKS ───────────────────────────────────────────────────────────────
// GET /api/dashboard/top-parks?park=&state=&city=
router.get('/top-parks', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, city } = req.query;
    const { clauses, params } = parkSQL(park, state, city, 't.park_id');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT t.park_id, t.metric_name, t.metric_value,
             p.name AS park_name, p.city, p.state, p.color_hex AS color
      FROM top_parks_metrics t
      JOIN parks p ON p.id = t.park_id
      ${where}
      ORDER BY t.metric_name, t.metric_value DESC
    `, params);

    const metrics = ['Revenue', 'Tickets', 'Footfall', 'Activities', 'F&B'];
    const grouped = {};
    for (const m of metrics) {
      grouped[m] = result.rows
        .filter(r => r.metric_name === m)
        .map(r => ({
          parkId: r.park_id,
          name:   r.park_name,
          city:   r.city,
          state:  r.state,
          color:  r.color,
          value:  parseFloat(r.metric_value),
        }));
    }

    res.json(grouped);
  } catch (err) {
    console.error('/top-parks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── REVENUE TREND ───────────────────────────────────────────────────────────
// GET /api/dashboard/revenue-trend?park=&state=&city=
router.get('/revenue-trend', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, city } = req.query;
    const { clauses, params } = parkSQL(park, state, city, 'rt.park_id');
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT rt.park_id, p.name AS park_name, p.color_hex AS color,
             rt.year, rt.month, rt.revenue
      FROM revenue_trend rt
      JOIN parks p ON p.id = rt.park_id
      ${where}
      ORDER BY rt.park_id,
               CASE WHEN rt.year = 2025 AND rt.month = 12 THEN 0
                    ELSE (rt.year - 2026) * 12 + rt.month
               END
    `, params);

    const MONTH_ABBR    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const seenMonths    = new Set();
    const derivedMonths = [];
    const parks = {};
    for (const r of result.rows) {
      const mk = `${r.year}-${String(r.month).padStart(2, '0')}`;
      if (!seenMonths.has(mk)) {
        seenMonths.add(mk);
        derivedMonths.push(MONTH_ABBR[parseInt(r.month) - 1]);
      }
      if (!parks[r.park_id]) {
        parks[r.park_id] = { parkId: r.park_id, name: r.park_name, color: r.color, series: [] };
      }
      parks[r.park_id].series.push(parseFloat(r.revenue));
    }

    res.json({
      months: derivedMonths,
      parks:  Object.values(parks),
    });
  } catch (err) {
    console.error('/revenue-trend error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PARKS LIST ──────────────────────────────────────────────────────────────
// GET /api/dashboard/parks
router.get('/parks', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT id, name, city, state FROM parks ORDER BY state, city, name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('/parks error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
