'use client';
import { useState } from 'react';
import { inr, num, prevPeriodLabel } from '../lib/format';
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

  const sorted = [...parks].sort((a, b) =>
    sort === 'revenue' ? b.revenue - a.revenue : b.visitors - a.visitors
  );
  const maxVal = sorted.length > 0 ? (sorted[0][sort] || 1) : 1;
  const isFiltered = selectedParks.length > 0;

  const gridCols = compare
    ? '44px minmax(130px,1fr) 90px 80px 72px'
    : '44px minmax(130px,1fr) 90px 80px';

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
      </div>

      {/* Table */}
      <div className="sec-body" style={{ padding: 0 }}>
        {/* Column headers */}
        <div className="lb-row lb-hdr" style={{ gridTemplateColumns: gridCols }}>
          <span style={{ textAlign: 'center' }}>#</span>
          <span style={{ paddingLeft: 17 }}>Park</span>
          <span>Revenue</span>
          <span>Visitors</span>
          {compare && <span>Trend</span>}
        </div>

        {sorted.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12, padding: '12px 16px' }}>
            No data for this period
          </div>
        ) : sorted.map((park, i) => {
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
              {/* Proportional color fill */}
              <div className="lb-fill" style={{ width: barPct + '%', background: park.color }}/>

              {/* Rank */}
              <span className="lb-rank">
                {i < 3
                  ? <span style={{ fontSize: 18, lineHeight: 1 }}>{MEDALS[i]}</span>
                  : <span className="lb-rank-num">{i + 1}</span>}
              </span>

              {/* Park name + city */}
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

              {/* Revenue */}
              <span className="lb-val">{inr(park.revenue)}</span>

              {/* Visitors */}
              <span className="lb-val">{num(park.visitors)}</span>

              {/* Trend */}
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
      </div>
    </div>
  );
}
