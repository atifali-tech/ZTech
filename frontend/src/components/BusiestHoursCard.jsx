'use client';
import { formatHour, num, inr } from '../lib/format';
import HourlyChart from './HourlyChart';

export default function BusiestHoursCard({ kpis, busiestByPark = [], hourly, appliedFilters }) {
  const isSinglePark = appliedFilters?.park && appliedFilters.park !== 'All Parks';
  const max = Math.max(...busiestByPark.map(p => p.ticketCount), 1);

  return (
    <div className="sec" style={{ padding: 0 }}>

      {/* ── Busiest Hours ── */}
      <div style={{ padding: '16px 20px 14px' }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 12,
        }}>
          {isSinglePark ? `Busiest Hour · ${appliedFilters.park}` : 'Busiest Hours by Park'}
        </div>

        {isSinglePark ? (
          kpis?.peakCount > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontSize: 36, fontWeight: 700, color: 'var(--ink)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {formatHour(kpis.peakHour).replace(/[AP]M/, '')}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-3)' }}>
                {formatHour(kpis.peakHour).includes('PM') ? 'PM' : 'AM'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 8 }}>
                {num(kpis.peakCount)} tickets · {inr(kpis.peakRevenue)} revenue
              </span>
            </div>
          ) : (
            <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
          )
        ) : (
          busiestByPark.length === 0 ? (
            <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {busiestByPark.map(park => (
                <div key={park.parkId} style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 72px 1fr 110px',
                  alignItems: 'center', gap: 10, padding: '3px 0',
                }}>
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
                    {formatHour(park.peakHour)}
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
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: '1px solid var(--border)' }}/>

      {/* ── Hourly Chart ── */}
      <HourlyChart data={hourly} noCard appliedFilters={appliedFilters}/>
    </div>
  );
}
