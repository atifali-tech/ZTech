'use client';
import { Section, useResize } from './Primitives';
import { inr } from '../lib/format';
import Icon from './Icon';

function QvQChart({ qvq }) {
  const [ref, size] = useResize();
  const w      = Math.max(size.w, 380);
  const h      = 240;
  const pad    = { l: 56, r: 12, t: 16, b: 30 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n      = qvq.length;
  const groupW = innerW / n;
  const barW   = Math.min(28, groupW * 0.34);
  const max    = Math.max(...qvq.flatMap(d => [d.curr, d.prev]));
  const yAt    = v => pad.t + innerH - (v / max) * innerH;

  return (
    <div ref={ref} className="chart-area">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {[0,0.25,0.5,0.75,1].map((t,i) => <line key={i} x1={pad.l} x2={pad.l+innerW} y1={pad.t+innerH*(1-t)} y2={pad.t+innerH*(1-t)} stroke="#EEF0F3"/>)}
        {[0,0.5,1].map((t,i) => (
          <text key={i} x={pad.l-8} y={pad.t+innerH*(1-t)+3} fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {inr(max*t)}
          </text>
        ))}
        {qvq.map((d, i) => {
          const cx     = pad.l + i * groupW + groupW / 2;
          const x1     = cx - barW - 1;
          const x2     = cx + 1;
          const change = ((d.curr - d.prev) / d.prev) * 100;
          return (
            <g key={i}>
              <rect x={x2} y={yAt(d.prev)} width={barW} height={pad.t+innerH-yAt(d.prev)} fill="#E0E3EB" rx="2"/>
              <rect x={x1} y={yAt(d.curr)} width={barW} height={pad.t+innerH-yAt(d.curr)} fill="#0E7C66" rx="2"/>
              <text x={cx} y={yAt(d.curr)-4} fontSize="9.5" fill={change>=0?'var(--good)':'var(--bad)'} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                {change>=0?'+':''}{change.toFixed(1)}%
              </text>
              <text x={cx} y={pad.t+innerH+15} fontSize="11" fill="var(--ink-2)" textAnchor="middle" fontWeight="600">{d.q}</text>
              <text x={cx} y={pad.t+innerH+27} fontSize="9"  fill="var(--ink-4)" textAnchor="middle">FY26 vs FY25</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function YvYChart({ yvy }) {
  const [ref, size] = useResize();
  const w      = Math.max(size.w, 380);
  const h      = 240;
  const pad    = { l: 56, r: 12, t: 16, b: 30 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n      = yvy.length;
  const groupW = innerW / n;
  const barW   = Math.min(11, groupW * 0.32);
  const max    = Math.max(...yvy.flatMap(d => [d.curr, d.prev]));
  const yAt    = v => pad.t + innerH - (v / max) * innerH;

  return (
    <div ref={ref} className="chart-area">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {[0,0.25,0.5,0.75,1].map((t,i) => <line key={i} x1={pad.l} x2={pad.l+innerW} y1={pad.t+innerH*(1-t)} y2={pad.t+innerH*(1-t)} stroke="#EEF0F3"/>)}
        {[0,0.5,1].map((t,i) => (
          <text key={i} x={pad.l-8} y={pad.t+innerH*(1-t)+3} fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {inr(max*t)}
          </text>
        ))}
        {yvy.map((d, i) => {
          const cx     = pad.l + i * groupW + groupW / 2;
          const x1     = cx - barW - 1;
          const x2     = cx + 1;
          const change = ((d.curr - d.prev) / d.prev) * 100;
          return (
            <g key={i}>
              <rect x={x2} y={yAt(d.prev)} width={barW} height={pad.t+innerH-yAt(d.prev)} fill="#E0E3EB" rx="1.5"/>
              <rect x={x1} y={yAt(d.curr)} width={barW} height={pad.t+innerH-yAt(d.curr)} fill="#5A6BCF" rx="1.5"/>
              {i%2===0 && (
                <text x={cx} y={yAt(d.curr)-4} fontSize="8.5" fill={change>=0?'var(--good)':'var(--bad)'} textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                  +{change.toFixed(0)}%
                </text>
              )}
              <text x={cx} y={pad.t+innerH+15} fontSize="9.5" fill="var(--ink-3)" textAnchor="middle">{d.m}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Comparative({ data, visible }) {
  if (!visible) {
    return (
      <Section
        title="Comparative Analytics"
        sub="quarter & year comparisons"
        actions={<span className="tag amber">Quarterly / Yearly mode</span>}
      >
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Icon name="info" size={14} color="var(--ink-4)"/>
          Switch the date range to <b style={{ color: 'var(--ink-2)', fontWeight: 600, margin: '0 4px' }}>This Quarter</b> or <b style={{ color: 'var(--ink-2)', fontWeight: 600, margin: '0 4px' }}>This Year</b> to unlock quarter-vs-quarter and year-vs-year comparisons.
        </div>
      </Section>
    );
  }

  if (!data) return null;

  return (
    <div className="grid-12">
      <div className="col-6">
        <Section
          title="Quarter vs Quarter Revenue"
          sub="FY26 vs FY25"
          actions={
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
              <span><span className="dot" style={{ background: '#0E7C66' }}/>FY26</span>
              <span><span className="dot" style={{ background: '#E0E3EB' }}/>FY25</span>
            </span>
          }
        >
          <QvQChart qvq={data.qvq}/>
        </Section>
      </div>
      <div className="col-6">
        <Section
          title="Year vs Last Year Revenue"
          sub="monthly · 2026 vs 2025"
          actions={
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 11, color: 'var(--ink-3)' }}>
              <span><span className="dot" style={{ background: '#5A6BCF' }}/>2026</span>
              <span><span className="dot" style={{ background: '#E0E3EB' }}/>2025</span>
            </span>
          }
        >
          <YvYChart yvy={data.yvy}/>
        </Section>
      </div>
    </div>
  );
}
