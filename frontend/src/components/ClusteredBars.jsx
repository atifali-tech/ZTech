'use client';
import { useState } from 'react';
import { useResize } from './Primitives';

export default function ClusteredBars({ data, valueKey1, valueKey2, color1, color2, formatter, height = 240 }) {
  const [ref, size]  = useResize();
  const [hover, setHover] = useState(null);
  const w      = Math.max(size.w, 380);
  const h      = height;
  const pad    = { l: 56, r: 14, t: 14, b: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n      = data.length;
  const groupW = innerW / n;
  const barW   = Math.min(22, groupW * 0.34);
  const max    = Math.max(...data.flatMap(d => [d[valueKey1], d[valueKey2]]));
  const yAt    = v => pad.t + innerH - (v / max) * innerH;

  return (
    <div ref={ref} className="chart-area">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={pad.l} x2={pad.l + innerW} y1={pad.t + innerH * (1 - t)} y2={pad.t + innerH * (1 - t)} stroke="#EEF0F3"/>
        ))}
        {[0, 0.5, 1].map((t, i) => (
          <text key={i} x={pad.l - 8} y={pad.t + innerH * (1 - t) + 3}
            fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
            {formatter(max * t)}
          </text>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + i * groupW + groupW / 2;
          const x1 = cx - barW - 2;
          const x2 = cx + 2;
          const y1 = yAt(d[valueKey1]);
          const y2 = yAt(d[valueKey2]);
          const isHover = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * groupW} y={pad.t} width={groupW} height={innerH} fill="transparent"/>
              <rect x={x1} y={y1} width={barW} height={pad.t + innerH - y1} fill={color1} rx="2" opacity={isHover ? 1 : 0.95}/>
              <rect x={x2} y={y2} width={barW} height={pad.t + innerH - y2} fill={color2} rx="2" opacity={isHover ? 1 : 0.95}/>
              {isHover && (
                <>
                  <text x={x1 + barW / 2} y={y1 - 4} fontSize="9.5" fill="var(--ink)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    {formatter(d[valueKey1])}
                  </text>
                  <text x={x2 + barW / 2} y={y2 - 4} fontSize="9.5" fill="var(--ink)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                    {formatter(d[valueKey2])}
                  </text>
                </>
              )}
              <text x={cx} y={pad.t + innerH + 15} fontSize="10" fill="var(--ink-3)" textAnchor="middle">{d.park.split(' ')[0]}</text>
              <text x={cx} y={pad.t + innerH + 26} fontSize="9"  fill="var(--ink-4)" textAnchor="middle">{d.park.split(' ').slice(1).join(' ')}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
