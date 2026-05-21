'use client';
import { useState } from 'react';
import { Section, useResize } from './Primitives';
import { num, inr } from '../lib/format';

const FF_COLOR      = '#16B896';
const FF_LIGHT      = '#D4EDE8';
const REV_COLOR     = '#FF9E3D';
const REV_LIGHT     = '#FFE8D0';
const HOVER_COLOR   = 'rgba(15,19,32,0.08)';
const GRID_COLOR    = 'rgba(15,19,32,0.04)';

export default function HourlyChart({ data, appliedFilters }) {
  const [ref, size] = useResize();
  const [hover, setHover] = useState(null);

  if (!data) return null;

  const { mode = 'hourly', labels = [], footfall = [], revenue = [] } = data;
  const { range, date, parks: selectedParks = [], state, cities } = appliedFilters || {};

  const isLong = ['Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months'].includes(range);
  const grain  = mode === 'hourly' ? 'Hourly' : (isLong ? 'Weekly' : 'Daily');
  const title  = mode === 'hourly' ? 'Hourly Footfall × Revenue' : 'Footfall Trend';
  const sub    = `${grain} trend across ${labels.length} ${grain === 'Hourly' ? 'hours' : grain === 'Weekly' ? 'weeks' : 'days'}`;

  // Park context chip
  const parkChip = (() => {
    if (selectedParks.length === 1) return selectedParks[0];
    if (selectedParks.length > 1)   return `${selectedParks.length} parks`;
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

  // Use measured width or fallback to minimum
  const containerW = size.w > 0 ? size.w : 900;
  const w      = containerW;
  const h      = 300;
  const pad    = { l: 56, r: 72, t: 32, b: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n      = labels.length;
  const xStep  = innerW / Math.max(n - 1, 1);
  const maxFF  = Math.max(...footfall, 1);
  const maxRev = Math.max(...revenue,  1);
  const yFF    = v => pad.t + innerH - (v / maxFF)  * innerH;
  const yRev   = v => pad.t + innerH - (v / maxRev) * innerH;
  const xAt    = i => pad.l + i * xStep;

  const peakIdx = footfall.indexOf(Math.max(...footfall));
  const peakX   = xAt(peakIdx);
  const badgeX  = Math.max(pad.l + 60, Math.min(peakX, pad.l + innerW - 60));
  const gridY   = [0, 0.25, 0.5, 0.75, 1].map(t => pad.t + innerH * (1 - t));

  const barW    = Math.min(xStep * 0.5, 28);
  const revPath = revenue.map((v, i) => (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ' ' + yRev(v).toFixed(1)).join(' ');

  const maxXLabels = Math.floor(innerW / 48);
  const xLabelStep = n <= maxXLabels ? 1 : Math.ceil(n / maxXLabels);

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    let idx    = Math.round((x - pad.l) / xStep);
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  }

  const actions = (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
        <span style={{ width: 14, height: 3, background: FF_COLOR, display: 'inline-block', borderRadius: 1.5 }}/>Visitors
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)', fontWeight: 500 }}>
        <span style={{ width: 14, height: 2, borderTop: `2.5px dashed ${REV_COLOR}`, display: 'inline-block' }}/>Revenue
      </span>
    </div>
  );

  return (
    <Section title={title} sub={sub} padded={false} actions={actions}>

      {/* Context strip */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="tag" style={{ fontSize: 11, fontWeight: 500 }}>{parkChip}</span>
        {dateChip && <span className="tag" style={{ fontSize: 11, fontWeight: 500 }}>{dateChip}</span>}
        <span className="tag" style={{ fontSize: 11, fontWeight: 500, background: 'rgba(16,184,150,0.08)', color: FF_COLOR }}>Peak: {num(Math.max(...footfall))} visitors</span>
      </div>

      {/* Chart */}
      <div ref={ref} className="chart-area" style={{ padding: '16px 0 8px', position: 'relative', width: '100%' }}>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="xMidYMid meet">

          <defs>
            <linearGradient id="ff-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FF_COLOR} stopOpacity="0.8"/>
              <stop offset="100%" stopColor={FF_COLOR} stopOpacity="0.2"/>
            </linearGradient>
          </defs>

          {/* Background hover zone */}
          {hover != null && (
            <rect x={pad.l} y={pad.t} width={innerW} height={innerH}
              fill={HOVER_COLOR} opacity="1" pointerEvents="none"/>
          )}

          {/* Grid lines */}
          {gridY.map((y, i) => (
            <line key={i} x1={pad.l} x2={pad.l + innerW} y1={y} y2={y}
              stroke={GRID_COLOR} strokeWidth="1" vectorEffect="non-scaling-stroke"/>
          ))}

          {/* Y-axis labels (Visitors) */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <text key={i} x={pad.l - 12} y={pad.t + innerH * (1 - t) + 4}
              fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="system-ui" fontWeight="500">
              {Math.round(maxFF * t)}
            </text>
          ))}

          {/* Y-axis label (Revenue) */}
          {[0, 0.5, 1].map((t, i) => (
            <text key={i} x={pad.l + innerW + 12} y={pad.t + innerH * (1 - t) + 4}
              fontSize="10" fill="var(--ink-4)" textAnchor="start" fontFamily="system-ui" fontWeight="500">
              {inr(maxRev * t)}
            </text>
          ))}

          {/* Axis labels */}
          <text x={pad.l - 4} y={pad.t - 14} fontSize="9" fill="var(--ink-5)" fontWeight="700" letterSpacing="0.05em" textAnchor="end">VISITORS</text>
          <text x={pad.l + innerW + 12} y={pad.t - 14} fontSize="9" fill="var(--ink-5)" fontWeight="700" letterSpacing="0.05em">REVENUE</text>

          {/* Baseline */}
          <line x1={pad.l} x2={pad.l + innerW} y1={pad.t + innerH} y2={pad.t + innerH}
            stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke"/>

          {/* Footfall bars with gradient */}
          {footfall.map((v, i) => (
            <g key={'ff-' + i}>
              <rect
                x={(xAt(i) - barW / 2).toFixed(1)}
                y={yFF(v).toFixed(1)}
                width={barW.toFixed(1)}
                height={(pad.t + innerH - yFF(v)).toFixed(1)}
                fill="url(#ff-grad)"
                opacity={hover != null && hover !== i ? 0.4 : 1}
                rx="3"
                style={{ transition: 'opacity .15s ease' }}
                onMouseEnter={() => setHover(i)}
              />
              {hover === i && (
                <rect
                  x={(xAt(i) - barW / 2 - 1).toFixed(1)}
                  y={(yFF(v) - 1).toFixed(1)}
                  width={(barW + 2).toFixed(1)}
                  height={(pad.t + innerH - yFF(v) + 2).toFixed(1)}
                  fill="none"
                  stroke={FF_COLOR}
                  strokeWidth="2"
                  rx="3"
                  pointerEvents="none"
                />
              )}
            </g>
          ))}

          {/* Revenue line with smoother path */}
          <path d={revPath} fill="none" stroke={REV_COLOR} strokeWidth="2.5"
            strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round"/>

          {/* Peak indicator line and badge */}
          <line x1={peakX} x2={peakX} y1={pad.t} y2={pad.t + innerH}
            stroke={REV_COLOR} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.6"/>

          <g transform={`translate(${badgeX}, ${pad.t - 8})`}>
            <rect x="-52" y="-14" width="104" height="20" rx="10"
              fill={REV_COLOR} opacity="0.95" style={{ filter: 'drop-shadow(0 2px 4px rgba(15,19,32,0.1))' }}/>
            <text x="0" y="2" textAnchor="middle" fill="#fff"
              fontSize="11" fontWeight="600" fontFamily="system-ui" letterSpacing="0.02em">
              PEAK · {labels[peakIdx]}
            </text>
          </g>

          {/* X-axis labels */}
          {labels.map((lbl, i) => i % xLabelStep === 0 && (
            <text key={i} x={xAt(i)} y={pad.t + innerH + 20}
              fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontFamily="system-ui">
              {lbl}
            </text>
          ))}

          {/* Hover indicator */}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t + innerH}
                stroke="var(--ink-3)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7"/>
              <circle cx={xAt(hover)} cy={yFF(footfall[hover])} r="5" fill="#fff"
                stroke={FF_COLOR} strokeWidth="2.5" style={{ filter: 'drop-shadow(0 1px 3px rgba(15,19,32,0.12))' }}/>
              <circle cx={xAt(hover)} cy={yRev(revenue[hover])} r="5" fill="#fff"
                stroke={REV_COLOR} strokeWidth="2.5" style={{ filter: 'drop-shadow(0 1px 3px rgba(15,19,32,0.12))' }}/>
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover != null && (
          <div style={{
            position: 'absolute',
            left: `${((pad.l + xStep * hover) / w) * 100}%`,
            top: 16,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              boxShadow: '0 4px 12px rgba(15,19,32,0.12)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6, fontSize: 11, letterSpacing: '0.02em' }}>
                {labels[hover]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 10, height: 2, background: FF_COLOR, borderRadius: 1, flexShrink: 0 }}/>
                  <span style={{ color: 'var(--ink-3)' }}>Visitors:</span>
                  <span style={{ color: FF_COLOR, fontWeight: 600, marginLeft: 'auto' }}>{num(footfall[hover])}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 10, height: 2, borderTop: `1.5px dashed ${REV_COLOR}`, flexShrink: 0 }}/>
                  <span style={{ color: 'var(--ink-3)' }}>Revenue:</span>
                  <span style={{ color: REV_COLOR, fontWeight: 600, marginLeft: 'auto' }}>{inr(revenue[hover])}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
