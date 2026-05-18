'use client';
import DonutChart from './DonutChart';
import { inr, prevPeriodLabel } from '../lib/format';
import { Delta } from './Primitives';

const pct = (curr, prev) => prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;

const CAT_COLORS = { Tickets: '#1D9E75', 'F&B': '#E24B4A', Activities: '#378ADD', Parking: '#EF9F27' };
const PMT_COLORS = { UPI: '#378ADD', Cash: '#1D9E75', Card: '#7F77DD', Others: '#EF9F27' };

export const COLOR_MAPS = { category: CAT_COLORS, payment: PMT_COLORS };

// Shared legend row — col1: dot+name | col2: value right-aligned
function PieLegendRow({ label, value, color, formatValue, compact = false }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: compact ? '1fr 52px' : '1fr 72px',
      gap: '0 6px',
      alignItems: 'center',
      padding: compact ? '2px 0' : '4px 0',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }}/>
        <span style={{
          fontSize: 12,
          color: 'var(--ink-2)',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      </span>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--ink)',
        fontFamily: "'JetBrains Mono', monospace",
        textAlign: 'right',
      }}>{formatValue(value)}</span>
    </div>
  );
}

const KDI_CSS = `
  .kdi-wrap { container-type: inline-size; }
  .kdi-inner { display: flex; align-items: flex-start; gap: 8px; }
  .kdi-chart { width: 55%; display: flex; justify-content: flex-start; flex-shrink: 0; }
  .kdi-legend { width: 45%; min-width: 0; }
  .kdi-item { display: flex; align-items: center; gap: 4px; padding: 2px 0; }
  .kdi-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .kdi-name { font-size: 11px; color: var(--ink-2); white-space: nowrap; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .kdi-val  { font-size: 11px; font-weight: 600; color: var(--ink); font-family: 'JetBrains Mono', monospace; white-space: nowrap; flex-shrink: 0; }
  @container (max-width: 280px) {
    .kdi-inner  { flex-direction: column; align-items: center; }
    .kdi-chart  { width: 100%; justify-content: center; }
    .kdi-legend { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
  }
  @container (max-width: 180px) {
    .kdi-legend { display: flex; flex-direction: column; }
    .kdi-chart svg { width: 120px !important; height: 120px !important; }
  }
`;

export function InlinePieBreakdown({ items = [], colorMap = {}, formatValue = inr }) {
  const mapped = items.filter(i => i.value > 0).map(i => ({ ...i, color: colorMap[i.name] || i.color }));
  const total  = mapped.reduce((s, i) => s + i.value, 0);
  if (!mapped.length) return <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>;
  return (
    <div className="kdi-wrap">
      <style>{KDI_CSS}</style>
      <div className="kdi-inner">
        <div className="kdi-chart">
          <DonutChart items={mapped} total={total} size={160}/>
        </div>
        <div className="kdi-legend">
          {mapped.slice(0, 7).map(i => (
            <div key={i.name} className="kdi-item">
              <span className="kdi-dot" style={{ background: i.color }}/>
              <span className="kdi-name" title={i.name === 'Others' ? 'Split' : i.name}>{i.name === 'Others' ? 'Split' : i.name}:</span>
              <span className="kdi-val">{formatValue(i.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const RPC_CSS = `
  .rpc-wrap { container-type: inline-size; }
  .rpc-inner { display: flex; align-items: center; gap: 8px; }
  .rpc-chart { width: 50%; display: flex; justify-content: center; flex-shrink: 0; }
  .rpc-legend { width: 50%; min-width: 0; }
  .rpc-item { display: flex; align-items: center; gap: 4px; padding: 3px 0; }
  .rpc-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .rpc-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  .rpc-name { color: var(--ink-2); }
  .rpc-val  { font-weight: 600; color: var(--ink); font-family: 'JetBrains Mono', monospace; }
  @container (max-width: 400px) {
    .rpc-inner  { flex-direction: column; align-items: center; }
    .rpc-chart  { width: 100%; justify-content: center; }
    .rpc-legend { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
  }
  @container (max-width: 240px) {
    .rpc-legend { display: flex; flex-direction: column; }
    .rpc-chart svg { width: 150px !important; height: 150px !important; }
  }
`;

export default function RevenuePieCard({ title, items = [], colorMap = {}, compare = false, range = '', date = '', dateEnd = '' }) {
  const mapped = items.filter(i => i.value > 0).map(i => ({ ...i, color: colorMap[i.name] || i.color }));
  const total  = mapped.reduce((s, i) => s + i.value, 0);

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-title">{title}</div>
        {compare && <div className="sec-sub" style={{ marginLeft: 0 }}>{prevPeriodLabel(range, date, dateEnd)}</div>}
      </div>
      <div className="sec-body" style={{ justifyContent: 'center' }}>
        {!mapped.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        ) : (
          <div className="rpc-wrap">
            <style>{RPC_CSS}</style>
            <div className="rpc-inner">
              <div className="rpc-chart">
                <DonutChart items={mapped} total={total} size={200}/>
              </div>
              <div className="rpc-legend">
                {mapped.map(i => {
                  const delta = (compare && i.prevValue != null) ? pct(i.value, i.prevValue) : null;
                  return (
                    <div key={i.name} className="rpc-item">
                      <span className="rpc-dot" style={{ background: i.color }}/>
                      <span className="rpc-text" title={i.name === 'Others' ? 'Split' : i.name}>
                        <span className="rpc-name">{i.name === 'Others' ? 'Split' : i.name}: </span>
                        <span className="rpc-val">{inr(i.value)}</span>
                      </span>
                      {delta != null && <Delta value={delta}/>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
