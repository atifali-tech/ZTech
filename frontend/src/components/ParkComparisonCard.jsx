'use client';
import { inr } from '../lib/format';
import { Delta } from './Primitives';

const COLORS = ['#0E7C66','#5A6BCF','#D89614','#E5604D','#8C5BB3','#1F8A4A','#378ADD','#C53A2B'];

export default function ParkComparisonCard({ parks = [], dateLabel = '', compare = false }) {
  const mode = 'revenue'; // Fixed to revenue only

  const sorted = [...parks]
    .filter(p => (p.revenue ?? p.value ?? 0) > 0)
    .sort((a, b) => (b.revenue ?? b.value ?? 0) - (a.revenue ?? a.value ?? 0))
    .slice(0, 8);

  const maxVal   = sorted[0] ? (sorted[0].revenue ?? sorted[0].value ?? 0) : 1;
  const fmtVal   = inr;
  const modeLabel = 'Revenue';

  return (
    <div className="sec" style={{ height: '100%' }}>
      <div className="sec-head">
        <div className="sec-title">Park Performance</div>
        {dateLabel && <div className="sec-sub">{dateLabel}</div>}
      </div>
      <div className="sec-body">
        {!sorted.length ? (
          <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>No data for this period</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sorted.map((p, i) => {
              const val    = p.revenue ?? p.value ?? 0;
              const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const color  = COLORS[i % COLORS.length];
              const delta  = compare && p.delta != null ? p.delta : null;

              return (
                <div key={p.id || p.name || i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    {/* Rank badge */}
                    <span style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      background: i === 0 ? color : color + '22',
                      border: `1.5px solid ${color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9.5, fontWeight: 700, color: i === 0 ? '#fff' : color,
                    }}>
                      {i + 1}
                    </span>

                    {/* Name */}
                    <span style={{
                      flex: 1, fontSize: 12, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: 'var(--ink-2)', fontWeight: i === 0 ? 600 : 400,
                    }}>
                      {p.name}
                    </span>

                    {/* Value + delta */}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {delta != null && <Delta value={delta}/>}
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--ink)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {fmtVal(val)}
                      </span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 5, background: 'var(--surface-2)',
                    borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      height: '100%', width: `${barPct}%`,
                      background: color, borderRadius: 3,
                      transition: 'width .45s cubic-bezier(.2,.8,.2,1)',
                    }}/>
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--ink-5)', textAlign: 'right' }}>
              by {modeLabel.toLowerCase()} · top {sorted.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
