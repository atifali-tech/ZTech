'use client';
import { inr } from '../lib/format';
import { Section } from './Primitives';

export default function TopPerformingParks({ parks = [], dateLabel = '' }) {
  const max = Math.max(...parks.map(p => p.revenue), 1);

  return (
    <Section
      title="Top Performing Parks"
      sub={`by revenue${dateLabel ? ` · ${dateLabel}` : ''}`}
    >
      {parks.length === 0 ? (
        <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
      ) : (
        parks.map((park, i) => (
          <div key={park.parkId} style={{
            display: 'grid',
            gridTemplateColumns: '28px 12px 1fr 200px 90px 64px',
            alignItems: 'center',
            gap: 10,
            padding: '7px 0',
            borderBottom: i < parks.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {/* Rank */}
            <span style={{
              fontSize: 12, fontWeight: 700, color: 'var(--ink-4)',
              fontFamily: "'JetBrains Mono', monospace", textAlign: 'right',
            }}>
              {i + 1}
            </span>

            {/* Dot */}
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: park.color, display: 'inline-block', flexShrink: 0,
            }}/>

            {/* Name + city */}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {park.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{park.city}</div>
            </div>

            {/* Bar */}
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: (park.revenue / max * 100) + '%',
                background: park.color,
                transition: 'width .3s ease',
              }}/>
            </div>

            {/* Revenue */}
            <span style={{
              fontSize: 13, fontWeight: 700, color: 'var(--ink)',
              fontFamily: "'JetBrains Mono', monospace", textAlign: 'right',
            }}>
              {inr(park.revenue)}
            </span>

            {/* Trend */}
            {park.trend != null ? (
              <span style={{
                fontSize: 11, fontWeight: 600, textAlign: 'right',
                color: park.trend >= 0 ? 'var(--teal)' : 'var(--red)',
              }}>
                {park.trend >= 0 ? '↑' : '↓'} {Math.abs(park.trend)}%
              </span>
            ) : (
              <span/>
            )}
          </div>
        ))
      )}
    </Section>
  );
}
