'use client';
import { useState } from 'react';
import { useResize } from './Primitives';

const PAD = { l: 54, r: 22, t: 24, b: 34 };

function catmullRom(pts, tension = 0.32) {
  if (!pts || pts.length < 2) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension;
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension;
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension;
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp  = Math.pow(10, Math.floor(Math.log10(v)));
  const frac = v / exp;
  const n    = frac <= 1.5 ? 1.5 : frac <= 3 ? 3 : frac <= 7 ? 7 : 10;
  return n * exp;
}

const gid = color => 'tac_' + color.replace(/[^a-zA-Z0-9]/g, '').slice(0, 14);

export default function TrendAreaChart({
  series = [],
  xLabels = [],
  height = 220,
  dualAxis = false,
  formatLeft  = v => Number(v).toLocaleString('en-IN'),
  formatRight = v => Number(v).toLocaleString('en-IN'),
  leftLabel  = '',
  rightLabel = '',
}) {
  const [hover, setHover] = useState(null);
  const [ref, size] = useResize();

  const w = Math.max(size.w || 600, 200);
  const h = height;
  const iW = w - PAD.l - PAD.r;
  const iH = h - PAD.t - PAD.b;
  const n  = Math.min(xLabels.length, ...series.map(s => s.data?.length ?? 0), xLabels.length);

  const xAt   = i => PAD.l + (n > 1 ? i / (n - 1) : 0.5) * iW;
  const baseY = PAD.t + iH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const maxXLbls = Math.max(2, Math.floor(iW / 54));
  const xStep    = n <= maxXLbls ? 1 : Math.ceil(n / maxXLbls);

  const prepared = series.map((s, si) => {
    const vals  = (s.data || []).slice(0, n);
    const maxRaw = Math.max(...vals.filter(v => isFinite(v) && v >= 0), 0);
    const maxY   = niceMax(maxRaw);
    const useR   = dualAxis && si > 0;
    const yAt    = v => PAD.t + iH - (maxY > 0 ? Math.min(v / maxY, 1) * iH : 0);
    const pts    = vals.map((v, i) => [xAt(i), yAt(v)]);
    const line   = catmullRom(pts);
    const area   = line + ` L ${xAt(n - 1).toFixed(1)} ${baseY} L ${xAt(0).toFixed(1)} ${baseY} Z`;
    return { ...s, vals, maxY, yAt, pts, line, area, useR };
  });

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px   = (e.clientX - rect.left) * (w / (size.w || w));
    const span = n > 1 ? iW / (n - 1) : iW;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px - PAD.l) / span))));
  }

  if (n < 2 || series.length === 0) {
    return (
      <div ref={ref} style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>No trend data for this period</span>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', height }}>
      <svg
        width={size.w || w} height={h}
        viewBox={`0 0 ${w} ${h}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          {prepared.map(s => (
            <linearGradient key={s.label} id={gid(s.color)} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor={s.color} stopOpacity="0.20"/>
              <stop offset="70%"  stopColor={s.color} stopOpacity="0.05"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i}
            x1={PAD.l} x2={PAD.l + iW}
            y1={PAD.t + iH * (1 - t)} y2={PAD.t + iH * (1 - t)}
            stroke={i === 0 ? 'var(--border)' : '#EDEEF2'} strokeWidth="1"
          />
        ))}

        {/* Left Y labels */}
        {yTicks.map((t, i) => (
          <text key={i}
            x={PAD.l - 8} y={PAD.t + iH * (1 - t) + 4}
            fontSize="10" fill="var(--ink-4)" textAnchor="end"
            fontFamily="'JetBrains Mono', monospace">
            {t === 0 ? '0' : formatLeft(prepared[0].maxY * t)}
          </text>
        ))}

        {/* Right Y labels */}
        {dualAxis && prepared[1] && yTicks.map((t, i) => (
          <text key={i}
            x={PAD.l + iW + 8} y={PAD.t + iH * (1 - t) + 4}
            fontSize="10" fill={prepared[1].color} textAnchor="start" opacity="0.75"
            fontFamily="'JetBrains Mono', monospace">
            {t === 0 ? '0' : formatRight(prepared[1].maxY * t)}
          </text>
        ))}

        {/* Axis labels */}
        {leftLabel && (
          <text x={PAD.l - 6} y={PAD.t - 10}
            fontSize="9" fill="var(--ink-4)" fontWeight="700" letterSpacing="0.07em" textAnchor="end">{leftLabel.toUpperCase()}
          </text>
        )}
        {rightLabel && dualAxis && prepared[1] && (
          <text x={PAD.l + iW + 8} y={PAD.t - 10}
            fontSize="9" fill={prepared[1].color} fontWeight="700" letterSpacing="0.07em" opacity="0.75">{rightLabel.toUpperCase()}
          </text>
        )}

        {/* Area fills (back to front) */}
        {prepared.map(s => (
          <path key={s.label + '_a'} d={s.area} fill={`url(#${gid(s.color)})`}/>
        ))}

        {/* Lines */}
        {prepared.map(s => (
          <path key={s.label + '_l'} d={s.line}
            fill="none" stroke={s.color}
            strokeWidth={s.dashed ? 1.8 : 2.5}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            strokeLinecap="round" strokeLinejoin="round"
          />
        ))}

        {/* Baseline */}
        <line x1={PAD.l} x2={PAD.l + iW} y1={baseY} y2={baseY} stroke="var(--border)"/>

        {/* X labels */}
        {xLabels.slice(0, n).map((lbl, i) => i % xStep === 0 && (
          <text key={i} x={xAt(i)} y={baseY + 17}
            fontSize="10" fill="var(--ink-4)" textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace">
            {lbl}
          </text>
        ))}

        {/* Hover crosshair + dots */}
        {hover != null && (
          <>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.t} y2={baseY}
              stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>
            {prepared.map(s => s.pts[hover] && (
              <circle key={s.label}
                cx={xAt(hover)} cy={s.pts[hover][1]}
                r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.5"/>
            ))}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hover != null && (() => {
        const rawX = (xAt(hover) / w) * (size.w || w);
        const safeX = Math.max(60, Math.min(rawX, (size.w || w) - 60));
        return (
          <div className="tooltip" style={{ left: safeX, top: PAD.t + 8, pointerEvents: 'none' }}>
            <div className="t-title">{xLabels[hover]}</div>
            {prepared.map(s => (
              <div key={s.label} className="t-row">
                <span className="swatch" style={{ background: s.color, opacity: s.dashed ? 0.8 : 1 }}/>
                {(s.formatY || (s.useR ? formatRight : formatLeft))(s.vals[hover] ?? 0)} {s.label}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
