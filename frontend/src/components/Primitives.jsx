'use client';
import { useRef, useState, useEffect } from 'react';

// Sparkline — mini area + line chart
export function Sparkline({ data, color = '#0E7C66', width = 130, height = 40 }) {
  if (!data || data.length === 0) return null;
  const min   = Math.min(...data);
  const max   = Math.max(...data);
  const range = max - min || 1;
  const step  = width / (data.length - 1);
  const pts   = data.map((v, i) => [i * step, height - 4 - ((v - min) / range) * (height - 8)]);
  const d     = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area  = d + ` L ${width} ${height} L 0 ${height} Z`;
  const gid   = 'sp_' + color.replace('#', '');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color}/>
    </svg>
  );
}

// Delta badge (+/- percentage)
export function Delta({ value, suffix = '%' }) {
  const up = value >= 0;
  return (
    <span className={'delta ' + (up ? 'up' : 'down')}>
      <svg width="9" height="9" viewBox="0 0 9 9">
        <path d={up ? 'M4.5 1L8 6H1L4.5 1z' : 'M4.5 8L1 3h7L4.5 8z'} fill="currentColor"/>
      </svg>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

// Card section wrapper
export function Section({ title, sub, actions, children, padded = true }) {
  return (
    <div className="sec">
      {(title || actions) && (
        <div className="sec-head">
          {title && <div className="sec-title">{title}</div>}
          {sub   && <div className="sec-sub">{sub}</div>}
          {actions && <div className="sec-actions">{actions}</div>}
        </div>
      )}
      {padded ? <div className="sec-body">{children}</div> : children}
    </div>
  );
}

// Donut chart with legend
export function Donut({ data, size = 140, thickness = 22, totalLabel = 'Total', currency = false }) {
  const cx    = size / 2, cy = size / 2;
  const r     = (size - thickness) / 2;
  const circ  = 2 * Math.PI * r;
  const sum   = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const slices = data.map(d => {
    const frac  = sum > 0 ? d.value / sum : 0;
    const len   = frac * circ;
    const dash  = `${len} ${circ - len}`;
    const offset = -acc;
    acc += len;
    return { ...d, frac, dash, offset, isEmpty: d.value === 0 };
  });

  function fmt(n) {
    if (!currency) return Number(n).toLocaleString('en-IN');
    if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
    if (n >= 1000)   return '₹' + Math.round(n / 100) / 10 + 'K';
    return '₹' + n;
  }

  return (
    <div className="donut-wrap" style={{ flexWrap: 'wrap' }}>
      <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F2F5" strokeWidth={thickness}/>
        {sum > 0 && slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={thickness}
            strokeDasharray={s.dash} strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray .5s' }}
          />
        ))}
        <g className="donut-center" style={{ textAnchor: 'middle' }}>
          <text className="total" x={cx} y={cy - 6}>{totalLabel.toUpperCase()}</text>
          <text className="val"   x={cx} y={cy + 12}>{fmt(sum)}</text>
        </g>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div className="row" key={i}>
            <span className="dot" style={{ background: s.isEmpty ? 'transparent' : s.color, border: s.isEmpty ? '1px dashed var(--ink-5)' : '0' }}/>
            <span className="name">{s.name}</span>
            {s.isEmpty
              ? <span className="empty-slice">no data</span>
              : <>
                  <span className="val">{fmt(s.value)}</span>
                  <span className="pct">{(s.frac * 100).toFixed(1)}%</span>
                </>}
          </div>
        ))}
      </div>
    </div>
  );
}

// useResize hook — measures container width for responsive SVG charts
export function useResize() {
  const ref  = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect;
        if (cr.width > 0) setSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
