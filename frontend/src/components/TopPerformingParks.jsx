'use client';
import Icon from './Icon';
import { inr, downloadCSV } from '../lib/format';
import { Delta } from './Primitives';

// Muted ivory / silver-gray / warm-beige — all very low saturation
const RANK_BG = [
  'rgba(251,243,210,0.55)', // warm ivory (gold)
  'rgba(220,224,230,0.45)', // soft silver-gray
  'rgba(235,220,205,0.50)', // warm beige (bronze)
];
const RANK_BORDER = [
  'rgba(200,165,60,0.45)',
  'rgba(160,170,185,0.45)',
  'rgba(175,135,90,0.40)',
];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

const MIN_BAR = 15; // minimum bar width %

function scaledBar(revenue, maxRev) {
  if (maxRev <= 0) return MIN_BAR;
  const raw = (revenue / maxRev) * 100;
  // Top park stays 100%; all others get at least MIN_BAR
  return raw >= 100 ? 100 : Math.max(MIN_BAR, raw);
}

export default function TopPerformingParks({
  parks = [],
  selectedParks = [],
  compare = false,
}) {
  const sorted = [...parks]
    .filter(p => (p.revenue ?? 0) > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const maxRev = sorted[0]?.revenue || 1;

  return (
    <div className="sec tpp-widget">
      <div className="sec-head">
        <div className="sec-head-main">
          <div className="sec-title">Top Performing Parks</div>
        </div>
        <div className="sec-actions">
          <button
            className="btn btn-sm icon-btn"
            title="Download CSV"
            disabled={sorted.length === 0}
            onClick={() => downloadCSV(
              'top-performing-parks.csv',
              ['Rank', 'Park', 'City', 'Revenue (INR)', ...(compare ? ['Trend (%)'] : [])],
              sorted.map((p, i) => [
                i + 1, p.name, p.city,
                p.revenue.toFixed(2),
                ...(compare ? [p.revenueTrend ?? ''] : []),
              ])
            )}
          >
            <Icon name="download" size={13}/>
          </button>
        </div>
      </div>

      <div className="sec-body tpp-body">
        {sorted.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        ) : sorted.map((park, i) => {
          const barPct = scaledBar(park.revenue, maxRev);
          const trend  = park.revenueTrend ?? null;
          const isTop3 = i < 3;

          return (
            <div
              key={park.parkId || park.name}
              className="tpp-row"
              style={isTop3 ? {
                background: RANK_BG[i],
                borderLeft: `3px solid ${RANK_BORDER[i]}`,
              } : {
                borderLeft: '3px solid transparent',
              }}
            >
              {/* Rank */}
              <div className="tpp-rank">
                {isTop3
                  ? <span className="tpp-medal">{RANK_LABELS[i]}</span>
                  : <span className="tpp-rank-num">{i + 1}</span>}
              </div>

              {/* Park info + bar */}
              <div className="tpp-main">
                <div className="tpp-top-row">
                  {/* Name + city */}
                  <div className="tpp-name-wrap">
                    <span className="tpp-dot" style={{ background: park.color || 'var(--ink-4)' }}/>
                    <div style={{ minWidth: 0 }}>
                      <div className="tpp-name">{park.name}</div>
                      {park.city && <div className="tpp-city">{park.city}</div>}
                    </div>
                  </div>

                  {/* Revenue (primary) + trend (secondary) */}
                  <div className="tpp-kpi">
                    <span className="tpp-rev">{inr(park.revenue)}</span>
                    {compare && trend != null && (
                      <div className="tpp-trend"><Delta value={trend}/></div>
                    )}
                  </div>
                </div>

                {/* Revenue bar — minimum-width scaled */}
                <div className="tpp-bar-track">
                  <div
                    className="tpp-bar-fill"
                    style={{
                      width: `${barPct}%`,
                      background: park.color || 'var(--teal)',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
