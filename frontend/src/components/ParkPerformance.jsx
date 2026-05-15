'use client';
import { useResize } from './Primitives';
import { num, inr } from '../lib/format';

export default function ParkPerformance({ topParks }) {
  const [ref, { w }] = useResize();
  const revenueRows = topParks?.Revenue || [];
  const footfallRows = topParks?.Footfall || [];
  if (!revenueRows.length) return (
    <div className="sec">
      <div className="sec-head"><div className="sec-title">Park Performance</div></div>
      <div className="sec-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</span>
      </div>
    </div>
  );

  const width  = w || 400;
  const height = 220;
  const padL = 6, padR = 6, padT = 12, padB = 74;
  const chartW = Math.max(1, width - padL - padR);
  const chartH = height - padT - padB;
  const parks = revenueRows.slice(0, 7).map(row => ({
    ...row,
    visitors: footfallRows.find(f => f.parkId === row.parkId)?.value || 0,
  }));
  const maxRev = Math.max(...parks.map(p => p.value));
  const groupW = chartW / parks.length;
  const barW = Math.max(12, Math.floor(groupW * 0.6));

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Park Performance</div>
        <div className="sec-actions" style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ink-4)', alignItems: 'center' }}>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg width="8" height="8"><rect width="8" height="8" rx="1" fill="var(--teal)"/></svg>
            Revenue
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg width="8" height="8"><rect width="8" height="8" rx="1" fill="var(--ink-4)" opacity="0.35"/></svg>
            Visitors
          </span>
        </div>
      </div>
      <div className="sec-body" ref={ref}>
        <svg width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
          {parks.map((p, i) => {
            const cx = padL + i * groupW + groupW / 2;
            const revH = maxRev > 0 ? chartH * (p.value / maxRev) : 0;
            const x = cx - barW / 2;
            const y = padT + chartH - revH;
            const labelY = padT + chartH + 14;
            return (
              <g key={p.parkId}>
                <rect x={x} y={y} width={barW} height={revH} rx={3} fill={p.color || 'var(--teal)'} />
                <text x={cx} y={labelY} textAnchor="middle" fill="var(--ink-4)" style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}>
                  {p.name}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH} stroke="var(--border)" strokeWidth={1} />
        </svg>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {parks.map(p => (
            <div key={p.parkId} style={{ padding: 8, borderRadius: 8, background: '#F5F6F8' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{inr(p.value)}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-4)' }}>{num(p.visitors)} visitors</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
