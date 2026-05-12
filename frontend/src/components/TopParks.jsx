'use client';
import { useState } from 'react';
import { Section, useResize } from './Primitives';
import { Delta } from './Primitives';
import { inr, num } from '../lib/format';

const METRICS    = ['Revenue', 'Tickets', 'Footfall', 'Activities', 'F&B'];
const TREND_DELTAS = [4.8, -1.2, 6.4, 2.1, -3.6];

function TopParksPanel({ topParks }) {
  const [tab, setTab] = useState('Revenue');
  const list = topParks[tab] || [];
  const max  = Math.max(...list.map(x => x.value));
  const fmt  = ['Revenue','Activities','F&B'].includes(tab) ? inr : num;

  return (
    <Section
      title="Top Performing Parks"
      sub={`top 5 by ${tab.toLowerCase()}`}
      actions={
        <div className="tabs">
          {METRICS.map(m => (
            <button key={m} className={tab === m ? 'on' : ''} onClick={() => setTab(m)}>{m}</button>
          ))}
        </div>
      }
    >
      <div>
        {list.map((row, i) => (
          <div key={row.parkId} className={'park-row' + (i === 0 ? ' top1' : '')}>
            <div className="park-rank">{i + 1}</div>
            <div style={{ minWidth: 0 }}>
              <div className="park-name">{row.name}</div>
              <div className="park-loc">{row.city} · {row.state}</div>
              <div className="park-bar">
                <div style={{ width: (row.value / max * 100) + '%', background: row.color }}/>
              </div>
            </div>
            <Delta value={TREND_DELTAS[i]}/>
            <div className="park-val">{fmt(row.value)}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function RevenueTrendChart({ trendData }) {
  const [ref, size]  = useResize();
  const [hover, setHover] = useState(null);
  const [mode, setMode]   = useState('Chart');
  const { months, parks } = trendData;
  const w      = Math.max(size.w, 380);
  const h      = 280;
  const pad    = { l: 52, r: 12, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n      = months.length;
  const xStep  = innerW / (n - 1);
  const max    = Math.max(...parks.flatMap(s => s.series));
  const yAt    = v => pad.t + innerH - (v / max) * innerH;
  const xAt    = i => pad.l + i * xStep;

  if (mode === 'Table') {
    return (
      <Section
        title="6-Month Revenue Trend"
        sub="by park · Dec — May"
        actions={<div className="toggle-group"><button onClick={() => setMode('Chart')}>Chart</button><button className="on">Table</button></div>}
      >
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em' }}>Park</th>
                {months.map(m => <th key={m} style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600, color: 'var(--ink-4)', textTransform: 'uppercase', fontSize: 10 }}>{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {parks.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 600 }}>
                    <span className="dot" style={{ background: row.color }}/>{row.name}
                  </td>
                  {row.series.map((v, j) => (
                    <td key={j} style={{ textAlign: 'right', padding: '8px 4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {inr(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title="6-Month Revenue Trend"
      sub="by park · Dec — May"
      actions={
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginRight: 8, flexWrap: 'wrap' }}>
            {parks.map(p => (
              <span key={p.parkId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--ink-3)' }}>
                <span className="dot" style={{ background: p.color }}/>{p.name.split(' ')[0]}
              </span>
            ))}
          </div>
          <div className="toggle-group">
            <button className="on">Chart</button>
            <button onClick={() => setMode('Table')}>Table</button>
          </div>
        </>
      }
    >
      <div ref={ref} className="chart-area">
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"
          onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            let idx = Math.round((e.clientX - rect.left - pad.l) / xStep);
            idx = Math.max(0, Math.min(n - 1, idx));
            setHover(idx);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[0,0.25,0.5,0.75,1].map((t,i) => <line key={i} x1={pad.l} x2={pad.l+innerW} y1={pad.t+innerH*(1-t)} y2={pad.t+innerH*(1-t)} stroke="#EEF0F3"/>)}
          {[0,0.5,1].map((t,i) => (
            <text key={i} x={pad.l-8} y={pad.t+innerH*(1-t)+3} fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
              {inr(max*t)}
            </text>
          ))}
          {months.map((m, i) => (
            <text key={i} x={xAt(i)} y={pad.t+innerH+16} fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{m}</text>
          ))}
          {parks.map((s, si) => {
            const d    = s.series.map((v,i) => (i===0?'M':'L') + xAt(i) + ' ' + yAt(v)).join(' ');
            const area = d + ` L ${xAt(n-1)} ${pad.t+innerH} L ${pad.l} ${pad.t+innerH} Z`;
            return (
              <g key={si}>
                {si === 0 && (
                  <>
                    <defs>
                      <linearGradient id={'rt'+si} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%"   stopColor={s.color} stopOpacity="0.12"/>
                        <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d={area} fill={`url(#rt${si})`}/>
                  </>
                )}
                <path d={d} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                {s.series.map((v,i) => <circle key={i} cx={xAt(i)} cy={yAt(v)} r="2.5" fill="#fff" stroke={s.color} strokeWidth="1.6"/>)}
              </g>
            );
          })}
          {hover != null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t+innerH} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3"/>
          )}
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: xAt(hover) * ((size.w || w) / w), top: 60 }}>
            <div className="t-title">{months[hover]} 2026</div>
            {parks.map((s, i) => (
              <div className="t-row" key={i}>
                <span className="swatch" style={{ background: s.color }}/>{s.name.split(' ')[0]}: {inr(s.series[hover])}
              </div>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

export default function TopParksRow({ topParks, trendData }) {
  if (!topParks || !trendData) return null;
  return (
    <div className="grid-12">
      <div className="col-6"><TopParksPanel topParks={topParks}/></div>
      <div className="col-6"><RevenueTrendChart trendData={trendData}/></div>
    </div>
  );
}
