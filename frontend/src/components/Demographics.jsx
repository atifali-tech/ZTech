'use client';
import Icon from './Icon';
import { num } from '../lib/format';

function DemoTile({ d }) {
  const mPct = (d.m / d.total) * 100;
  const fPct = (d.f / d.total) * 100;
  const oPct = (d.o / d.total) * 100;
  return (
    <div className="demo-tile">
      <div className="demo-head">
        <div className="demo-icon"><Icon name={d.icon} size={14}/></div>
        <div className="demo-name">{d.name}</div>
        <div className="demo-pct">{d.pct.toFixed(1)}%</div>
      </div>
      <div className="demo-count tnum">{num(d.total)}</div>
      <div className="stack-bar">
        <div style={{ width: mPct + '%', background: '#0E7C66' }}/>
        <div style={{ width: fPct + '%', background: '#5A6BCF' }}/>
        <div style={{ width: oPct + '%', background: '#D89614' }}/>
      </div>
      <div className="demo-split">
        <span><span className="swatch" style={{ background: '#0E7C66' }}/>M {num(d.m)}</span>
        <span><span className="swatch" style={{ background: '#5A6BCF' }}/>F {num(d.f)}</span>
        <span><span className="swatch" style={{ background: '#D89614' }}/>O {num(d.o)}</span>
      </div>
    </div>
  );
}

function DemoSummaryTile({ demos }) {
  const colors = ['#0E7C66', '#5A6BCF', '#D89614', '#8C5BB3'];
  const data   = demos.map((d, i) => ({ name: d.name, value: d.total, color: colors[i] }));
  const sum    = data.reduce((s, d) => s + d.value, 0);
  const r = 28, thickness = 10, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="demo-tile" style={{ background: 'linear-gradient(180deg, #FAFBFC, #FFF)' }}>
      <div className="demo-head">
        <div className="demo-icon" style={{ background: 'var(--teal-50)', borderColor: 'var(--teal-100)', color: 'var(--teal)' }}>
          <Icon name="chart" size={14}/>
        </div>
        <div className="demo-name">Summary</div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F2F5" strokeWidth={thickness}/>
          {data.map((d, i) => {
            const len  = (d.value / sum) * circ;
            const dash = `${len} ${circ - len}`;
            const off  = -acc;
            acc += len;
            return (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={d.color} strokeWidth={thickness}
                strokeDasharray={dash} strokeDashoffset={off}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em">TOTAL</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="13" fill="var(--ink)" fontWeight="600" fontFamily="'JetBrains Mono', monospace">{num(sum)}</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5 }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="swatch" style={{ background: d.color, width: 6, height: 6, borderRadius: 1, display: 'inline-block' }}/>
              <span style={{ color: 'var(--ink-3)' }}>{d.name}</span>
              <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600, marginLeft: 'auto' }}>
                {((d.value / sum) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DemographicsSection({ data, headerExtra = null }) {
  if (!data) return null;
  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-head-main">
          <div className="sec-title">Demographics</div>
          <div className="sec-sub">{num(data.total)} visitors · split by age &amp; gender</div>
        </div>
        <div className="sec-actions"><span className="tag">Snapshot · today</span>{headerExtra}</div>
      </div>
      <div className="demo-grid">
        {data.demographics.map(d => <DemoTile key={d.id} d={d}/>)}
        <DemoSummaryTile demos={data.demographics}/>
      </div>
    </div>
  );
}
