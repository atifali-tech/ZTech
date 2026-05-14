
// ─── PARK DEFINITIONS ───────────────────────────────────────────────────────
const PARKS = [
  { id: 'p1', name: 'Sunrise Adventure Park', city: 'Austin',       state: 'TX', color: '#2DD4BF', colorDim: 'rgba(45,212,191,0.15)' },
  { id: 'p2', name: 'Canyon Ridge Park',      city: 'Denver',       state: 'CO', color: '#F97316', colorDim: 'rgba(249,115,22,0.15)'  },
  { id: 'p3', name: 'Skyline Fun Zone',        city: 'Phoenix',      state: 'AZ', color: '#A78BFA', colorDim: 'rgba(167,139,250,0.15)' },
  { id: 'p4', name: 'Lakeview Thrills',        city: 'Chicago',      state: 'IL', color: '#FBBF24', colorDim: 'rgba(251,191,36,0.15)'  },
  { id: 'p5', name: 'Coastal Waves Park',      city: 'Miami',        state: 'FL', color: '#34D399', colorDim: 'rgba(52,211,153,0.15)'  },
  { id: 'p6', name: 'Peak Rush Park',          city: 'Seattle',      state: 'WA', color: '#F472B6', colorDim: 'rgba(244,114,182,0.15)' },
];

// ─── CATEGORIES ─────────────────────────────────────────────────────────────
const CATEGORIES = {
  Tickets:    ['General Admission', 'VIP Pass', 'Season Pass', 'Child Ticket'],
  Activities: ['Rock Climbing', 'Zip Line', 'Bungee Jump', 'Go-Kart', 'Paintball'],
  Parking:    ['Standard Parking', 'Premium Parking', 'Valet'],
  'F&B':      ['Food', 'Beverages', 'Combo Meal', 'Snacks'],
};

const PAYMENT_METHODS = ['Credit Card', 'Debit Card', 'Cash', 'Digital Wallet', 'Gift Card'];
const SOURCES = ['Online', 'On-Site Kiosk', 'Mobile App', 'Front Desk'];
const STATUSES = ['Completed', 'Pending', 'Refunded', 'Failed'];

// ─── SEEDED RANDOM ───────────────────────────────────────────────────────────
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateTransactions() {
  const rng = seededRandom(42);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const transactions = [];
  const now = new Date('2026-05-01');

  for (let i = 0; i < 480; i++) {
    const park = pick(PARKS);
    const category = pick(Object.keys(CATEGORIES));
    const subcategory = pick(CATEGORIES[category]);
    const status = rng() < 0.78 ? 'Completed' : rng() < 0.6 ? 'Refunded' : rng() < 0.5 ? 'Pending' : 'Failed';

    const daysAgo = Math.floor(rng() * 90);
    const hoursAgo = Math.floor(rng() * 24);
    const minsAgo = Math.floor(rng() * 60);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hoursAgo, minsAgo, 0, 0);

    let amount = 0;
    if (category === 'Tickets') amount = 12 + rng() * 180;
    else if (category === 'Activities') amount = 20 + rng() * 120;
    else if (category === 'Parking') amount = 5 + rng() * 35;
    else amount = 4 + rng() * 60;

    transactions.push({
      id: `TXN-${String(10000 + i).padStart(5, '0')}`,
      date,
      park,
      category,
      subcategory,
      paymentMethod: pick(PAYMENT_METHODS),
      source: pick(SOURCES),
      amount: parseFloat(amount.toFixed(2)),
      status,
    });
  }

  return transactions.sort((a, b) => b.date - a.date);
}

const ALL_TRANSACTIONS = generateTransactions();

// ─── REVENUE TREND (last 30 days per park) ──────────────────────────────────
function getRevenueTrend(days = 30) {
  const result = {};
  PARKS.forEach(p => { result[p.id] = []; });

  const now = new Date('2026-05-01');
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const label = `${day.getMonth()+1}/${day.getDate()}`;

    PARKS.forEach(park => {
      const rev = ALL_TRANSACTIONS
        .filter(t => t.park.id === park.id &&
          t.date.toDateString() === day.toDateString() &&
          t.status === 'Completed')
        .reduce((sum, t) => sum + t.amount, 0);
      result[park.id].push({ label, value: parseFloat(rev.toFixed(2)) });
    });
  }
  return result;
}

// ─── CATEGORY SPLIT ──────────────────────────────────────────────────────────
function getCategorySplit() {
  const cats = Object.keys(CATEGORIES);
  return cats.map(cat => ({
    category: cat,
    total: ALL_TRANSACTIONS
      .filter(t => t.category === cat && t.status === 'Completed')
      .reduce((s, t) => s + t.amount, 0),
  }));
}

// ─── TOP PARKS ───────────────────────────────────────────────────────────────
function getTopParks() {
  return PARKS.map(park => ({
    ...park,
    revenue: ALL_TRANSACTIONS
      .filter(t => t.park.id === park.id && t.status === 'Completed')
      .reduce((s, t) => s + t.amount, 0),
    transactions: ALL_TRANSACTIONS.filter(t => t.park.id === park.id).length,
  })).sort((a, b) => b.revenue - a.revenue);
}
