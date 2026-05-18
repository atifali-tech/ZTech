'use client';
import { num, inr } from '../lib/format';
import { Section, Delta } from './Primitives';

function fmtHour(h) {
  const h12 = h % 12 || 12;
  return `${h12}${h < 12 ? 'AM' : 'PM'}`;
}

function fmtWindow(start, end) {
  if (start === end) return fmtHour(start);
  return `${fmtHour(start)} – ${fmtHour(end)}`;
}

export default function BusiestHoursCard({ busiestByPark = [], appliedFilters }) {
  const isSinglePark = appliedFilters?.park && appliedFilters.park !== 'All Parks';
  const compare      = !!appliedFilters?.compare;
  const max          = Math.max(...busiestByPark.map(p => p.ticketCount), 1);

  const title = isSinglePark ? `Busiest Window · ${appliedFilters.park}` : 'Busiest Hours by Park';
  const sub   = 'by peak ticket window';

  const gridCols = compare
    ? 'minmax(80px,180px) 90px 1fr 110px 64px'
    : undefined; // use CSS default 4-col

  return (
    <Section title={title} sub={sub}>
      {isSinglePark ? (
        busiestByPark[0]?.ticketCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 32, fontWeight: 700, color: 'var(--ink)',
              fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.01em',
            }}>
              {fmtWindow(busiestByPark[0].startHour, busiestByPark[0].endHour)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 4 }}>
              {num(busiestByPark[0].ticketCount)} tickets · {inr(busiestByPark[0].revenue)} revenue
            </span>
            {compare && busiestByPark[0].trend != null && (
              <Delta value={busiestByPark[0].trend}/>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        )
      ) : (
        busiestByPark.length === 0 ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Column headers */}
            <div className="bh-park-row" style={{
              paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 2,
              gridTemplateColumns: gridCols,
            }}>
              <span className="col-hdr">Park</span>
              <span className="col-hdr">Busy Window</span>
              <span/>
              <span className="col-hdr" style={{ textAlign: 'right' }}>Tickets</span>
              {compare && <span className="col-hdr" style={{ textAlign: 'right' }}>Trend</span>}
            </div>
            {busiestByPark.map(park => (
              <div key={park.parkId} className="bh-park-row" style={{ gridTemplateColumns: gridCols }}>
                <span style={{
                  fontSize: 12, color: 'var(--ink-2)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: park.color, flexShrink: 0, display: 'inline-block',
                  }}/>
                  {park.parkName}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: 'var(--ink)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {fmtWindow(park.startHour, park.endHour)}
                </span>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: (park.ticketCount / max * 100) + '%',
                    background: park.color,
                  }}/>
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>
                  {num(park.ticketCount)} tickets
                </span>
                {compare && (
                  <span style={{ textAlign: 'right' }}>
                    {park.trend != null
                      ? <Delta value={park.trend}/>
                      : <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>—</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </Section>
  );
}
