'use client';
import { useState } from 'react';
import Icon from './Icon';
import { Delta } from './Primitives';
import { num, inr, inrFull, formatHour } from '../lib/format';

// Static until kpis.visitorsByPark / revenueByPark API fields are available
const PARKS_7 = [
  { name: 'UP Darshan',    color: '#1D9E75', visPct: 22, revPct: 24 },
  { name: 'Harmony',       color: '#E24B4A', visPct: 18, revPct: 19 },
  { name: 'Gautam Buddha', color: '#378ADD', visPct: 16, revPct: 17 },
  { name: 'Shivalaya',     color: '#EF9F27', visPct: 14, revPct: 13 },
  { name: 'Jungle Trail',  color: '#D4537E', visPct: 13, revPct: 12 },
  { name: 'Saat Ajoobe',   color: '#7F77DD', visPct: 10, revPct:  9 },
  { name: 'World Park',    color: '#34C4C4', visPct:  7, revPct:  6 },
];

// Static until API supports period-level revenue — mult approximates daily→weekly→monthly
const REV_PERIODS = {
  Today: { mult: 1,    delta: -7.4, label: 'vs yesterday'  },
  Week:  { mult: 6.6,  delta:  4.2, label: 'vs last week'  },
  Month: { mult: 26.3, delta: 11.8, label: 'vs last month' },
};

function KpiCard({ label, icon, value, delta, deltaLabel = 'vs last 7 days avg', extra }) {
  return (
    <div className="sec kpi">
      <div className="kpi-label">
        {icon && <Icon name={icon} size={13} color="var(--ink-4)"/>}
        {label}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="kpi-row">
        {delta != null && <Delta value={delta}/>}
        <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{deltaLabel}</span>
      </div>
      {extra}
    </div>
  );
}

export default function KpiRow({ data }) {
  const [revPeriod, setRevPeriod] = useState('Today');
  if (!data) return null;

  const peakLabel = formatHour(data.peakHour);
  const revCfg    = REV_PERIODS[revPeriod];
  const revValue  = Math.round(data.totalRevenue * revCfg.mult);

  // Card 1 extra — 7-park visitor % in tiny colored text
  const visBreakdown = (
    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
      {PARKS_7.map(p => (
        <span key={p.name} style={{ fontSize: 10, color: p.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {p.name.split(' ')[0]} {p.visPct}%
        </span>
      ))}
    </div>
  );

  // Card 2 extra — period toggle + park revenue breakdown
  const revBreakdown = (
    <>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {Object.keys(REV_PERIODS).map(p => (
          <button key={p} onClick={() => setRevPeriod(p)} style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            border: '1px solid',
            borderColor: revPeriod === p ? 'var(--teal)' : 'var(--border)',
            background:  revPeriod === p ? 'var(--teal-100, #E6F4F1)' : 'transparent',
            color:       revPeriod === p ? 'var(--teal)' : 'var(--ink-4)',
            cursor: 'pointer',
          }}>
            {p}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
        {PARKS_7.map(p => (
          <span key={p.name} style={{ fontSize: 10, color: p.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {p.name.split(' ')[0]} {inr(Math.round(revValue * p.revPct / 100))}
          </span>
        ))}
      </div>
    </>
  );

  // Card 3 extra — source breakdown tiny text
  const srcBreakdown = (
    <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-4)', display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
      <span>Counter <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>54%</span></span>
      <span>Web <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>32%</span></span>
      <span>App <span className="mono" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>14%</span></span>
    </div>
  );

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors" icon="users"
          value={num(data.totalVisitors)}
          delta={5.8} extra={visBreakdown}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Revenue" icon="chart"
          value={inrFull(revValue)}
          delta={revCfg.delta} deltaLabel={revCfg.label} extra={revBreakdown}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Ticket Transactions" icon="ticket"
          value={num(data.totalTickets)}
          delta={6.0} extra={srcBreakdown}
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
          <div className="kpi-label"><Icon name="clock" size={13} color="var(--ink-4)"/> Peak Hour</div>
          <div className="row" style={{ alignItems: 'flex-end', marginTop: 4, gap: 10 }}>
            <div className="kpi-val mono" style={{ fontSize: 30 }}>
              {peakLabel.replace('AM','').replace('PM','')}
              <span className="unit">{peakLabel.includes('PM') ? 'PM' : 'AM'}</span>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 18, color: 'var(--teal)', lineHeight: 1 }}>
                {num(data.peakFootfall)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600, marginTop: 3 }}>
                visitors
              </div>
            </div>
          </div>
          <div className="kpi-row" style={{ flexWrap: 'wrap' }}>
            <span className="tag teal">Today's Peak</span>
            <span style={{ color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{inr(data.peakHourRevenue)} this hour</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
            {(data.sparkPeak || []).map((v, i) => {
              const maxv = Math.max(...(data.sparkPeak || [1]));
              const h = (v / maxv) * 100;
              return (
                <div key={i} style={{
                  flex: 1, height: h + '%',
                  background: i === (data.sparkPeak || []).length - 1 ? 'var(--teal)' : 'var(--teal-100)',
                  borderRadius: 1.5,
                }}/>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-4)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
