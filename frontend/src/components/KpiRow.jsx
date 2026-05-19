'use client';
import Icon from './Icon';
import { Delta } from './Primitives';
import { num, inr, inrFull, formatHour } from '../lib/format';

export function KpiCard({ label, icon, value, delta, deltaLabel, extra, actions }) {
  const hasTrend = delta != null || deltaLabel;
  return (
    <div className="sec kpi">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            {icon && <Icon name={icon} size={15} color="var(--ink-4)"/>}
            {label}
          </div>
          {hasTrend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
              {delta != null && <Delta value={delta}/>}
              {deltaLabel && <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{deltaLabel}</span>}
            </div>
          )}
        </div>
        {actions && <div style={{ flexShrink: 0, display: 'flex', gap: 4 }}>{actions}</div>}
      </div>
      <div className="kpi-val">{value}</div>
      {extra && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', padding: '8px 0' }}>
          {extra}
        </div>
      )}
    </div>
  );
}

export function BreakdownList({ rows, formatValue, emptyText }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: 'var(--ink-4)', fontSize: 12 }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(r => (
        <div key={r.name ?? r.parkId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: '#F5F6F8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.color || '#888', flexShrink: 0, display: 'inline-block' }}/>
          <span style={{ fontSize: 10.5, color: 'var(--ink-2)', flex: 1 }}>{r.name ?? r.parkId}</span>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>{formatValue(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function KpiRow({ data, revenueSplits = {}, topParks = {} }) {
  if (!data) return null;

  const comparing = data.deltaLabel != null;
  const cmpLabel  = comparing ? data.deltaLabel : null;
  const delta     = (val) => comparing ? val : null;
  const peakLabel = formatHour(data.peakHour);

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors" icon="users"
          value={num(data.totalVisitors)}
          delta={delta(data.deltaVisitors)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(topParks.Footfall || []).filter(p => p.value > 0).slice(0, 5).map(p => ({ name: p.name, value: p.value, color: p.color }))}
              formatValue={num}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Revenue" icon="chart"
          value={inrFull(data.totalRevenue || 0)}
          delta={delta(data.deltaRevenue)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(revenueSplits?.byCategory || []).filter(r => r.value > 0).slice(0, 5)}
              formatValue={inr}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Ticket Transactions" icon="ticket"
          value={num(data.totalTickets)}
          delta={delta(data.deltaTickets)} deltaLabel={cmpLabel}
          extra={
            <BreakdownList
              rows={(revenueSplits?.bySource || []).filter(r => r.value > 0).slice(0, 5)}
              formatValue={num}
              emptyText="No data for this period"
            />
          }
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            <Icon name="clock" size={15} color="var(--ink-4)"/> Busiest Hour
          </div>
          {data.peakCount > 0 ? (
            <>
              <div className="kpi-val mono" style={{ fontSize: 30, marginTop: 6 }}>
                {peakLabel.replace('AM','').replace('PM','')}
                <span className="unit">{peakLabel.includes('PM') ? 'PM' : 'AM'}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--teal)', fontFamily: "'JetBrains Mono', monospace" }}>
                {num(data.peakCount)} tickets
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                {inr(data.peakRevenue)} this hour
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
                {(data.sparkPeak || []).map((v, i, arr) => (
                  <div key={i} style={{
                    flex: 1, height: (v / Math.max(...arr, 1)) * 100 + '%',
                    background: i === arr.length - 1 ? 'var(--teal)' : 'var(--teal-100)',
                    borderRadius: 1.5,
                  }}/>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-4)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 8 }}>No data for this period</div>
          )}
        </div>
      </div>
    </div>
  );
}
