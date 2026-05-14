const colors = {
  teal: '#0E7C66',
  indigo: '#5A6BCF',
  amber: '#D89614',
  plum: '#8C5BB3',
  coral: '#E5604D',
};

const parks = [
  { parkId: 'jt', name: 'Jungle Trail', city: 'Noida', state: 'Uttar Pradesh', color: colors.teal },
  { parkId: 'ud', name: 'UP Darshan', city: 'Lucknow', state: 'Uttar Pradesh', color: colors.indigo },
  { parkId: 'dp', name: 'Delhi Park', city: 'New Delhi', state: 'Delhi', color: colors.amber },
  { parkId: 'rb', name: 'Rann Bagh', city: 'Ahmedabad', state: 'Gujarat', color: colors.plum },
  { parkId: 'kk', name: 'Konark Kids', city: 'Bhubaneswar', state: 'Odisha', color: colors.coral },
];

const hours = Array.from({ length: 17 }, (_, i) => 6 + i);
const hourlyFootfall = [22, 48, 96, 152, 218, 268, 296, 312, 284, 252, 296, 348, 392, 364, 296, 218, 124];
const hourlyRevenue = [3400, 7200, 14600, 24800, 38400, 49600, 56200, 62400, 51800, 44200, 56400, 68800, 79200, 71600, 56400, 38600, 19800];

function genHeatmap() {
  return Array.from({ length: 7 }, (_, di) => {
    const isWeekend = di >= 5;
    return hours.map((_, hi) => {
      const x = hi - 11;
      const curve = Math.exp(-(x * x) / 24);
      const noise = 0.78 + Math.sin(di * 1.7 + hi * 0.9) * 0.18;
      return Math.max(2, Math.round((isWeekend ? 380 : 220) * curve * noise));
    });
  });
}

const topParks = {
  Revenue: [
    { ...parks[0], value: 1842000 },
    { ...parks[2], value: 1428000 },
    { ...parks[1], value: 1186000 },
    { ...parks[3], value: 842000 },
    { ...parks[4], value: 684000 },
  ],
  Tickets: [
    { ...parks[0], value: 8420 },
    { ...parks[1], value: 6940 },
    { ...parks[2], value: 5820 },
    { ...parks[3], value: 4280 },
    { ...parks[4], value: 3640 },
  ],
  Footfall: [
    { ...parks[0], value: 23420 },
    { ...parks[2], value: 18460 },
    { ...parks[1], value: 16280 },
    { ...parks[3], value: 12480 },
    { ...parks[4], value: 10240 },
  ],
  Activities: [
    { ...parks[1], value: 412000 },
    { ...parks[0], value: 368000 },
    { ...parks[2], value: 298000 },
    { ...parks[4], value: 184000 },
    { ...parks[3], value: 162000 },
  ],
  'F&B': [
    { ...parks[0], value: 298000 },
    { ...parks[2], value: 248000 },
    { ...parks[1], value: 198000 },
    { ...parks[3], value: 142000 },
    { ...parks[4], value: 118000 },
  ],
};

export const dashboardFallback = {
  kpis: {
    totalVisitors: 2940,
    totalRevenue: 489200,
    totalTickets: 980,
    peakHour: 18,
    peakFootfall: 392,
    peakHourRevenue: 79200,
    sparkVisitors: [1820, 1965, 2110, 1740, 2480, 3120, 2940],
    sparkRevenue: [298400, 312000, 358200, 271000, 412800, 528900, 489200],
    sparkTickets: [612, 660, 712, 590, 838, 1042, 980],
    sparkPeak: [16, 17, 18, 14, 21, 24, 22],
    liveCount: 1284,
  },
  demographics: {
    total: 2940,
    demographics: [
      { id: 'adult', name: 'Adults', icon: 'adult', total: 1832, m: 1024, f: 778, o: 30, pct: 62.3 },
      { id: 'kid', name: 'Kids', icon: 'kid', total: 612, m: 312, f: 290, o: 10, pct: 20.8 },
      { id: 'toddler', name: 'Toddlers', icon: 'toddler', total: 184, m: 92, f: 88, o: 4, pct: 6.3 },
      { id: 'senior', name: 'Senior Citizens', icon: 'senior', total: 312, m: 174, f: 132, o: 6, pct: 10.6 },
    ],
  },
  revenueSplits: {
    byDemographic: [
      { name: 'Adult', value: 318400, color: colors.teal },
      { name: 'Child', value: 92800, color: colors.indigo },
      { name: 'Toddler', value: 18200, color: colors.amber },
      { name: 'Senior', value: 59800, color: colors.plum },
    ],
    byCategory: [
      { name: 'Tickets', value: 312800, color: colors.teal },
      { name: 'Parking', value: 38400, color: colors.indigo },
      { name: 'Activities', value: 88600, color: colors.amber },
      { name: 'F&B', value: 49200, color: colors.coral },
      { name: 'Events', value: 0, color: colors.plum },
    ],
    bySource: [
      { name: 'Counter', value: 198400, color: colors.teal },
      { name: 'Web', value: 142800, color: colors.indigo },
      { name: 'WhatsApp', value: 88600, color: colors.amber },
    ],
    byPayment: [
      { name: 'UPI', value: 248400, color: colors.teal },
      { name: 'Cash', value: 92800, color: colors.indigo },
      { name: 'Card', value: 78200, color: colors.amber },
      { name: 'Others', value: 19600, color: colors.coral },
    ],
  },
  hourly: {
    hours,
    footfall: hourlyFootfall,
    revenue: hourlyRevenue,
  },
  heatmap: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    hours,
    data: genHeatmap(),
  },
  weekendWeekday: {
    revenue: [
      { park: 'Jungle Trail', color: colors.teal, weekend: 528000, weekday: 296000 },
      { park: 'UP Darshan', color: colors.indigo, weekend: 412000, weekday: 248000 },
      { park: 'Delhi Park', color: colors.amber, weekend: 386000, weekday: 224000 },
      { park: 'Rann Bagh', color: colors.plum, weekend: 298000, weekday: 178000 },
      { park: 'Konark Kids', color: colors.coral, weekend: 264000, weekday: 162000 },
    ],
    footfall: [
      { park: 'Jungle Trail', color: colors.teal, weekend: 3120, weekday: 1965 },
      { park: 'UP Darshan', color: colors.indigo, weekend: 2480, weekday: 1640 },
      { park: 'Delhi Park', color: colors.amber, weekend: 2280, weekday: 1480 },
      { park: 'Rann Bagh', color: colors.plum, weekend: 1740, weekday: 1180 },
      { park: 'Konark Kids', color: colors.coral, weekend: 1520, weekday: 1060 },
    ],
  },
  comparative: {
    qvq: [
      { q: 'Q1', curr: 4820000, prev: 4120000 },
      { q: 'Q2', curr: 5980000, prev: 5240000 },
      { q: 'Q3', curr: 7240000, prev: 6480000 },
      { q: 'Q4', curr: 6840000, prev: 6180000 },
    ],
    yvy: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => {
      const prev = [1280, 1340, 1420, 1680, 2120, 2480, 2840, 2960, 2620, 2240, 1980, 1840][i] * 1000;
      const curr = Math.round(prev * (1 + (Math.sin(i * 0.7) * 0.1 + 0.14)));
      return { m, curr, prev };
    }),
  },
  topParks,
  revenueTrend: {
    months: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
    parks: [
      { parkId: 'jt', name: 'Jungle Trail', color: colors.teal, series: [248000, 272000, 318000, 296000, 348000, 398000] },
      { parkId: 'ud', name: 'UP Darshan', color: colors.indigo, series: [186000, 212000, 242000, 228000, 278000, 312000] },
      { parkId: 'dp', name: 'Delhi Park', color: colors.amber, series: [218000, 248000, 286000, 272000, 316000, 358000] },
      { parkId: 'rb', name: 'Rann Bagh', color: colors.plum, series: [142000, 168000, 194000, 178000, 218000, 248000] },
      { parkId: 'kk', name: 'Konark Kids', color: colors.coral, series: [118000, 142000, 162000, 148000, 184000, 212000] },
    ],
  },
};
