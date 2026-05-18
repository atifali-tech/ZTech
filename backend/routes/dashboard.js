/**
 * ZingParks Dashboard API Routes
 * All endpoints return data that exactly matches the dashboard design.
 */

const express = require('express');
const router  = express.Router();

// ── Filter helpers ────────────────────────────────────────────────────────────

// Build SQL date filter. date = range start, dateEnd = range end (both YYYY-MM-DD).
function dateSQL(range, date, dateEnd, col = 'stat_date') {
  const d  = /^\d{4}-\d{2}-\d{2}$/.test(date    || '') ? `DATE '${date}'`    : 'CURRENT_DATE';
  const de = /^\d{4}-\d{2}-\d{2}$/.test(dateEnd  || '') ? `DATE '${dateEnd}'` : 'CURRENT_DATE';
  switch (range) {
    case 'Daily':          return `${col} = ${d}`;
    case 'Weekly':
    case 'Monthly':
    case 'Quarterly':
    case 'Yearly':
    case 'Custom Range':   return `${col} >= ${d} AND ${col} <= ${de}`;
    case 'Last 3 Months':  return `${col} > CURRENT_DATE - INTERVAL '90 days'  AND ${col} <= CURRENT_DATE`;
    case 'Last 6 Months':  return `${col} > CURRENT_DATE - INTERVAL '180 days' AND ${col} <= CURRENT_DATE`;
    case 'Last 12 Months': return `${col} > CURRENT_DATE - INTERVAL '365 days' AND ${col} <= CURRENT_DATE`;
    default:               return `${col} >= ${d} AND ${col} <= ${de}`;
  }
}

// Previous-period mirror of dateSQL — shifts the window back by one period.
function prevDateSQL(range, date, dateEnd, col = 'stat_date') {
  const d  = /^\d{4}-\d{2}-\d{2}$/.test(date    || '') ? `DATE '${date}'`    : 'CURRENT_DATE';
  const de = /^\d{4}-\d{2}-\d{2}$/.test(dateEnd  || '') ? `DATE '${dateEnd}'` : 'CURRENT_DATE';
  switch (range) {
    case 'Daily':          return `${col} = ${d} - INTERVAL '1 day'`;
    case 'Weekly':         return `${col} >= ${d} - INTERVAL '7 days'   AND ${col} <= ${de} - INTERVAL '7 days'`;
    case 'Monthly':        return `${col} >= ${d} - INTERVAL '1 month'  AND ${col} <= ${de} - INTERVAL '1 month'`;
    case 'Quarterly':      return `${col} >= ${d} - INTERVAL '3 months' AND ${col} <= ${de} - INTERVAL '3 months'`;
    case 'Yearly':         return `${col} >= ${d} - INTERVAL '1 year'   AND ${col} <= ${de} - INTERVAL '1 year'`;
    case 'Custom Range':   return `${col} >= ${d} - (${de}::date - ${d}::date + 1) * INTERVAL '1 day' AND ${col} <= ${d} - INTERVAL '1 day'`;
    case 'Last 3 Months':  return `${col} > CURRENT_DATE - INTERVAL '180 days' AND ${col} <= CURRENT_DATE - INTERVAL '90 days'`;
    case 'Last 6 Months':  return `${col} > CURRENT_DATE - INTERVAL '360 days' AND ${col} <= CURRENT_DATE - INTERVAL '180 days'`;
    case 'Last 12 Months': return `${col} > CURRENT_DATE - INTERVAL '730 days' AND ${col} <= CURRENT_DATE - INTERVAL '365 days'`;
    default:               return `${col} >= ${d} - INTERVAL '1 year'   AND ${col} <= ${de} - INTERVAL '1 year'`;
  }
}

function pct(curr, prev) {
  return prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;
}

function compareDeltaLabel(range) {
  switch (range) {
    case 'Daily':          return 'vs yesterday';
    case 'Weekly':         return 'vs prev week';
    case 'Monthly':        return 'vs prev month';
    case 'Quarterly':      return 'vs prev quarter';
    case 'Yearly':         return 'vs prev year';
    case 'Last 3 Months':  return 'vs prev 3 months';
    case 'Last 6 Months':  return 'vs prev 6 months';
    case 'Last 12 Months': return 'vs prev 12 months';
    case 'Custom Range':   return 'vs prev period';
    default:               return 'vs prev period';
  }
}

// Normalise city from req.query — can be a string (one city) or array (multiple)
function extractCities(cityParam) {
  if (!cityParam) return [];
  return Array.isArray(cityParam) ? cityParam : [cityParam];
}

// Build park/state/cities WHERE clauses and params array.
// cities: string[] — empty means "all cities"
function parkSQL(park, state, cities, parkCol = 'park_id') {
  const params  = [];
  const clauses = [];
  if (park && park !== 'All Parks') {
    params.push(park);
    clauses.push(`${parkCol} = (
      SELECT id FROM parks WHERE LOWER(name) = LOWER($${params.length}) LIMIT 1
    )`);
  } else {
    if (state && state !== 'All States') {
      params.push(state);
      clauses.push(`${parkCol} IN (SELECT id FROM parks WHERE LOWER(state) = LOWER($${params.length}))`);
    }
    if (cities && cities.length > 0) {
      const placeholders = cities.map((_, i) => `$${params.length + i + 1}`).join(', ');
      clauses.push(`${parkCol} IN (SELECT id FROM parks WHERE LOWER(city) IN (${placeholders}))`);
      params.push(...cities.map(c => c.toLowerCase()));
    }
  }
  return { clauses, params };
}

// ─── KPIs ────────────────────────────────────────────────────────────────────
// GET /api/dashboard/kpis?park=&state=&city=&range=
// Single source of truth: all queries read from tickets table directly.
router.get('/kpis', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd, compare } = req.query;
    const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 't.park_id');
    const parkWhere = parkClauses.length ? ` AND ${parkClauses.join(' AND ')}` : '';
    const dateWhere = dateSQL(range, date, dateEnd, 'DATE(t.created_at)');
    const anchor    = /^\d{4}-\d{2}-\d{2}$/.test(dateEnd || '') ? `DATE '${dateEnd}'` : 'CURRENT_DATE';

    const [totalsResult, sparkResult, peakRows, todayCount, weekResult, monthResult, peakResult] = await Promise.all([
      // Aggregate totals for selected period
      pool.query(`
        SELECT
          COALESCE(SUM(t.quantity), 0)::int             AS total_visitors,
          COALESCE(SUM(t.total_amount), 0)::numeric     AS total_revenue,
          COALESCE(COUNT(DISTINCT t.ticket_id), 0)::int AS total_tickets
        FROM tickets t
        WHERE ${dateWhere}${parkWhere}
      `, params),

      // Sparkline: last 7 days grouped by day
      pool.query(`
        SELECT
          DATE(t.created_at)                            AS stat_date,
          COALESCE(SUM(t.quantity), 0)::int             AS visitors,
          COALESCE(SUM(t.total_amount), 0)::numeric     AS revenue,
          COALESCE(COUNT(DISTINCT t.ticket_id), 0)::int AS tickets
        FROM tickets t
        WHERE DATE(t.created_at) > ${anchor} - INTERVAL '7 days'
          AND DATE(t.created_at) <= ${anchor}${parkWhere}
        GROUP BY DATE(t.created_at)
        ORDER BY stat_date ASC
        LIMIT 7
      `, params),

      // Peak ticket count per day (last 7 days) → sparkPeak
      pool.query(`
        SELECT day, MAX(cnt) AS peak
        FROM (
          SELECT DATE(t.created_at)              AS day,
                 EXTRACT(hour FROM t.created_at) AS hr,
                 COUNT(*)                        AS cnt
          FROM tickets t
          WHERE DATE(t.created_at) > ${anchor} - INTERVAL '7 days'
            AND DATE(t.created_at) <= ${anchor}${parkWhere}
          GROUP BY 1, 2
        ) sub
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT 7
      `, params),

      // Today ticket count → liveCount
      pool.query(`
        SELECT COUNT(*) AS cnt
        FROM tickets t
        WHERE DATE(t.created_at) = ${anchor}${parkWhere}
      `, params),

      // Last 7 days revenue → weekRevenue
      pool.query(`
        SELECT COALESCE(SUM(t.total_amount), 0)::numeric AS revenue
        FROM tickets t
        WHERE DATE(t.created_at) > ${anchor} - INTERVAL '7 days'
          AND DATE(t.created_at) <= ${anchor}${parkWhere}
      `, params),

      // Last 30 days revenue → monthRevenue
      pool.query(`
        SELECT COALESCE(SUM(t.total_amount), 0)::numeric AS revenue
        FROM tickets t
        WHERE DATE(t.created_at) > ${anchor} - INTERVAL '30 days'
          AND DATE(t.created_at) <= ${anchor}${parkWhere}
      `, params),

      // Peak hour for the selected period → peakHour / peakCount / peakRevenue
      pool.query(`
        SELECT
          EXTRACT(hour FROM t.created_at)::int      AS peak_hour,
          COUNT(*)::int                              AS peak_count,
          COALESCE(SUM(t.total_amount), 0)::numeric AS peak_revenue
        FROM tickets t
        WHERE ${dateWhere}
          AND EXTRACT(hour FROM t.created_at) BETWEEN 10 AND 18${parkWhere}
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 1
      `, params),
    ]);

    const row  = totalsResult.rows[0];
    const rows = sparkResult.rows;
    const peak = peakResult.rows[0] || {};

    // Previous-period comparison — only when compare=true
    let deltaVisitors = null, deltaRevenue = null, deltaTickets = null, deltaLabel = null;
    if (compare === 'true') {
      const prevWhere = prevDateSQL(range, date, dateEnd, 'DATE(t.created_at)');
      const prev = await pool.query(`
        SELECT
          COALESCE(SUM(t.quantity), 0)::int             AS pv,
          COALESCE(SUM(t.total_amount), 0)::numeric     AS pr,
          COALESCE(COUNT(DISTINCT t.ticket_id), 0)::int AS pt
        FROM tickets t
        WHERE ${prevWhere}${parkWhere}
      `, params);
      const p  = prev.rows[0];
      const pv = parseInt(p.pv)    || 0;
      const pr = parseFloat(p.pr)  || 0;
      const pt = parseInt(p.pt)    || 0;
      const cv = parseInt(row.total_visitors)  || 0;
      const cr = parseFloat(row.total_revenue) || 0;
      const ct = parseInt(row.total_tickets)   || 0;
      deltaVisitors = pct(cv, pv);
      deltaRevenue  = pct(cr, pr);
      deltaTickets  = pct(ct, pt);
      deltaLabel    = compareDeltaLabel(range);
    }

    res.json({
      totalVisitors:    parseInt(row.total_visitors)     || 0,
      totalRevenue:     parseFloat(row.total_revenue)    || 0,
      totalTickets:     parseInt(row.total_tickets)      || 0,
      peakHour:         parseInt(peak.peak_hour)         || 0,
      peakCount:        parseInt(peak.peak_count)        || 0,
      peakRevenue:      parseFloat(peak.peak_revenue)    || 0,
      sparkVisitors:    rows.map(r => parseInt(r.visitors)),
      sparkRevenue:     rows.map(r => parseFloat(r.revenue)),
      sparkTickets:     rows.map(r => parseInt(r.tickets)),
      sparkPeak:        peakRows.rows.map(r => parseInt(r.peak)),
      liveCount:        parseInt(todayCount.rows[0].cnt)        || 0,
      weekRevenue:      parseFloat(weekResult.rows[0]?.revenue)  || 0,
      monthRevenue:     parseFloat(monthResult.rows[0]?.revenue) || 0,
      deltaVisitors,
      deltaRevenue,
      deltaTickets,
      deltaLabel,
    });
  } catch (err) {
    console.error('/kpis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── TODAY STATS (topbar live pill) ─────────────────────────────────────────
// GET /api/dashboard/today-stats — always current day, all parks, no filter
router.get('/today-stats', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(quantity), 0)::int          AS visitors,
        COALESCE(SUM(total_amount), 0)::numeric  AS revenue,
        COALESCE(COUNT(ticket_id), 0)::int       AS tickets
      FROM tickets
      WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'Cancelled'
    `);
    res.json({
      visitors: parseInt(rows[0].visitors)    || 0,
      revenue:  parseFloat(rows[0].revenue)   || 0,
      tickets:  parseInt(rows[0].tickets)     || 0,
    });
  } catch (err) {
    console.error('[today-stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DEMOGRAPHICS ────────────────────────────────────────────────────────────
// GET /api/dashboard/demographics?range=
router.get('/demographics', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd } = req.query; const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 'park_id');

    const result = await pool.query(`
      SELECT CASE age_group
               WHEN '0-12'  THEN 'toddler'
               WHEN '13-17' THEN 'kid'
               WHEN '18-35' THEN 'adult'
               WHEN '36-60' THEN 'adult'
               WHEN '60+'   THEN 'senior'
             END AS age_group,
             SUM(CASE WHEN gender = 'Male'   THEN count ELSE 0 END) AS male_count,
             SUM(CASE WHEN gender = 'Female' THEN count ELSE 0 END) AS female_count,
             SUM(CASE WHEN gender = 'Other'  THEN count ELSE 0 END) AS other_count,
             SUM(count) AS total
      FROM visitor_demographics
      WHERE ${dateSQL(range, date, dateEnd, 'recorded_date')} ${parkClauses.length ? `AND ${parkClauses.join(' AND ')}` : ''}
      GROUP BY 1
      ORDER BY
        CASE age_group WHEN 'adult' THEN 1 WHEN 'kid' THEN 2 WHEN 'toddler' THEN 3 WHEN 'senior' THEN 4 END
    `, params);

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
    const { park, state, range, date, dateEnd, compare } = req.query; const cities = extractCities(req.query.city);
    const { clauses: ticketParkClauses, params } = parkSQL(park, state, cities, 't.park_id');
    const { clauses: revenueParkClauses } = parkSQL(park, state, cities, 'rc.park_id');
    const ticketWhere  = `${dateSQL(range, date, dateEnd, 'DATE(t.created_at)')} ${ticketParkClauses.length ? `AND ${ticketParkClauses.join(' AND ')}` : ''}`;
    const revenueWhere = `${dateSQL(range, date, dateEnd, 'rc.date')} ${revenueParkClauses.length ? `AND ${revenueParkClauses.join(' AND ')}` : ''}`;

    const [demo, cat, src, pay] = await Promise.all([
      pool.query(`
        SELECT TRIM(CASE t.age_category WHEN 'Senior Citizen' THEN 'Senior' ELSE t.age_category END) AS name,
               SUM(t.total_amount) AS revenue
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY 1
        ORDER BY revenue DESC
      `, params),
      pool.query(`
        SELECT name, SUM(revenue) AS revenue
        FROM (
          SELECT 'Tickets' AS name, SUM(t.total_amount) AS revenue
          FROM tickets t
          WHERE ${ticketWhere}
          UNION ALL
          SELECT TRIM(rc.category) AS name, SUM(rc.amount) AS revenue
          FROM revenue_categories rc
          WHERE ${revenueWhere}
          GROUP BY 1
        ) s
        GROUP BY 1
        ORDER BY revenue DESC
      `, params),
      pool.query(`
        SELECT TRIM(t.source) AS name, COUNT(DISTINCT t.ticket_id)::numeric AS revenue
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY 1
        ORDER BY revenue DESC
      `, params),
      pool.query(`
        SELECT CASE TRIM(t.payment_mode) WHEN 'Split' THEN 'Others' ELSE TRIM(t.payment_mode) END AS name,
               SUM(t.total_amount) AS revenue
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY 1
        ORDER BY revenue DESC
      `, params),
    ]);

    const DEMO_COLORS = { Adult: '#0E7C66', Child: '#5A6BCF', Toddler: '#D89614', Senior: '#8C5BB3' };
    const CAT_COLORS  = { Tickets: '#0E7C66', Parking: '#5A6BCF', Activities: '#D89614', 'F&B': '#E5604D', Events: '#8C5BB3' };
    const SRC_COLORS  = { Counter: '#0E7C66', Web: '#5A6BCF', WhatsApp: '#D89614' };
    const PAY_COLORS  = { UPI: '#0E7C66', Cash: '#5A6BCF', Card: '#D89614', Others: '#8A92A3' };

    const addColors = (rows, colorMap, prevMap = null) =>
      rows.map(r => ({
        name:      r.name,
        value:     parseFloat(r.revenue),
        color:     colorMap[r.name] || '#ccc',
        prevValue: prevMap ? (prevMap[r.name] ?? null) : undefined,
      }));

    // Previous-period breakdown — only when compare=true
    let prevCatMap = null, prevPayMap = null;
    if (compare === 'true') {
      const prevTicketWhere  = `${prevDateSQL(range, date, dateEnd, 'DATE(t.created_at)')} ${ticketParkClauses.length ? `AND ${ticketParkClauses.join(' AND ')}` : ''}`;
      const prevRevenueWhere = `${prevDateSQL(range, date, dateEnd, 'rc.date')} ${revenueParkClauses.length ? `AND ${revenueParkClauses.join(' AND ')}` : ''}`;

      const [prevCat, prevPay] = await Promise.all([
        pool.query(`
          SELECT name, SUM(revenue) AS revenue
          FROM (
            SELECT 'Tickets' AS name, SUM(t.total_amount) AS revenue
            FROM tickets t
            WHERE ${prevTicketWhere}
            UNION ALL
            SELECT TRIM(rc.category) AS name, SUM(rc.amount) AS revenue
            FROM revenue_categories rc
            WHERE ${prevRevenueWhere}
            GROUP BY 1
          ) s
          GROUP BY 1
        `, params),
        pool.query(`
          SELECT CASE TRIM(t.payment_mode) WHEN 'Split' THEN 'Others' ELSE TRIM(t.payment_mode) END AS name,
                 SUM(t.total_amount) AS revenue
          FROM tickets t
          WHERE ${prevTicketWhere}
          GROUP BY 1
        `, params),
      ]);

      prevCatMap = Object.fromEntries(prevCat.rows.map(r => [r.name, parseFloat(r.revenue)]));
      prevPayMap = Object.fromEntries(prevPay.rows.map(r => [r.name, parseFloat(r.revenue)]));
    }

    res.json({
      byDemographic: addColors(demo.rows, DEMO_COLORS),
      byCategory:    addColors(cat.rows,  CAT_COLORS, prevCatMap),
      bySource:      addColors(src.rows,  SRC_COLORS),
      byPayment:     addColors(pay.rows,  PAY_COLORS, prevPayMap),
    });
  } catch (err) {
    console.error('/revenue-splits error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HOURLY ──────────────────────────────────────────────────────────────────
// GET /api/dashboard/hourly?range=
// Returns { mode: 'hourly'|'trend', labels: string[], footfall: int[], revenue: float[] }
// mode='hourly'  → Daily range, one slot per hour 10AM–7PM, actual counts
// mode='trend'   → Weekly/Monthly → one point per day; Quarterly+ → one point per week
router.get('/hourly', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd } = req.query;
    const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 'park_id');

    const dateWhere = dateSQL(range, date, dateEnd, 'DATE(created_at)');
    const parkWhere = parkClauses.length ? `AND ${parkClauses.join(' AND ')}` : '';

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtDate = (d) => { const dt = new Date(d); return MONTHS[dt.getMonth()] + ' ' + dt.getDate(); };
    const fmtHour = (h) => { const h12 = h % 12 || 12; return `${h12}${h < 12 ? 'AM' : 'PM'}`; };

    const isLong = ['Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months'].includes(range);

    let result, mode, labels, footfall, revenue;

    if (range === 'Daily') {
      mode = 'hourly';
      result = await pool.query(`
        WITH raw AS (
          SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
                 SUM(quantity)::int                  AS footfall,
                 ROUND(SUM(total_amount), 2)          AS revenue
          FROM tickets
          WHERE ${dateWhere} ${parkWhere}
          GROUP BY 1
        ),
        slots AS (SELECT generate_series(10, 19) AS hour)
        SELECT s.hour,
               COALESCE(r.footfall, 0)::int AS footfall,
               COALESCE(r.revenue,  0)      AS revenue
        FROM slots s LEFT JOIN raw r ON r.hour = s.hour
        ORDER BY s.hour
      `, params);
      labels   = result.rows.map(r => fmtHour(parseInt(r.hour)));
      footfall = result.rows.map(r => parseInt(r.footfall));
      revenue  = result.rows.map(r => parseFloat(r.revenue));

    } else if (isLong) {
      mode = 'trend';
      result = await pool.query(`
        SELECT DATE_TRUNC('week', created_at)::date AS period,
               SUM(quantity)::int                    AS footfall,
               ROUND(SUM(total_amount), 2)            AS revenue
        FROM tickets
        WHERE ${dateWhere} ${parkWhere}
        GROUP BY 1
        ORDER BY 1
      `, params);
      labels   = result.rows.map(r => fmtDate(r.period));
      footfall = result.rows.map(r => parseInt(r.footfall));
      revenue  = result.rows.map(r => parseFloat(r.revenue));

    } else {
      mode = 'trend';
      result = await pool.query(`
        SELECT DATE(created_at) AS period,
               SUM(quantity)::int AS footfall,
               ROUND(SUM(total_amount), 2) AS revenue
        FROM tickets
        WHERE ${dateWhere} ${parkWhere}
        GROUP BY 1
        ORDER BY 1
      `, params);
      labels   = result.rows.map(r => fmtDate(r.period));
      footfall = result.rows.map(r => parseInt(r.footfall));
      revenue  = result.rows.map(r => parseFloat(r.revenue));
    }

    res.json({ mode, labels, footfall, revenue });
  } catch (err) {
    console.error('/hourly error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── BUSIEST HOUR BY PARK ────────────────────────────────────────────────────
// GET /api/dashboard/busiest-by-park
// Returns busiest window (start→end) per park using 40% peak threshold.
router.get('/busiest-by-park', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd, compare } = req.query;
    const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 't.park_id');
    const dateWhere = dateSQL(range, date, dateEnd, 'DATE(t.created_at)');
    const where = `${dateWhere}${parkClauses.length ? ` AND ${parkClauses.join(' AND ')}` : ''}`;

    // Fetch all hourly counts per park so we can compute the window in JS
    const result = await pool.query(`
      SELECT t.park_id,
             EXTRACT(HOUR FROM t.created_at)::int AS hour,
             COUNT(DISTINCT t.ticket_id)::int      AS ticket_count,
             SUM(t.total_amount)::numeric          AS revenue,
             p.name AS park_name, p.city, p.color_hex AS color
      FROM tickets t
      JOIN parks p ON p.id = t.park_id
      WHERE ${where}
      GROUP BY t.park_id, p.name, p.city, p.color_hex, EXTRACT(HOUR FROM t.created_at)
      ORDER BY t.park_id, hour
    `, params);

    // Group by park
    const byPark = new Map();
    for (const r of result.rows) {
      const pid = r.park_id;
      if (!byPark.has(pid)) {
        byPark.set(pid, { parkId: pid, parkName: r.park_name, city: r.city, color: r.color, hours: {} });
      }
      byPark.get(pid).hours[parseInt(r.hour)] = {
        ticketCount: parseInt(r.ticket_count),
        revenue:     parseFloat(r.revenue),
      };
    }

    // Compute busiest window using 40% threshold — walk left/right from peak
    function computeWindow(hours) {
      const entries = Object.entries(hours).map(([h, d]) => ({ hour: parseInt(h), ...d }));
      if (!entries.length) return null;
      const peak      = entries.reduce((best, curr) => curr.ticketCount > best.ticketCount ? curr : best);
      const threshold = peak.ticketCount * 0.4;
      let startHour = peak.hour, endHour = peak.hour;
      for (let h = peak.hour - 1; h >= 6;  h--) { if (hours[h]?.ticketCount >= threshold) startHour = h; else break; }
      for (let h = peak.hour + 1; h <= 23; h++) { if (hours[h]?.ticketCount >= threshold) endHour   = h; else break; }
      return { peakHour: peak.hour, ticketCount: peak.ticketCount, revenue: peak.revenue, startHour, endHour };
    }

    // Previous-period total tickets per park — for trend %
    let prevByPark = {};
    if (compare === 'true') {
      const prevWhere = `${prevDateSQL(range, date, dateEnd, 'DATE(t.created_at)')}${parkClauses.length ? ` AND ${parkClauses.join(' AND ')}` : ''}`;
      const prevResult = await pool.query(`
        SELECT t.park_id, COUNT(DISTINCT t.ticket_id)::int AS ticket_count
        FROM tickets t
        WHERE ${prevWhere}
        GROUP BY t.park_id
      `, params);
      for (const r of prevResult.rows) prevByPark[r.park_id] = parseInt(r.ticket_count);
    }

    const out = [];
    for (const [pid, p] of byPark) {
      const win = computeWindow(p.hours);
      if (!win) continue;
      const totalCurrent = Object.values(p.hours).reduce((s, h) => s + h.ticketCount, 0);
      out.push({
        parkId:      pid,
        parkName:    p.parkName,
        city:        p.city,
        color:       p.color,
        peakHour:    win.peakHour,
        startHour:   win.startHour,
        endHour:     win.endHour,
        ticketCount: win.ticketCount,
        revenue:     win.revenue,
        trend:       compare === 'true' ? pct(totalCurrent, prevByPark[pid] || 0) : null,
      });
    }
    out.sort((a, b) => b.ticketCount - a.ticketCount);

    res.json(out);
  } catch (err) {
    console.error('/busiest-by-park error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── HEATMAP ─────────────────────────────────────────────────────────────────
// GET /api/dashboard/heatmap
router.get('/heatmap', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd } = req.query; const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 'park_id');
    const result = await pool.query(`
      SELECT ((EXTRACT(DOW FROM created_at)::int + 6) % 7) AS day_of_week,
             EXTRACT(HOUR FROM created_at)::int AS hour_of_day,
             SUM(quantity) AS footfall
      FROM tickets
      WHERE ${dateSQL(range, date, dateEnd, 'DATE(created_at)')} ${parkClauses.length ? `AND ${parkClauses.join(' AND ')}` : ''}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `, params);

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
    const { park, state, range, date, dateEnd } = req.query; const cities = extractCities(req.query.city);
    const { clauses, params } = parkSQL(park, state, cities, 't.park_id');

    const result = await pool.query(`
      SELECT t.park_id, p.name AS park_name, p.color_hex AS color,
             SUM(CASE WHEN EXTRACT(DOW FROM t.created_at) IN (0, 6) THEN t.total_amount ELSE 0 END) AS weekend_revenue,
             SUM(CASE WHEN EXTRACT(DOW FROM t.created_at) NOT IN (0, 6) THEN t.total_amount ELSE 0 END) AS weekday_revenue,
             SUM(CASE WHEN EXTRACT(DOW FROM t.created_at) IN (0, 6) THEN t.quantity ELSE 0 END) AS weekend_footfall,
             SUM(CASE WHEN EXTRACT(DOW FROM t.created_at) NOT IN (0, 6) THEN t.quantity ELSE 0 END) AS weekday_footfall
      FROM tickets t
      JOIN parks p ON p.id = t.park_id
      WHERE ${dateSQL(range, date, dateEnd, 'DATE(t.created_at)')} ${clauses.length ? `AND ${clauses.join(' AND ')}` : ''}
      GROUP BY t.park_id, p.name, p.color_hex
      ORDER BY weekend_revenue DESC
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
    const { park, state, range, date, dateEnd } = req.query; const cities = extractCities(req.query.city);
    const { clauses: ticketParkClauses, params } = parkSQL(park, state, cities, 't.park_id');
    const { clauses: revenueParkClauses } = parkSQL(park, state, cities, 'rc.park_id');
    const ticketWhere  = `${dateSQL(range, date, dateEnd, 'DATE(t.created_at)')} ${ticketParkClauses.length ? `AND ${ticketParkClauses.join(' AND ')}` : ''}`;
    const revenueWhere = `${dateSQL(range, date, dateEnd, 'rc.date')} ${revenueParkClauses.length ? `AND ${revenueParkClauses.join(' AND ')}` : ''}`;

    const result = await pool.query(`
      WITH metrics AS (
        SELECT t.park_id, 'Revenue' AS metric_name, SUM(t.total_amount)::numeric AS metric_value
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY t.park_id
        UNION ALL
        SELECT t.park_id, 'Tickets' AS metric_name, COUNT(DISTINCT t.ticket_id)::numeric AS metric_value
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY t.park_id
        UNION ALL
        SELECT t.park_id, 'Footfall' AS metric_name, SUM(t.quantity)::numeric AS metric_value
        FROM tickets t
        WHERE ${ticketWhere}
        GROUP BY t.park_id
        UNION ALL
        SELECT rc.park_id, 'Activities' AS metric_name, SUM(rc.amount)::numeric AS metric_value
        FROM revenue_categories rc
        WHERE rc.category = 'Activities' AND ${revenueWhere}
        GROUP BY rc.park_id
        UNION ALL
        SELECT rc.park_id, 'F&B' AS metric_name, SUM(rc.amount)::numeric AS metric_value
        FROM revenue_categories rc
        WHERE rc.category = 'F&B' AND ${revenueWhere}
        GROUP BY rc.park_id
      )
      SELECT t.park_id, t.metric_name, t.metric_value,
             p.name AS park_name, p.city, p.state, p.color_hex AS color
      FROM metrics t
      JOIN parks p ON p.id = t.park_id
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

// ─── TOP PARKS REVENUE (with trend) ─────────────────────────────────────────
// GET /api/dashboard/top-parks-revenue
router.get('/top-parks-revenue', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state, range, date, dateEnd } = req.query;
    const cities = extractCities(req.query.city);
    const { clauses: parkClauses, params } = parkSQL(park, state, cities, 't.park_id');
    const dateWhere     = dateSQL(range, date, dateEnd, 'DATE(t.created_at)');
    const prevDateWhere = prevDateSQL(range, date, dateEnd, 'DATE(t.created_at)');
    const parkWhere     = parkClauses.length ? ` AND ${parkClauses.join(' AND ')}` : '';

    const result = await pool.query(`
      WITH curr AS (
        SELECT t.park_id, SUM(t.total_amount)::numeric AS revenue
        FROM tickets t
        WHERE ${dateWhere}${parkWhere}
        GROUP BY t.park_id
      ),
      prev AS (
        SELECT t.park_id, SUM(t.total_amount)::numeric AS revenue
        FROM tickets t
        WHERE ${prevDateWhere}${parkWhere}
        GROUP BY t.park_id
      )
      SELECT p.id AS park_id, p.name, p.city, p.color_hex AS color,
             COALESCE(c.revenue, 0)  AS revenue,
             COALESCE(pr.revenue, 0) AS prev_revenue
      FROM parks p
      LEFT JOIN curr c  ON c.park_id  = p.id
      LEFT JOIN prev pr ON pr.park_id = p.id
      WHERE COALESCE(c.revenue, 0) > 0
      ORDER BY revenue DESC
    `, params);

    res.json(result.rows.map(r => {
      const revenue     = parseFloat(r.revenue);
      const prevRevenue = parseFloat(r.prev_revenue);
      return {
        parkId:      r.park_id,
        name:        r.name,
        city:        r.city,
        color:       r.color,
        revenue,
        prevRevenue,
        trend: pct(revenue, prevRevenue),
      };
    }));
  } catch (err) {
    console.error('/top-parks-revenue error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── REVENUE TREND ───────────────────────────────────────────────────────────
// GET /api/dashboard/revenue-trend?park=&state=&city=
router.get('/revenue-trend', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { park, state } = req.query; const cities = extractCities(req.query.city);
    const { clauses, params } = parkSQL(park, state, cities, 'rt.park_id');
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
