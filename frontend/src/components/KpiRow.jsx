'use client';
import { num, inr, inrFull } from '../lib/format';

// Static park data — spec colours; replace once kpis.visitorsByPark / revenueByPark land
const PARK_STATIC = [
  { label: 'UP Darshan',    color: '#1D9E75', pct: 22 },
  { label: 'Harmony',       color: '#E24B4A', pct: 18 },
  { label: 'Gautam Buddha', color: '#378ADD', pct: 16 },
  { label: 'Shivalaya',     color: '#EF9F27', pct: 14 },
  { label: 'Jungle Trail',  color: '#D4537E', pct: 13 },
  { label: 'Saat Ajoobe',   color: '#7F77DD', pct: 10 },
  { label: 'World Park',    color: '#34C4C4', pct:  7 },
];

const PMT_COLOR = { UPI: '#378ADD', Cash: '#1D9E75', Card: '#7F77DD', Split: '#EF9F27' };

function splitPct(v, total) { return total ? Math.round((v / total) * 100) : 0; }

function BarRow({ label, fill, displayVal, color }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: 'var(--ink-3)' }}>{label}</span>
        <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{displayVal}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(0,0,0,.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(fill, 100)}%`, background: color, borderRadius: 2, transition: 'width .4s' }}/>
      </div>
    </div>
  );
}

function Half({ heading, total, rows }) {
  return (
    <div style={{ flex: 1, padding: '10px 12px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
        {heading}
      </div>
      <div className="mono" style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)', lineHeight: 1.1, marginBottom: 8 }}>
        {total}
      </div>
      {rows.map((r, i) => <BarRow key={i} {...r}/>)}
    </div>
  );
}

function Unit({ title, left, right }) {
  return (
    <div className="sec" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px 7px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10.5, fontWeight: 700, color: 'var(--ink-4)',
        letterSpacing: '.05em', textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ display: 'flex' }}>
        <Half {...left}/>
        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }}/>
        <Half {...right}/>
      </div>
    </div>
  );
}

export default function KpiRow({ data, revenueSplits }) {
  if (!data) return null;

  const byCategory = revenueSplits?.byCategory || [];
  const bySource   = revenueSplits?.bySource   || [];
  const byPayment  = revenueSplits?.byPayment  || [];

  // Unit 1 — park splits (new fields with static fallback)
  const parkVisRows = (data.visitorsByPark || PARK_STATIC).map(p => ({
    label: p.label || p.name, color: p.color, fill: p.pct, displayVal: `${p.pct}%`,
  }));
  const parkRevRows = (data.revenueByPark
    ? data.revenueByPark.map(p => ({ label: p.name, color: p.color, fill: splitPct(p.revenue, data.totalRevenue), displayVal: inr(p.revenue) }))
    : PARK_STATIC.map(p => ({ label: p.label, color: p.color, fill: p.pct, displayVal: inr(Math.round(data.totalRevenue * p.pct / 100)) }))
  );

  // Unit 2 — ticket source splits
  const ticketRev     = byCategory.find(c => c.name === 'Tickets')?.value || 0;
  const srcTotal      = bySource.reduce((s, x) => s + x.value, 0);
  const ticketCntRows = (data.ticketsBySource
    ? data.ticketsBySource.map(s => ({ label: s.name, color: s.color, fill: s.pct, displayVal: `${s.pct}%` }))
    : bySource.map(s => { const p = splitPct(s.value, srcTotal); return { label: s.name, color: s.color, fill: p, displayVal: `${p}%` }; })
  );
  const ticketRevRows = bySource.map(s => ({
    label: s.name, color: s.color,
    fill: splitPct(s.value, srcTotal),
    displayVal: inr(Math.round(ticketRev * (srcTotal ? s.value / srcTotal : 0))),
  }));

  // Unit 3 — revenue by category
  const catTotal = byCategory.reduce((s, c) => s + c.value, 0) || data.totalRevenue;
  const catRows  = byCategory.filter(c => c.value > 0).map(c => ({
    label: c.name, color: c.color,
    fill: splitPct(c.value, catTotal),
    _pct: `${splitPct(c.value, catTotal)}%`,
    _inr: inr(c.value),
  }));

  // Unit 4 — payment mode (rename Others → Split, override colours)
  const pmtTotal = byPayment.reduce((s, p) => s + p.value, 0);
  const pmtRows  = byPayment.map(p => {
    const name  = p.name === 'Others' ? 'Split' : p.name;
    const color = PMT_COLOR[name] || p.color;
    return { label: name, color, fill: splitPct(p.value, pmtTotal), _pct: `${splitPct(p.value, pmtTotal)}%`, _inr: inr(p.value) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Unit
        title="Visitors · Park Revenue"
        left={{ heading: 'Total Visitors', total: num(data.totalVisitors), rows: parkVisRows }}
        right={{ heading: 'Park Revenue',  total: inrFull(data.totalRevenue), rows: parkRevRows }}
      />
      <Unit
        title="Ticket Transactions"
        left={{ heading: 'Total Tickets',  total: num(data.totalTickets), rows: ticketCntRows }}
        right={{ heading: 'Ticket Revenue', total: inrFull(ticketRev),    rows: ticketRevRows }}
      />
      <Unit
        title="Total Revenue"
        left={{ heading: 'Grand Total',  total: inrFull(catTotal), rows: catRows.map(c => ({ ...c, displayVal: c._pct })) }}
        right={{ heading: 'By Category', total: inrFull(catTotal), rows: catRows.map(c => ({ ...c, displayVal: c._inr })) }}
      />
      <Unit
        title="Payment Mode"
        left={{ heading: 'Split %', total: inrFull(pmtTotal), rows: pmtRows.map(p => ({ ...p, displayVal: p._pct })) }}
        right={{ heading: 'Split ₹', total: inrFull(pmtTotal), rows: pmtRows.map(p => ({ ...p, displayVal: p._inr })) }}
      />
    </div>
  );
}
