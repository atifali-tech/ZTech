'use client';
import { useState } from 'react';
import Icon from './Icon';
import { inr, num, prevPeriodLabel, downloadCSV } from '../lib/format';
import { Delta } from './Primitives';

const MEDALS = ['🥇', '🥈', '🥉'];

function hexRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function TopPerformingParks({
  parks = [], parkCount = null,
  selectedParks = [],
  dateLabel = '', compare = false, date = '', dateEnd = '',
}) {
  const [sort, setSort] = useState('revenue');
  const [tableView, setTableView] = useState(false);

  const sorted = [...parks].sort((a, b) =>
    sort === 'revenue' ? b.revenue - a.revenue : b.visitors - a.visitors
  );
  const maxVal = sorted.length > 0 ? (sorted[0][sort] || 1) : 1;
  const isFiltered = selectedParks.length > 0;

  const gridCols = compare
    ? '44px 2fr 1fr 1fr 1fr'
    : '44px 2fr 1fr 1fr';

  return (
    <div className="sec">
      {/* Header */}
      <div className="sec-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="sec-title">Top Performing Parks</div>
          {compare && (
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              {prevPeriodLabel(dateLabel, date, dateEnd)}
            </span>
          )}
        </div>
        <div className="sec-actions">
          <button className="btn btn-sm icon-btn" title={tableView ? 'Leaderboard view' : 'Table view'} onClick={() => setTableView(v => !v)}>
            <Icon name={tableView ? 'chart' : 'table'} size={13}/>
          </button>
          <button className="btn btn-sm icon-btn" title="Download CSV" disabled={sorted.length === 0} onClick={() => downloadCSV(
            'top-performing-parks.csv',
            ['Rank', 'Park', 'City', 'Revenue (INR)', 'Visitors', ...(compare ? ['Trend (%)'] : [])],
            sorted.map((p, i) => [
              i + 1, p.name, p.city,
              p.revenue.toFixed(2),
              p.visitors,
              ...(compare ? [(sort === 'revenue' ? p.revenueTrend : p.visitorTrend) ?? ''] : []),
            ])
          )}>
            <Icon name="download" size={13}/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="sec-body" style={{ padding: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, padding: '12px 16px' }}>No data for this period</div>
        ) : tableView ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>#</th>
                <th>Park</th>
                <th>City</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Visitors</th>
                {compare && <th style={{ textAlign: 'right' }}>Trend</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((park, i) => {
                const trend = sort === 'revenue' ? park.revenueTrend : park.visitorTrend;
                return (
                  <tr key={park.parkId}>
                    <td style={{ textAlign: 'center', color: 'var(--ink-4)', fontWeight: 600 }}>
                      {i < 3 ? MEDALS[i] : i + 1}
                    </td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: park.color, flexShrink: 0, display: 'inline-block' }}/>
                        <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{park.name}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink-3)' }}>{park.city}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{inr(park.revenue)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{num(park.visitors)}</td>
                    {compare && (
                      <td style={{ textAlign: 'right' }}>
                        {trend != null ? <Delta value={trend}/> : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <>
            {/* Column headers */}
            <div className="lb-row lb-hdr" style={{ gridTemplateColumns: gridCols }}>
              <span style={{ textAlign: 'center' }}>#</span>
              <span style={{ paddingLeft: 17 }}>Park</span>
              <span style={{ textAlign: 'right' }}>Revenue</span>
              <span style={{ textAlign: 'center' }}>Visitors</span>
              {compare && <span style={{ textAlign: 'right' }}>Trend</span>}
            </div>

            {sorted.map((park, i) => {
              const isSelected = isFiltered && selectedParks.includes(park.name);
              const barPct = (park[sort] / maxVal) * 100;
              const trend  = sort === 'revenue' ? park.revenueTrend : park.visitorTrend;
              return (
                <div
                  key={park.parkId}
                  className="lb-row"
                  style={{
                    gridTemplateColumns: gridCols,
                    borderLeft: isSelected ? `4px solid ${park.color}` : '4px solid transparent',
                    background: isSelected ? hexRgba(park.color, 0.08) : undefined,
                  }}
                >
                  <div className="lb-fill" style={{ width: barPct + '%', background: park.color }}/>
                  <span className="lb-rank">
                    {i < 3
                      ? <span style={{ fontSize: 18, lineHeight: 1 }}>{MEDALS[i]}</span>
                      : <span className="lb-rank-num">{i + 1}</span>}
                  </span>
                  <div className="lb-park">
                    <span className="lb-dot" style={{ background: park.color }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="lb-name" style={{ fontWeight: isSelected ? 700 : 600 }}>{park.name}</div>
                        {isSelected && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                            textTransform: 'uppercase', color: park.color,
                            border: `1px solid ${park.color}`, borderRadius: 3,
                            padding: '1px 4px', flexShrink: 0,
                          }}>Viewing</span>
                        )}
                      </div>
                      <div className="lb-city">{park.city}</div>
                    </div>
                  </div>
                  <span className="lb-val">{inr(park.revenue)}</span>
                  <span className="lb-val" style={{ textAlign: 'center' }}>{num(park.visitors)}</span>
                  {compare && (
                    <span className="lb-trend">
                      {trend != null
                        ? <Delta value={trend}/>
                        : <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
