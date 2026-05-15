'use client';
import { inr, inrFull } from '../lib/format';

const CAT_COLORS = { Tickets: '#1D9E75', 'F&B': '#E24B4A', Activities: '#378ADD', Parking: '#EF9F27' };
const PMT_COLORS = { UPI: '#378ADD', Cash: '#1D9E75', Card: '#7F77DD', Others: '#EF9F27' };

function BarRow({ label, pct, value, color }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
        <span style={{ color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ display: 'flex', gap: 10 }}>
          <span className="mono" style={{ color: 'var(--ink-4)', fontSize: 10.5 }}>{pct}%</span>
          <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600, minWidth: 56, textAlign: 'right' }}>{inr(value)}</span>
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,.07)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s' }}/>
      </div>
    </div>
  );
}

export default function RevenueSummary({ revenueSplits }) {
  if (!revenueSplits) return null;
  const { byCategory = [], byPayment = [] } = revenueSplits;
  const catTotal = byCategory.reduce((s, c) => s + c.value, 0);
  const pmtTotal = byPayment.reduce((s, p) => s + p.value, 0);

  if (catTotal === 0 && pmtTotal === 0) return (
    <div className="sec">
      <div className="sec-head"><div className="sec-title">Revenue Breakdown</div></div>
      <div className="sec-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</span>
      </div>
    </div>
  );

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Revenue Breakdown</div>
      </div>
      <div className="sec-body">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            By Category · {inrFull(catTotal)}
          </div>
          {byCategory.filter(c => c.value > 0).map(c => {
            const pct = catTotal ? Math.round((c.value / catTotal) * 100) : 0;
            return <BarRow key={c.name} label={c.name} pct={pct} value={c.value} color={CAT_COLORS[c.name] || c.color}/>;
          })}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Payment Mode · {inrFull(pmtTotal)}
          </div>
          {byPayment.map(p => {
            const name  = p.name === 'Others' ? 'Split' : p.name;
            const pct   = pmtTotal ? Math.round((p.value / pmtTotal) * 100) : 0;
            return <BarRow key={p.name} label={name} pct={pct} value={p.value} color={PMT_COLORS[p.name] || p.color}/>;
          })}
        </div>
      </div>
    </div>
  );
}
