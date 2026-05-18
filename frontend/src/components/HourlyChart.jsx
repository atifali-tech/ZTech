'use client';
import { useState } from 'react';
import { Section, useResize } from './Primitives';
import { num, inr, formatHour } from '../lib/format';

const FF_COLOR  = '#1D9E75';
const REV_COLOR = '#EF9F27';

export default function HourlyChart({ data, noCard = false, appliedFilters }) {
  const [ref, size] = useResize();
  const [hover, setHover] = useState(null);

  if (!data) return null;

  const { hours = [], footfall = [], revenue = [], isAverage = false } = data;

  function buildSubtitle() {
    const pre = '10 AM — 7 PM';
    if (!isAverage) return `${pre} · today`;
    const { range, date } = appliedFilters || {};
    const mo = date
      ? new Date(date + 'T00:00:00').toLocaleString('en-IN', { month: 'long', year: 'numeric' })
      : '';
    switch (range) {
      case 'Weekly':         return `${pre} · daily avg this week`;
      case 'Monthly':        return `${pre} · daily avg ${mo}`;
      case 'Quarterly':      return `${pre} · daily avg this quarter`;
      case 'Yearly':         return `${pre} · daily avg this year`;
      case 'Last 3 Months':  return `${pre} · daily avg last 3 months`;
      case 'Last 6 Months':  return `${pre} · daily avg last 6 months`;
      case 'Last 12 Months': return `${pre} · daily avg last 12 months`;
      default:               return `${pre} · daily avg`;
    }
  }

  const subtitle = buildSubtitle();

  if (!hours || hours.length < 2) {
    const empty = (
      <div style={{ height: 240, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for selected filters</div>
      </div>
    );
    if (noCard) return empty;
    return (
      <Section title="Hourly Footfall × Revenue" sub={subtitle} padded={false}>{empty}</Section>
    );
  }

  const n      = hours.length;
  const w      = Math.max(size.w, 600);
  const h      = 280;
  const pad    = { l: 50, r: 64, t: 28, b: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xStep  = innerW / Math.max(n - 1, 1);
  const maxFF  = Math.max(...footfall, 1);
  const maxRev = Math.max(...revenue,  1);
  const yFF    = v => pad.t + innerH - (v / maxFF)  * innerH;
  const yRev   = v => pad.t + innerH - (v / maxRev) * innerH;
  const xAt    = i => pad.l + i * xStep;

  const peakIdx  = footfall.indexOf(Math.max(...footfall));
  const peakX    = xAt(peakIdx);
  const badgeX   = Math.max(pad.l + 42, Math.min(peakX, pad.l + innerW - 42));
  const gridY   = [0, 0.25, 0.5, 0.75, 1].map(t => pad.t + innerH * (1 - t));

  const barW    = xStep * 0.55;
  const revPath = revenue.map((v, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yRev(v).toFixed(1)).join(' ');

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    let idx    = Math.round((x - pad.l) / xStep);
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  }

  const actions = (
    <>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginRight: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          <span style={{ width: 14, height: 2, background: FF_COLOR, display: 'inline-block', borderRadius: 1 }}/>Footfall
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)' }}>
          <span style={{ width: 14, height: 2, borderTop: `2px dashed ${REV_COLOR}`, display: 'inline-block' }}/>Revenue
        </span>
      </div>
      <div className="toggle-group"><button className="on">Chart</button><button>Table</button></div>
    </>
  );

  const chartContent = (
    <div ref={ref} className="chart-area" style={{ padding: '12px 4px 4px' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>

        {/* Grid lines */}
        {gridY.map((y, i) => (
          <line key={i} x1={pad.l} x2={pad.l + innerW} y1={y} y2={y} stroke="#F0F2F5" strokeWidth="1"/>
        ))}

        {/* Peak vertical line */}
        <line x1={peakX} x2={peakX} y1={pad.t} y2={pad.t + innerH}
          stroke={REV_COLOR} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>

        {/* PEAK pill badge */}
        <g transform={`translate(${badgeX}, ${pad.t - 6})`}>
          <rect x="-40" y="-16" width="80" height="18" rx="9" fill={REV_COLOR}/>
          <text x="0" y="-3" textAnchor="middle" fill="#fff"
            fontSize="11" fontWeight="500" fontFamily="'JetBrains Mono', monospace">
            PEAK · {formatHour(hours[peakIdx])}
          </text>
        </g>

        {/* Footfall bars */}
        {footfall.map((v, i) => (
          <rect key={i}
            x={(xAt(i) - barW / 2).toFixed(1)}
            y={yFF(v).toFixed(1)}
            width={barW.toFixed(1)}
            height={(pad.t + innerH - yFF(v)).toFixed(1)}
            fill={FF_COLOR}
            opacity={hover != null && hover !== i ? 0.35 : 1}
            rx="2"
            style={{ transition: 'opacity .12s' }}
          />
        ))}

        {/* Revenue line */}
        <path d={revPath} fill="none" stroke={REV_COLOR} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>

        {/* X-axis baseline */}
        <line x1={pad.l} x2={pad.l + innerW} y1={pad.t + innerH} y2={pad.t + innerH} stroke="var(--border)"/>

        {/* Left Y-axis labels (footfall) */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <text key={i} x={pad.l - 8} y={pad.t + innerH * (1 - t) + 4}
            fontSize="11" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {Math.round(maxFF * t)}
          </text>
        ))}

        {/* Right Y-axis labels (revenue) */}
        {[0, 0.5, 1].map((t, i) => (
          <text key={i} x={pad.l + innerW + 8} y={pad.t + innerH * (1 - t) + 4}
            fontSize="11" fill="var(--ink-4)" textAnchor="start" fontFamily="'JetBrains Mono', monospace">
            {inr(maxRev * t)}
          </text>
        ))}

        {/* Axis labels */}
        <text x={pad.l - 4} y={pad.t - 10} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em" textAnchor="end">VISITORS</text>
        <text x={pad.l + innerW + 8} y={pad.t - 10} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em">REVENUE</text>

        {/* X-axis hour labels — all 10 slots */}
        {hours.map((hr, i) => (
          <text key={i} x={xAt(i)} y={pad.t + innerH + 16}
            fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
            {formatHour(hr)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hover != null && (
          <g>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t + innerH}
              stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3"/>
            <circle cx={xAt(hover)} cy={yRev(revenue[hover])} r="4" fill="#fff" stroke={REV_COLOR} strokeWidth="2"/>
          </g>
        )}
      </svg>

      {hover != null && (
        <div className="tooltip" style={{ left: xAt(hover) * ((size.w || w) / w), top: 60 }}>
          <div className="t-title">{formatHour(hours[hover])}</div>
          <div className="t-row"><span className="swatch" style={{ background: FF_COLOR }}/>{num(footfall[hover])} visitors</div>
          <div className="t-row"><span className="swatch" style={{ background: REV_COLOR }}/>{inr(revenue[hover])} revenue</div>
        </div>
      )}
    </div>
  );

  if (noCard) {
    return (
      <div>
        <div className="sec-head">
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
              Hourly Footfall × Revenue
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{subtitle}</div>
          </div>
          <div className="sec-actions">{actions}</div>
        </div>
        {chartContent}
      </div>
    );
  }

  return (
    <Section title="Hourly Footfall × Revenue" sub={subtitle} padded={false} actions={actions}>
      {chartContent}
    </Section>
  );
}
