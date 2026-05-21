'use client';
import { useState } from 'react';
import Icon from './Icon';
import { inr, prevPeriodLabel, downloadCSV } from '../lib/format';
import { Delta } from './Primitives';

const pct = (curr, prev) => prev > 0 ? parseFloat(((curr - prev) / prev * 100).toFixed(1)) : null;

export default function RevenueBarCard({ title, items = [], colorMap = {}, compare = false, range = '', date = '', dateEnd = '' }) {
  const [tableView, setTableView] = useState(false);
  const mapped = items.filter(i => i.value > 0).map(i => ({ ...i, color: colorMap[i.name] || i.color }));
  const total  = mapped.reduce((s, i) => s + i.value, 0);
  const maxVal = mapped.reduce((m, i) => Math.max(m, i.value), 0);

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
        <div className="sec-title">{title}</div>
        {compare && <div className="sec-sub" style={{ marginLeft: 0 }}>{prevPeriodLabel(range, date, dateEnd)}</div>}
        <div className="sec-actions">
          <button className="btn btn-sm icon-btn" title={tableView ? 'Chart view' : 'Table view'} onClick={() => setTableView(v => !v)}>
            <Icon name={tableView ? 'chart' : 'table'} size={13}/>
          </button>
          <button className="btn btn-sm icon-btn" title="Download CSV" onClick={handleExport} disabled={!mapped.length}>
            <Icon name="download" size={13}/>
          </button>
        </div>
      </div>
      <div className="sec-body">
        {!mapped.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mapped.map(i => {
              const delta    = (compare && i.prevValue != null) ? pct(i.value, i.prevValue) : null;
              const barPct   = maxVal > 0 ? (i.value / maxVal) * 100 : 0;
              const sharePct = total  > 0 ? ((i.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={i.name}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.color, flexShrink: 0, display: 'inline-block' }}/>
                      {i.name === 'Others' ? 'Split' : i.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>{inr(i.value)}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-4)', width: 36, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{sharePct}%</span>
                      {delta != null && <Delta value={delta}/>}
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: i.color, borderRadius: 4, transition: 'width .4s cubic-bezier(.2,.8,.2,1)' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
