'use client';
import { useState } from 'react';
import { Section, useResize } from './Primitives';
import { num, inr } from '../lib/format';

const FF_COLOR  = '#1D9E75';
const REV_COLOR = '#EF9F27';

export default function HourlyChart({ data, appliedFilters }) {
  const [ref, size] = useResize();
  const [hover, setHover] = useState(null);

  if (!data) return null;

  const { mode = 'hourly', labels = [], footfall = [], revenue = [] } = data;
  const { range, date, park, state, cities } = appliedFilters || {};

  const isLong = ['Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months'].includes(range);
  const grain  = mode === 'hourly' ? 'Hourly' : (isLong ? 'Weekly' : 'Daily');
  const title  = mode === 'hourly' ? 'Hourly Footfall × Revenue' : 'Footfall Trend';
  const sub    = `${grain} trend`;

  // Park context chip
  const parkChip = (() => {
    if (park && park !== 'All Parks') return park;
    if (state && state !== 'All States' && (!cities || cities.length === 0)) return `All · ${state}`;
    if (cities && cities.length === 1) return cities[0];
    if (cities && cities.length > 1) return `${cities.length} cities`;
    return 'All Parks';
  })();

  // Date range chip
  const dateChip = (() => {
    if (mode === 'hourly') {
      if (!date) return null;
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (labels.length < 2) return null;
    return `${labels[0]} – ${labels[labels.length - 1]}`;
  })();

  const empty = (
    <Section title={title} sub={sub} padded={false}>
      <div style={{ height: 240, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for selected filters</div>
      </div>
    </Section>
  );

  if (labels.length < 2) return empty;

  const n      = labels.length;
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

  const peakIdx = footfall.indexOf(Math.max(...footfall));
  const peakX   = xAt(peakIdx);
  const badgeX  = Math.max(pad.l + 50, Math.min(peakX, pad.l + innerW - 50));
  const gridY   = [0, 0.25, 0.5, 0.75, 1].map(t => pad.t + innerH * (1 - t));

  const barW    = Math.min(xStep * 0.55, 32);
  const revPath = revenue.map((v, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yRev(v).toFixed(1)).join(' ');

  const maxXLabels = Math.floor(innerW / 44);
  const xLabelStep = n <= maxXLabels ? 1 : Math.ceil(n / maxXLabels);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    let idx    = Math.round((x - pad.l) / xStep);
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  }

  const actions = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ width: 12, height: 2, background: FF_COLOR, display: 'inline-block', borderRadius: 1 }}/>Footfall
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-3)' }}>
        <span style={{ width: 12, height: 2, borderTop: `2px dashed ${REV_COLOR}`, display: 'inline-block' }}/>Revenue
      </span>
    </div>
  );

  return (
    <Section title={title} sub={sub} padded={false} actions={actions}>

      {/* Context strip */}
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="tag" style={{ fontSize: 11 }}>{parkChip}</span>
        {dateChip && <span className="tag" style={{ fontSize: 11 }}>{dateChip}</span>}
        <span className="tag" style={{ fontSize: 11 }}>{n} {grain === 'Hourly' ? 'hours' : grain === 'Weekly' ? 'weeks' : 'days'}</span>
      </div>

      {/* Chart */}
      <div ref={ref} className="chart-area" style={{ padding: '12px 4px 4px' }}>
        <svg width={size.w || w} height={h} viewBox={`0 0 ${w} ${h}`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}>

          {gridY.map((y, i) => (
            <line key={i} x1={pad.l} x2={pad.l + innerW} y1={y} y2={y} stroke="#F0F2F5" strokeWidth="1"/>
          ))}

          <line x1={peakX} x2={peakX} y1={pad.t} y2={pad.t + innerH}
            stroke={REV_COLOR} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"/>

          <g transform={`translate(${badgeX}, ${pad.t - 6})`}>
            <rect x="-48" y="-16" width="96" height="18" rx="9" fill={REV_COLOR}/>
            <text x="0" y="-3" textAnchor="middle" fill="#fff"
              fontSize="11" fontWeight="500" fontFamily="'JetBrains Mono', monospace">
              PEAK · {labels[peakIdx]}
            </text>
          </g>

          {footfall.map((v, i) => (
            <rect key={i}
              x={(xAt(i) - barW / 2).toFixed(1)}
              y={yFF(v).toFixed(1)}
              width={barW.toFixed(1)}
              height={(pad.t + innerH - yFF(v)).toFixed(1)}
              fill={FF_COLOR}
              opacity={hover != null && hover !== i ? 0.55 : 1}
              rx="2"
              style={{ transition: 'opacity .12s' }}
            />
          ))}

          <path d={revPath} fill="none" stroke={REV_COLOR} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>

          <line x1={pad.l} x2={pad.l + innerW} y1={pad.t + innerH} y2={pad.t + innerH} stroke="var(--border)"/>

          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <text key={i} x={pad.l - 8} y={pad.t + innerH * (1 - t) + 4}
              fontSize="11" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
              {Math.round(maxFF * t)}
            </text>
          ))}

          {[0, 0.5, 1].map((t, i) => (
            <text key={i} x={pad.l + innerW + 8} y={pad.t + innerH * (1 - t) + 4}
              fontSize="11" fill="var(--ink-4)" textAnchor="start" fontFamily="'JetBrains Mono', monospace">
              {inr(maxRev * t)}
            </text>
          ))}

          <text x={pad.l - 4} y={pad.t - 10} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em" textAnchor="end">VISITORS</text>
          <text x={pad.l + innerW + 8} y={pad.t - 10} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em">REVENUE</text>

          {labels.map((lbl, i) => i % xLabelStep === 0 && (
            <text key={i} x={xAt(i)} y={pad.t + innerH + 16}
              fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
              {lbl}
            </text>
          ))}

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
            <div className="t-title">{labels[hover]}</div>
            <div className="t-row"><span className="swatch" style={{ background: FF_COLOR }}/>{num(footfall[hover])} visitors</div>
            <div className="t-row"><span className="swatch" style={{ background: REV_COLOR }}/>{inr(revenue[hover])} revenue</div>
          </div>
        )}
      </div>
    </Section>
  );
}
