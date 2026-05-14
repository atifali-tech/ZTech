'use client';
import { useResize } from './Primitives';
import { num, inr } from '../lib/format';

// Static placeholder — park-level daily visitor + revenue API fields not yet available
const PARKS = [
  { name: 'UP Darshan',    color: '#1D9E75', visitors: 22400, revenue: 1186000 },
  { name: 'Harmony',       color: '#E24B4A', visitors: 18200, revenue: 948000  },
  { name: 'Gautam Buddha', color: '#378ADD', visitors: 16100, revenue: 842000  },
  { name: 'Shivalaya',     color: '#EF9F27', visitors: 14200, revenue: 648000  },
  { name: 'Jungle Trail',  color: '#D4537E', visitors: 13100, revenue: 598000  },
  { name: 'Saat Ajoobe',   color: '#7F77DD', visitors: 10200, revenue: 448000  },
  { name: 'World Park',    color: '#34C4C4', visitors:  7100, revenue: 298000  },
];

export default function ParkPerformance() {
  const [ref, { w }] = useResize();
  const width  = w || 400;
  const height = 200;
  const padL = 4, padR = 4, padT = 8, padB = 72;
  const chartW = Math.max(1, width - padL - padR);
  const chartH = height - padT - padB;
  const maxVis = Math.max(...PARKS.map(p => p.visitors));
  const maxRev = Math.max(...PARKS.map(p => p.revenue));
  const groupW = chartW / PARKS.length;
  const bW     = Math.max(3, Math.floor((groupW - 6) / 2));

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">Park Performance</div>
        <div className="sec-actions" style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ink-4)', alignItems: 'center' }}>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg width="8" height="8"><rect width="8" height="8" rx="1" fill="#888"/></svg>
            Visitors
          </span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <svg width="8" height="8"><rect width="8" height="8" rx="1" fill="#888" opacity="0.35"/></svg>
            Revenue
          </span>
          <span className="tag" style={{ fontSize: 9 }}>Static</span>
        </div>
      </div>
      <div className="sec-body" ref={ref}>
        <svg width="100%" height={height} style={{ display: 'block', overflow: 'visible' }}>
          {PARKS.map((p, i) => {
            const cx   = padL + i * groupW + groupW / 2;
            const visH = chartH * (p.visitors / maxVis);
            const revH = chartH * (p.revenue  / maxRev);
            const x1   = cx - bW - 1;
            const x2   = cx + 1;
            const ly   = padT + chartH + 10;
            return (
              <g key={p.name}>
                <rect x={x1} y={padT + chartH - visH} width={bW} height={visH} rx={2} fill={p.color}/>
                <rect x={x2} y={padT + chartH - revH} width={bW} height={revH} rx={2} fill={p.color} opacity={0.35}/>
                <text
                  x={cx} y={ly}
                  textAnchor="end"
                  fill="var(--ink-4)"
                  style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                  transform={`rotate(-45, ${cx}, ${ly})`}
                >
                  {p.name}
                </text>
              </g>
            );
          })}
          <line x1={padL} y1={padT + chartH} x2={width - padR} y2={padT + chartH}
            stroke="var(--border)" strokeWidth={1}/>
        </svg>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 2 }}>
          {PARKS.map(p => (
            <span key={p.name} style={{ fontSize: 9.5, color: p.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {p.name}: {num(p.visitors)} · {inr(p.revenue)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
