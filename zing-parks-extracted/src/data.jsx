// ===== ZingParks demo data =====
const PARKS = [
  { id: "jt", name: "Jungle Trail", city: "Noida", state: "Uttar Pradesh", color: "#0E7C66" },
  { id: "ud", name: "UP Darshan",   city: "Lucknow", state: "Uttar Pradesh", color: "#5A6BCF" },
  { id: "dp", name: "Delhi Park",   city: "New Delhi", state: "Delhi",       color: "#D89614" },
  { id: "rb", name: "Rann Bagh",    city: "Ahmedabad", state: "Gujarat",     color: "#8C5BB3" },
  { id: "kk", name: "Konark Kids",  city: "Bhubaneswar", state: "Odisha",    color: "#E5604D" },
];

// 7-day spark series for the KPI cards
const sparkVisitors = [1820, 1965, 2110, 1740, 2480, 3120, 2940];
const sparkRevenue  = [298400, 312000, 358200, 271000, 412800, 528900, 489200];
const sparkTickets  = [612, 660, 712, 590, 838, 1042, 980];
const sparkPeak     = [16, 17, 18, 14, 21, 24, 22]; // visitors at peak hour

// Demographics
const DEMO = [
  { id: "adult",   name: "Adults",          icon: "adult",   total: 1832, m: 1024, f: 778, o: 30, pct: 62.3 },
  { id: "kid",     name: "Kids",            icon: "kid",     total: 612,  m: 312,  f: 290, o: 10, pct: 20.8 },
  { id: "toddler", name: "Toddlers",        icon: "toddler", total: 184,  m: 92,   f: 88,  o: 4,  pct: 6.3 },
  { id: "senior",  name: "Senior Citizens", icon: "senior",  total: 312,  m: 174,  f: 132, o: 6,  pct: 10.6 },
];
const DEMO_TOTAL = DEMO.reduce((s, d) => s + d.total, 0);

// Revenue splits
const REV_BY_DEMO = [
  { name: "Adult",   value: 318400, color: "#0E7C66" },
  { name: "Child",   value: 92800,  color: "#5A6BCF" },
  { name: "Toddler", value: 18200,  color: "#D89614" },
  { name: "Senior",  value: 59800,  color: "#8C5BB3" },
];
const REV_BY_CATEGORY = [
  { name: "Tickets",    value: 312800, color: "#0E7C66" },
  { name: "Parking",    value: 38400,  color: "#5A6BCF" },
  { name: "Activities", value: 88600,  color: "#D89614" },
  { name: "F&B",        value: 49200,  color: "#E5604D" },
  { name: "Events",     value: 0,      color: "#8C5BB3" }, // zero-value: empty state
];
const REV_BY_SOURCE = [
  { name: "Counter",  value: 198400, color: "#0E7C66" },
  { name: "Web",      value: 142800, color: "#5A6BCF" },
  { name: "WhatsApp", value: 88600,  color: "#D89614" },
];
const REV_BY_PAYMENT = [
  { name: "UPI",    value: 248400, color: "#0E7C66" },
  { name: "Cash",   value: 92800,  color: "#5A6BCF" },
  { name: "Card",   value: 78200,  color: "#D89614" },
  { name: "Others", value: 19600,  color: "#8A92A3" },
];

// Hourly: 6AM-10PM (17 buckets)
const HOURS = Array.from({length: 17}, (_, i) => 6 + i);
const HOURLY_FOOTFALL = [22, 48, 96, 152, 218, 268, 296, 312, 284, 252, 296, 348, 392, 364, 296, 218, 124];
const HOURLY_REVENUE  = [3400, 7200, 14600, 24800, 38400, 49600, 56200, 62400, 51800, 44200, 56400, 68800, 79200, 71600, 56400, 38600, 19800];
const PEAK_HOUR_INDEX = HOURLY_FOOTFALL.indexOf(Math.max(...HOURLY_FOOTFALL)); // 12 → 6PM

// Heatmap 7 days × 17 hours
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function genHeatmap() {
  // realistic curve: peak around 5-7pm, weekends higher
  return DAYS.map((d, di) => {
    const isWk = di >= 5;
    return HOURS.map((h, hi) => {
      const x = hi - 11; // center near 5pm
      const curve = Math.exp(-(x*x)/24);
      const noise = 0.78 + Math.sin(di*1.7 + hi*0.9)*0.18;
      const base = (isWk ? 380 : 220) * curve * noise;
      return Math.max(2, Math.round(base));
    });
  });
}
const HEATMAP = genHeatmap();
const HM_MAX = Math.max(...HEATMAP.flat());

// Weekend vs Weekday by park
const WE_WD_REV = PARKS.map((p, i) => ({
  park: p.name, color: p.color,
  weekend: [528000, 412000, 386000, 298000, 264000][i],
  weekday: [296000, 248000, 224000, 178000, 162000][i],
}));
const WE_WD_FF  = PARKS.map((p, i) => ({
  park: p.name, color: p.color,
  weekend: [3120, 2480, 2280, 1740, 1520][i],
  weekday: [1965, 1640, 1480, 1180, 1060][i],
}));

// Comparative: QvQ and YvY
const QvQ = [
  { q: "Q1", curr: 4820000, prev: 4120000 },
  { q: "Q2", curr: 5980000, prev: 5240000 },
  { q: "Q3", curr: 7240000, prev: 6480000 },
  { q: "Q4", curr: 6840000, prev: 6180000 },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YvY = MONTHS.map((m, i) => {
  const prev = [1280, 1340, 1420, 1680, 2120, 2480, 2840, 2960, 2620, 2240, 1980, 1840][i] * 1000;
  const curr = prev * (1 + (Math.sin(i*0.7)*0.1 + 0.14));
  return { m, prev, curr: Math.round(curr) };
});

// Top parks (per metric)
const TOP_PARKS = {
  Revenue:    [{p:0,v:1842000},{p:2,v:1428000},{p:1,v:1186000},{p:3,v:842000},{p:4,v:684000}],
  Tickets:    [{p:0,v:8420}, {p:1,v:6940}, {p:2,v:5820}, {p:3,v:4280}, {p:4,v:3640}],
  Footfall:   [{p:0,v:23420},{p:2,v:18460},{p:1,v:16280},{p:3,v:12480},{p:4,v:10240}],
  Activities: [{p:1,v:412000},{p:0,v:368000},{p:2,v:298000},{p:4,v:184000},{p:3,v:162000}],
  "F&B":      [{p:0,v:298000},{p:2,v:248000},{p:1,v:198000},{p:3,v:142000},{p:4,v:118000}],
};

// 6-month revenue trend per park
const REV_TREND = PARKS.map((p, pi) => ({
  park: p.name, color: p.color,
  series: [
    [248,272,318,296,348,398],
    [186,212,242,228,278,312],
    [218,248,286,272,316,358],
    [142,168,194,178,218,248],
    [118,142,162,148,184,212],
  ][pi].map(v => v*1000),
}));
const REV_TREND_MONTHS = ["Dec","Jan","Feb","Mar","Apr","May"];

// Helpers
function inr(n) {
  if (n >= 10000000) return "₹" + (n/10000000).toFixed(2) + " Cr";
  if (n >= 100000)   return "₹" + (n/100000).toFixed(2) + " L";
  if (n >= 1000)     return "₹" + Math.round(n/100)/10 + "K";
  return "₹" + n;
}
function inrFull(n) {
  // lakh-style with commas
  const s = String(Math.round(n));
  if (s.length <= 3) return "₹" + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return "₹" + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}
function num(n) {
  return Number(n).toLocaleString("en-IN");
}
function pct(part, whole) {
  if (!whole) return 0;
  return (part / whole) * 100;
}

Object.assign(window, {
  PARKS, sparkVisitors, sparkRevenue, sparkTickets, sparkPeak,
  DEMO, DEMO_TOTAL,
  REV_BY_DEMO, REV_BY_CATEGORY, REV_BY_SOURCE, REV_BY_PAYMENT,
  HOURS, HOURLY_FOOTFALL, HOURLY_REVENUE, PEAK_HOUR_INDEX,
  DAYS, HEATMAP, HM_MAX,
  WE_WD_REV, WE_WD_FF,
  QvQ, MONTHS, YvY,
  TOP_PARKS, REV_TREND, REV_TREND_MONTHS,
  inr, inrFull, num, pct,
});
