'use client';
import { useState } from 'react';
import Icon from './Icon';

/**
 * Standard chart section card.
 *
 * Provides:
 *   - Consistent sec-head with title, subtitle, Chart/Table toggle, CSV button
 *   - Loading skeleton (shimmer)
 *   - Empty state (no data)
 *   - Controlled view switching (chart ↔ table)
 *
 * Usage:
 *   <ChartWrapper
 *     title="Weekly Heatmap"
 *     sub="Mon – Sun, 6 AM – 10 PM"
 *     loading={loading}
 *     empty={!heatmap?.data?.length}
 *     chart={<Heatmap data={heatmap}/>}
 *     table={<HeatmapTable data={heatmap}/>}
 *     onCsv={() => csvHeatmap(heatmap)}
 *   />
 */
export default function ChartWrapper({
  title,
  sub,
  loading   = false,
  empty     = false,
  emptyText = 'No data for this period',
  chart,           // React node — shown in chart mode
  table,           // React node — shown in table mode (if absent, no toggle shown)
  onCsv,           // CSV export handler (optional)
  extra,           // Additional header actions (optional)
  noPad  = false,  // Skip sec-body padding (for charts that fill the full card)
}) {
  const [view, setView] = useState('chart');
  const hasToggle = chart && table;

  return (
    <div className="sec">
      <div className="sec-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && <div className="sec-title">{title}</div>}
          {sub   && <div className="sec-sub">{sub}</div>}
        </div>
        <div className="sec-actions">
          {extra}
          {hasToggle && (
            <div className="toggle-group">
              <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>Chart</button>
              <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
            </div>
          )}
          {onCsv && (
            <button className="btn btn-sm" onClick={onCsv}>
              <Icon name="download" size={12}/> CSV
            </button>
          )}
        </div>
      </div>

      <div className={noPad ? undefined : 'sec-body'} style={noPad ? undefined : undefined}>
        {loading ? (
          <div className="chart-skeleton"/>
        ) : empty ? (
          <div className="chart-empty">
            <Icon name="chart" size={22} color="var(--ink-5)"/>
            <span>{emptyText}</span>
          </div>
        ) : (
          view === 'chart' ? chart : table
        )}
      </div>
    </div>
  );
}
