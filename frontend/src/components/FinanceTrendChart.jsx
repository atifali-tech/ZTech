'use client';
import { useState } from 'react';
import { useResize } from './Primitives';
import { inr } from '../lib/format';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHART_H = 140;
const PAD = { t: 16, r: 16, b: 40, l: 60 };

function fmtMonth(m) {
  if (!m) return '';
  const [year, mon] = m.split('-');
  const label = MONTHS[parseInt(mon, 10) - 1] || mon;
  return year ? `${label} '${year.slice(2)}` : label;
}

export default function FinanceTrendChart({ data = [] }) {
  const [hover, setHover] = useState(null);
  const [ref, { w }] = useResize();

  if (!data.length) return null;

  const width   = Math.max(w || 400, 200);
  const chartW  = width - PAD.l - PAD.r;
  const totalH  = CHART_H + PAD.t + PAD.b;
  const maxAmt  = Math.max(...data.map(d => d.refund_amount || 0), 1);
  const barGap  = chartW / data.length;
  const barW    = Math.max(Math.floor(barGap * 0.6), 4);

  const bx = (i) => PAD.l + i * barGap + (barGap - barW) / 2;
  const by = (v) => PAD.t + CHART_H - (v / maxAmt) * CHART_H;
  const bh = (v) => Math.max((v / maxAmt) * CHART_H, v > 0 ? 2 : 0);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} style={{ position: 'relative', userSelect: 'none' }}>
      <svg width={width} height={totalH} style={{ display: 'block', overflow: 'visible' }}>

        {/* Gridlines + Y labels */}
        {yTicks.map(t => {
          const y = PAD.t + CHART_H * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={PAD.l + chartW} y1={y} y2={y}
                stroke="var(--border)" strokeDasharray={t === 0 ? 'none' : '3 3'} strokeWidth={t === 0 ? 1.5 : 1}/>
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize={9.5}
                fill="var(--ink-4)" fontFamily="'JetBrains Mono', monospace">
                {inr(maxAmt * t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const h = bh(d.refund_amount || 0);
          const y = by(d.refund_amount || 0);
          const x = bx(i);
          const active = hover === i;
          return (
            <rect
              key={d.month || i}
              x={x} y={y} width={barW} height={h}
              fill={active ? 'var(--red, #C0202A)' : 'var(--red-100, #FECACA)'}
              rx={2}
              style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={`xl-${i}`}
            x={bx(i) + barW / 2}
            y={PAD.t + CHART_H + 16}
            textAnchor="middle"
            fontSize={9}
            fill="var(--ink-4)"
            fontFamily="'JetBrains Mono', monospace"
          >
            {fmtMonth(d.month)}
          </text>
        ))}

      </svg>

      {/* Tooltip */}
      {hover !== null && data[hover] && (() => {
        const d  = data[hover];
        const tx = bx(hover) + barW / 2;
        const ty = by(d.refund_amount || 0);
        const leftPct = (tx / width) * 100;
        return (
          <div style={{
            position: 'absolute',
            top: ty + PAD.t - 8,
            left: `${leftPct}%`,
            transform: `translate(${leftPct > 70 ? '-100%' : leftPct < 30 ? '0%' : '-50%'}, -100%)`,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '6px 10px',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 20,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{fmtMonth(d.month)}</div>
            <div style={{ color: 'var(--red, #C0202A)' }}>{inr(d.refund_amount || 0)} refunded</div>
            <div style={{ color: 'var(--ink-4)', fontSize: 10 }}>{d.refund_count || 0} refund{d.refund_count !== 1 ? 's' : ''}</div>
          </div>
        );
      })()}
    </div>
  );
}
