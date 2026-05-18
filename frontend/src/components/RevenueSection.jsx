'use client';
import { inr, inrFull } from '../lib/format';
import { Delta } from './Primitives';
import DonutChart from './DonutChart';

const CAT_COLORS = { Tickets: '#1D9E75', 'F&B': '#E24B4A', Activities: '#378ADD', Parking: '#EF9F27' };
const PMT_COLORS = { UPI: '#378ADD', Cash: '#1D9E75', Card: '#7F77DD', Others: '#EF9F27' };

function LegendRow({ label, pct, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }}/>
      <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: "'JetBrains Mono', monospace" }}>{pct}%</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>{inr(value)}</span>
    </div>
  );
}

function DonutSection({ title, items, colorMap, total }) {
  const mapped = items.filter(i => i.value > 0).map(i => ({ ...i, color: colorMap[i.name] || i.color }));
  if (!mapped.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <DonutChart items={mapped} total={total}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          {mapped.map(i => {
            const pct = total ? Math.round((i.value / total) * 100) : 0;
            return <LegendRow key={i.name} label={i.name === 'Others' ? 'Split' : i.name} pct={pct} value={i.value} color={i.color}/>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function RevenueSection({ kpiData, revenueSplits }) {
  const comparing = kpiData?.deltaLabel != null;
  const { byCategory = [], byPayment = [] } = revenueSplits || {};
  const catTotal  = byCategory.reduce((s, c) => s + c.value, 0);
  const pmtTotal  = byPayment.reduce((s, p) => s + p.value, 0);
  const noData    = catTotal === 0 && pmtTotal === 0;

  return (
    <div className="sec" style={{ height: '100%' }}>
      <div className="sec-head">
        <div className="sec-title">Total Revenue</div>
        {comparing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'nowrap' }}>
            <Delta value={kpiData.deltaRevenue}/>
            <span style={{ color: 'var(--ink-4)', fontSize: 11, whiteSpace: 'nowrap' }}>{kpiData.deltaLabel}</span>
          </div>
        )}
      </div>
      <div className="sec-body" style={{ gap: 18 }}>
        <div>
          <div className="kpi-val">{inrFull(catTotal || kpiData?.totalRevenue || 0)}</div>
        </div>

        {noData ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        ) : (
          <>
            <DonutSection title="By Category" items={byCategory} colorMap={CAT_COLORS} total={catTotal}/>
            {catTotal > 0 && pmtTotal > 0 && <div style={{ borderTop: '1px solid var(--border)' }}/>}
            <DonutSection title="Payment Mode" items={byPayment} colorMap={PMT_COLORS} total={pmtTotal}/>
          </>
        )}
      </div>
    </div>
  );
}
