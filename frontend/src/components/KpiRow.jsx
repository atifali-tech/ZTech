'use client';
import { useState } from 'react';
import Icon from './Icon';
import { Sparkline, Delta } from './Primitives';
import { num, inr, inrFull, formatHour } from '../lib/format';

const SOFT_DONUT_COLORS = ['#5E8FA8', '#74A690', '#D7A85B', '#B785A7', '#8C93BF', '#D08178', '#6FA6A3'];

function compactValue(n, currency = false) {
  const v = Number(n) || 0;
  if (currency) {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${Math.round(v)}`;
  }
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString('en-IN');
}

export function ModernDonut({ rows = [], centerLabel = 'Total', centerValue, formatValue, currency = false }) {
  const [active, setActive] = useState(null);
  const cleaned = rows
    .filter(r => Number(r.value) > 0)
    .slice(0, 5)
    .map((r, i) => ({ ...r, color: SOFT_DONUT_COLORS[i % SOFT_DONUT_COLORS.length] }));
  const total = cleaned.reduce((s, r) => s + Number(r.value || 0), 0);
  const size = 126;
  const thickness = 10;
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const fmt = formatValue || ((v) => compactValue(v, currency));
  const { slices } = cleaned.reduce((state, r, i) => {
    const frac = total > 0 ? Number(r.value) / total : 0;
    const len = frac * circ;
    return {
      acc: state.acc + len,
      slices: [
        ...state.slices,
        {
          ...r,
          frac,
          dash: `${Math.max(len - 1.5, 0)} ${circ - Math.max(len - 1.5, 0)}`,
          offset: -state.acc,
          active: active === i,
        },
      ],
    };
  }, { acc: 0, slices: [] });

  if (total <= 0) {
    return <div className="kpi-donut-empty">No data for this period</div>;
  }

  return (
    <div className="kpi-donut">
      <div className="kpi-donut-chart">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#EEF1F4" strokeWidth={thickness}/>
          {slices.map((s, i) => (
            <circle
              key={s.name ?? i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={s.active ? thickness + 2 : thickness}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
              className="kpi-donut-slice"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
          <text x={cx} y={cy - 6} className="kpi-donut-center-label">{centerLabel}</text>
          <text x={cx} y={cy + 13} className="kpi-donut-center-value">{centerValue || compactValue(total, currency)}</text>
        </svg>
      </div>
      <div className="kpi-donut-legend">
        {slices.map((s, i) => (
          <div
            key={s.name ?? i}
            className={'kpi-donut-legend-row' + (active === i ? ' active' : '')}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="kpi-donut-swatch" style={{ background: s.color }}/>
            <span className="kpi-donut-name">{s.name}</span>
            <span className="kpi-donut-val">{fmt(s.value)}</span>
            <span className="kpi-donut-pct">{(s.frac * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({ label, icon, value, delta, deltaLabel, extra, actions, sparkData, sparkColor }) {
  const hasTrend  = delta != null || deltaLabel;
  const hasSpark  = sparkData && sparkData.length > 2;
  return (
    <div className="sec kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            {icon && <Icon name={icon} size={15} color="var(--ink-4)"/>}
            {label}
          </div>
          {hasTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
              {delta != null && <Delta value={delta}/>}
              {deltaLabel && <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{deltaLabel}</span>}
            </div>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0, display: 'flex', gap: 4 }}>{actions}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, marginTop: 8 }}>
        <div className="kpi-val" style={{ marginTop: 0, lineHeight: 1, fontWeight: 700 }}>{value}</div>
        {hasSpark && (
          <div style={{ flexShrink: 0, marginBottom: 3 }}>
            <Sparkline data={sparkData} color={sparkColor || 'var(--teal)'} width={84} height={28}/>
          </div>
        )}
      </div>

      {extra && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', padding: '10px 0 0' }}>
          {extra}
        </div>
      )}
    </div>
  );
}

export function BreakdownList({ rows, formatValue, emptyText }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(r => (
        <div key={r.name ?? r.parkId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: '#F5F6F8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color || '#888', flexShrink: 0, display: 'inline-block' }}/>
          <span style={{ fontSize: 10.5, color: 'var(--ink-2)', flex: 1 }}>{r.name ?? r.parkId}</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function KpiRow({ data, revenueSplits = {}, topParks = {} }) {
  if (!data) return null;

  const comparing = data.deltaLabel != null;
  const cmpLabel  = comparing ? data.deltaLabel : null;
  const delta     = (val) => comparing ? val : null;
  const peakLabel = formatHour(data.peakHour);

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors" icon="users"
          value={num(data.totalVisitors)}
          delta={delta(data.deltaVisitors)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(topParks.Footfall || []).filter(p => p.value > 0).slice(0, 5).map(p => ({ name: p.name, value: p.value, color: p.color }))}
              formatValue={num}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Revenue" icon="chart"
          value={inrFull(data.totalRevenue || 0)}
          delta={delta(data.deltaRevenue)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(revenueSplits?.byCategory || []).filter(r => r.value > 0).slice(0, 5)}
              formatValue={inr}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Ticket Transactions" icon="ticket"
          value={num(data.totalTickets)}
          delta={delta(data.deltaTickets)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(revenueSplits?.bySource || []).filter(r => r.value > 0).slice(0, 5)}
              formatValue={num}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            <Icon name="clock" size={15} color="var(--ink-4)"/> Busiest Hour
          </div>
          {data.peakCount > 0 ? (
            <>
              <div className="kpi-val mono" style={{ fontSize: 30, marginTop: 6 }}>
                {peakLabel.replace('AM','').replace('PM','')}
                <span className="unit">{peakLabel.includes('PM') ? 'PM' : 'AM'}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--teal)', fontFamily: "'JetBrains Mono', monospace" }}>
                {num(data.peakCount)} tickets
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                {inr(data.peakRevenue)} this hour
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
                {(data.sparkPeak || []).map((v, i, arr) => (
                  <div key={i} style={{
                    flex: 1, height: (v / Math.max(...arr, 1)) * 100 + '%',
                    background: i === arr.length - 1 ? 'var(--teal)' : 'var(--teal-100)',
                    borderRadius: 1.5,
                  }}/>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-4)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 8 }}>No data for this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
