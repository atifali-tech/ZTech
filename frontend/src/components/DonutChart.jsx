'use client';
import { useState } from 'react';
import { inr } from '../lib/format';

function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function piePath(cx, cy, R, start, end) {
  const s  = polar(cx, cy, R, start);
  const e  = polar(cx, cy, R, end);
  const lg = end - start > 180 ? 1 : 0;
  return `M${cx} ${cy} L${s.x} ${s.y} A${R} ${R} 0 ${lg} 1 ${e.x} ${e.y}Z`;
}

export default function DonutChart({ items, total, size = 130 }) {
  const [hovered, setHovered] = useState(null);
  const cx = 60, cy = 60, R = 56, GAP = 1.5;
  const slices = items.filter(i => i.value > 0);

  let angle = 0;
  const sliceData = slices.map(i => {
    const sweep = (i.value / total) * 360 - GAP;
    const start = angle + GAP / 2;
    const end   = start + sweep;
    angle += (i.value / total) * 360;
    return { ...i, d: piePath(cx, cy, R, start, end), pct: Math.round((i.value / total) * 100) };
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" style={{ width: size, height: size }}>
        {slices.length === 1 ? (
          <circle cx={cx} cy={cy} r={R} fill={slices[0].color}
            onMouseEnter={() => setHovered({ ...slices[0], pct: 100 })}
            onMouseLeave={() => setHovered(null)}
          />
        ) : (
          sliceData.map(s => (
            <path
              key={s.name}
              d={s.d}
              fill={s.color}
              opacity={hovered && hovered.name !== s.name ? 0.25 : 1}
              style={{ transition: 'opacity .15s' }}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
            />
          ))
        )}
      </svg>

      {hovered && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.92)', borderRadius: 6,
            padding: '4px 8px', textAlign: 'center',
            boxShadow: '0 1px 6px rgba(0,0,0,.12)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{hovered.pct}%</div>
            <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 1 }}>{hovered.name}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: hovered.color, fontFamily: "'JetBrains Mono', monospace", marginTop: 1 }}>{inr(hovered.value)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
