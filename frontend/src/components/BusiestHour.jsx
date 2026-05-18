'use client';
import Icon from './Icon';
import { num, inr, formatHour } from '../lib/format';

export default function BusiestHour({ data }) {
  if (!data) return null;
  const peakLabel = formatHour(data.peakHour);

  return (
    <div className="sec" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
      <div className="sec-head">
        <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="clock" size={14} color="var(--ink-4)"/> Busiest Hour
        </div>
      </div>
      <div className="sec-body" style={{ flexDirection: 'row', alignItems: 'center', gap: 24, padding: '12px 16px' }}>
        {data.peakCount > 0 ? (
          <>
            {/* Peak time + stats */}
            <div style={{ flexShrink: 0 }}>
              <div className="kpi-val mono" style={{ fontSize: 36 }}>
                {peakLabel.replace('AM','').replace('PM','')}
                <span className="unit">{peakLabel.includes('PM') ? 'PM' : 'AM'}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--teal)', fontFamily: "'JetBrains Mono', monospace" }}>
                {num(data.peakCount)} tickets
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                {inr(data.peakRevenue)} revenue
              </div>
            </div>

            {/* Sparkline */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
                {(data.sparkPeak || []).map((v, i, arr) => (
                  <div key={i} style={{
                    flex: 1,
                    height: (v / Math.max(...arr, 1)) * 100 + '%',
                    background: i === arr.length - 1 ? 'var(--teal)' : 'var(--teal-100)',
                    borderRadius: 2,
                    minHeight: 2,
                  }}/>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-4)', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        )}
      </div>
    </div>
  );
}
