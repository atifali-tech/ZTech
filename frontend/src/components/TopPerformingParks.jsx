'use client';
import { inr, prevPeriodLabel } from '../lib/format';
import { Section, Delta } from './Primitives';

export default function TopPerformingParks({ parks = [], dateLabel = '', compare = false, date = '', dateEnd = '' }) {
  const max = Math.max(...parks.map(p => p.revenue), 1);

  return (
    <Section
      title="Revenue by Park"
      sub={compare ? prevPeriodLabel(dateLabel, date, dateEnd) : ''}
    >
      {parks.length === 0 ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
      ) : (<>
        {/* Column headers */}
        <div className="tpp-row" style={{
          paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 2,
          gridTemplateColumns: compare ? undefined : '28px 12px minmax(80px,160px) 1fr 90px',
        }}>
          <span/><span/>
          <span className="col-hdr">Park</span>
          <span/>
          <span className="col-hdr" style={{ textAlign: 'right' }}>Revenue</span>
          {compare && <span className="col-hdr" style={{ textAlign: 'right' }}>Trend</span>}
        </div>
        {parks.map((park, i) => (
          <div key={park.parkId} className="tpp-row"
            style={{
              borderBottom: i < parks.length - 1 ? '1px solid var(--border)' : 'none',
              gridTemplateColumns: compare ? undefined : '28px 12px minmax(80px,160px) 1fr 90px',
            }}>

            {/* Rank */}
            <span className="tpp-rank">{i + 1}</span>

            {/* Dot */}
            <span className="tpp-dot" style={{ background: park.color }}/>

            {/* Name + city */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {park.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{park.city}</div>
            </div>

            {/* Bar */}
            <div className="tpp-bar-track">
              <div style={{
                height: '100%', borderRadius: 3,
                width: (park.revenue / max * 100) + '%',
                background: park.color, transition: 'width .3s ease',
              }}/>
            </div>

            {/* Revenue */}
            <span className="tpp-rev">{inr(park.revenue)}</span>

            {/* Trend — only when compare is active */}
            {compare && (
              <span className="tpp-trend">
                {park.trend != null
                  ? <Delta value={park.trend}/>
                  : <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>—</span>}
              </span>
            )}
          </div>
        ))}
      </>)}
    </Section>
  );
}
