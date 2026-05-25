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

// Horizontal ranked bar list — used when one park dominates (>60%).
// Shows rank, color dot, name, formatted value, and real % on a proportional bar.
function ParkRankedBars({ rows, total, fmt }) {
  const [hovered, setHovered] = useState(null);
  const maxVal = rows.reduce((m, r) => Math.max(m, Number(r.value)), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
      {rows.map((r, i) => {
        const pct    = total > 0 ? (Number(r.value) / total) * 100 : 0;
        const barPct = maxVal > 0 ? (Number(r.value) / maxVal) * 100 : 0;
        const active = hovered === i;
        return (
          <div
            key={r.name ?? i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: active ? r.color : 'var(--ink-5)',
                width: 16, textAlign: 'right', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace",
              }}>#{i + 1}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color, flexShrink: 0 }}/>
              <span style={{
                flex: 1, fontSize: 11, fontWeight: active ? 700 : 600,
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{r.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--ink)', flexShrink: 0,
              }}>{fmt(r.value)}</span>
              <span style={{
                fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                color: active ? r.color : 'var(--ink-4)', width: 34, textAlign: 'right', flexShrink: 0,
              }}>{pct.toFixed(0)}%</span>
            </div>
            <div style={{
              height: 5, background: 'var(--surface-2)', borderRadius: 3,
              overflow: 'hidden', marginLeft: 22,
            }}>
              <div style={{
                height: '100%', width: `${barPct}%`,
                background: r.color, borderRadius: 3,
                opacity: active ? 1 : 0.75,
                transition: 'width .35s cubic-bezier(.2,.8,.2,1), opacity .15s',
              }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ModernDonut({ rows = [], centerLabel = 'Total', centerValue, formatValue, currency = false }) {
  const [active, setActive] = useState(null);
  const cleaned = rows
    .filter(r => Number(r.value) > 0)
    .slice(0, 7)
    .map((r, i) => ({ ...r, color: r.color || SOFT_DONUT_COLORS[i % SOFT_DONUT_COLORS.length] }));
  const total = cleaned.reduce((s, r) => s + Number(r.value || 0), 0);
  const fmt   = formatValue || ((v) => compactValue(v, currency));

  if (total <= 0) {
    return <div className="kpi-donut-empty">No data for this period</div>;
  }

  // Auto-switch: if the largest single item >60% of total, a donut is visually misleading.
  // Show a ranked bar list instead so every park is clearly readable.
  const maxShare = cleaned.length > 0 ? Number(cleaned[0].value) / total : 0;
  if (maxShare > 0.60) {
    return <ParkRankedBars rows={cleaned} total={total} fmt={fmt} />;
  }

  // --- Donut path (balanced data) ---
  const size      = 148;
  const thickness = 15;
  const radius    = (size - thickness) / 2;
  const cx        = size / 2;
  const cy        = size / 2;
  const circ      = 2 * Math.PI * radius;
  const gap       = 2;

  const sqrtWeights = cleaned.map(r => Math.sqrt(Number(r.value) / total));
  const sqrtTotal   = sqrtWeights.reduce((s, w) => s + w, 0);
  const scaledFracs = sqrtWeights.map(w => w / sqrtTotal);

  const { slices } = cleaned.reduce((state, r, i) => {
    const realFrac   = Number(r.value) / total;
    const scaledFrac = scaledFracs[i];
    const arcLen     = Math.max(scaledFrac * circ - gap, 0);
    return {
      acc: state.acc + scaledFrac * circ,
      slices: [
        ...state.slices,
        { ...r, frac: realFrac, dash: `${arcLen} ${circ - arcLen}`, offset: -state.acc + gap / 2, active: active === i },
      ],
    };
  }, { acc: 0, slices: [] });

  const activeSlice = active !== null ? slices[active] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#EEF1F4" strokeWidth={thickness}/>
          {slices.map((s, i) => (
            <circle
              key={s.name ?? i}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={s.active ? thickness + 3 : thickness}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-width 0.15s ease, opacity 0.15s ease', cursor: 'pointer', opacity: active !== null && !s.active ? 0.28 : 1 }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
          {activeSlice ? (
            <>
              <text x={cx} y={cy - 11} textAnchor="middle" fill={activeSlice.color} style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.07em' }}>
                {activeSlice.name.length > 11 ? activeSlice.name.slice(0, 10) + '…' : activeSlice.name}
              </text>
              <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--ink)" style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(activeSlice.value)}
              </text>
              <text x={cx} y={cy + 18} textAnchor="middle" fill="var(--ink-4)" style={{ fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                {(activeSlice.frac * 100).toFixed(1)}%
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 7} textAnchor="middle" fill="var(--ink-4)" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {centerLabel}
              </text>
              <text x={cx} y={cy + 11} textAnchor="middle" fill="var(--ink)" style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {centerValue || compactValue(total, currency)}
              </text>
            </>
          )}
        </svg>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', width: '100%' }}>
        {slices.map((s, i) => (
          <div
            key={s.name ?? i}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 6px', borderRadius: 6,
              background: s.active ? s.color + '15' : 'transparent',
              border: `1.5px solid ${s.active ? s.color + '60' : 'transparent'}`,
              cursor: 'pointer', transition: 'background 0.13s, border-color 0.13s',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: s.active ? s.color : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
              {s.name}
            </span>
            <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ink-4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {(s.frac * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({ label, icon, value, delta, extra, actions, sparkData, sparkColor }) {
  const hasTrend  = delta != null;
  const hasSpark  = sparkData && sparkData.length > 2;
  return (
    <div className="sec kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            {icon && <Icon name={icon} size={15} color="var(--ink-4)"/>}
            {label}
          </div>
          {hasTrend && delta != null && <Delta value={delta}/>}
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
  const delta     = (val) => comparing ? val : null;
  const peakLabel = formatHour(data.peakHour);

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors" icon="users"
          value={num(data.totalVisitors)}
          delta={delta(data.deltaVisitors)}          extra={
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
          delta={delta(data.deltaRevenue)}          extra={
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
          delta={delta(data.deltaTickets)}          extra={
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
