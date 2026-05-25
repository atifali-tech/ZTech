'use client';
import { useState } from 'react';
import DonutChart from './DonutChart';
import Icon from './Icon';
import { inr, downloadCSV } from '../lib/format';
import { Delta } from './Primitives';

const pct = (curr, prev) => prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;

// Green (#16A34A) is reserved exclusively for Jungle Trail park.
// Category / payment / source colors must not clash with any park color.
const CAT_COLORS = { Tickets: '#0891B2', 'F&B': '#E24B4A', Activities: '#7C3AED', Parking: '#F59E0B' };
const PMT_COLORS = { UPI: '#2563EB', Cash: '#64748B', Card: '#8B5CF6', Others: '#F97316' };
const SRC_COLORS = { Counter: '#0891B2', Web: '#6366F1', App: '#F97316', WhatsApp: '#10B981', 'Unknown Source': '#94A3B8' };

export const COLOR_MAPS = { category: CAT_COLORS, payment: PMT_COLORS, source: SRC_COLORS };

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
  .kdi-inner { display: flex; flex-direction: row; align-items: center; }
  .kdi-chart { flex: 0 0 56%; display: flex; justify-content: center; align-items: center; overflow: hidden; }
  .kdi-legend { flex: 1; min-width: 0; padding-left: 16px; display: flex; flex-direction: column; justify-content: center; }
  .kdi-item { display: flex; align-items: center; gap: 6px; line-height: 1.8; }
  .kdi-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
  .kdi-name { font-size: 13px; color: var(--ink-2); white-space: nowrap; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  @container (max-width: 280px) {
    .kdi-inner  { flex-direction: column; align-items: center; }
    .kdi-chart  { flex: 0 0 auto; overflow: visible; }
    .kdi-legend { width: 100%; padding-left: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
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
          <DonutChart items={mapped} total={total} size={175}/>
        </div>
        <div className="kdi-legend">
          {mapped.slice(0, 7).map(i => (
            <div key={i.name} className="kdi-item">
              <span className="kdi-dot" style={{ background: i.color }}/>
              <span className="kdi-name">{i.name === 'Others' ? 'Split' : i.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const RPC_CSS = `
  .rpc-wrap { container-type: inline-size; }
  .rpc-inner { display: flex; flex-direction: row; align-items: center; }
  .rpc-chart { flex: 0 0 52%; display: flex; justify-content: center; align-items: center; overflow: hidden; }
  .rpc-legend { flex: 1; min-width: 0; padding-left: 20px; }
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
  const [tableView, setTableView] = useState(false);
  const mapped = items.filter(i => i.value > 0).map(i => ({ ...i, color: colorMap[i.name] || i.color }));
  const total  = mapped.reduce((s, i) => s + i.value, 0);

  const colLabel = title.toLowerCase().includes('payment') ? 'Payment Mode' : 'Category';
  const slug     = title.toLowerCase().replace(/\s+/g, '-');

  const handleExport = () => downloadCSV(
    `${slug}.csv`,
    [colLabel, 'Amount (INR)', 'Share (%)'],
    mapped.map(i => [
      i.name === 'Others' ? 'Split' : i.name,
      i.value.toFixed(2),
      total > 0 ? ((i.value / total) * 100).toFixed(1) : '0',
    ])
  );

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-head-main">
          <div className="sec-title">{title}</div>
        </div>
        <div className="sec-actions">
          <button className="btn btn-sm icon-btn" title={tableView ? 'Chart view' : 'Table view'} onClick={() => setTableView(v => !v)}>
            <Icon name={tableView ? 'chart' : 'table'} size={13}/>
          </button>
          <button className="btn btn-sm icon-btn" title="Download CSV" onClick={handleExport} disabled={!mapped.length}>
            <Icon name="download" size={13}/>
          </button>
        </div>
      </div>
      <div className="sec-body" style={{ justifyContent: 'center', padding: tableView ? 0 : undefined }}>
        {!mapped.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, padding: tableView ? 16 : 0 }}>No data for this period</div>
        ) : tableView ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>{colLabel}</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Share</th>
                {compare && <th style={{ textAlign: 'right' }}>vs Prev</th>}
              </tr>
            </thead>
            <tbody>
              {mapped.map(i => {
                const delta = (compare && i.prevValue != null) ? pct(i.value, i.prevValue) : null;
                return (
                  <tr key={i.name}>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.color, flexShrink: 0, display: 'inline-block' }}/>
                        {i.name === 'Others' ? 'Split' : i.name}
                      </span>
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{inr(i.value)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>
                      {total > 0 ? ((i.value / total) * 100).toFixed(1) : 0}%
                    </td>
                    {compare && (
                      <td style={{ textAlign: 'right' }}>
                        {delta != null ? <Delta value={delta}/> : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td style={{ fontWeight: 700, color: 'var(--ink)' }}>Total</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{inr(total)}</td>
                <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-3)' }}>100%</td>
                {compare && <td/>}
              </tr>
            </tfoot>
          </table>
        ) : (
          <div className="rpc-wrap">
            <style>{RPC_CSS}</style>
            <div className="rpc-inner">
              <div className="rpc-chart">
                <DonutChart items={mapped} total={total} size={180}/>
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
