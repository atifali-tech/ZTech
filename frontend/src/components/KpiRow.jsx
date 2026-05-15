'use client';
import Icon from './Icon';
import { Delta } from './Primitives';
import { num, inr, inrFull, formatHour } from '../lib/format';

function KpiCard({ label, icon, value, delta, deltaLabel, extra }) {
  const trend = (delta != null || deltaLabel) ? (
    <div className="kpi-row" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
      {delta != null && <Delta value={delta}/>}
      {deltaLabel && <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{deltaLabel}</span>}
    </div>
  ) : null;

  return (
    <div className="sec kpi">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
          {icon && <Icon name={icon} size={13} color="var(--ink-4)"/>}
          {label}
        </div>
        <div style={{ marginLeft: 'auto' }}>{trend}</div>
      </div>
      <div className="kpi-val">{value}</div>
      {extra && <div style={{ margin: '8px 0 4px', borderTop: '1px solid var(--border)' }}/>}
      {extra}
    </div>
  );
}

function BreakdownList({ rows, formatValue, emptyText }) {
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
              rows={(topParks.Footfall || []).slice(0, 5).map(p => ({ name: p.name, value: p.value, color: p.color }))}
              formatValue={num}
              emptyText="Visitor breakdown unavailable for this filter."
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
              rows={(revenueSplits?.byCategory || []).slice(0, 5)}
              formatValue={inr}
              emptyText="Revenue category breakdown unavailable."
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
              rows={(revenueSplits?.bySource || []).slice(0, 5)}
              formatValue={num}
              emptyText="Source breakdown unavailable."
            />
          }
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
          <div className="kpi-label" style={{ fontWeight: 500, color: 'var(--color-text-primary, var(--ink))' }}>
            <Icon name="clock" size={13} color="var(--ink-4)"/> Peak Hour
          </div>
          <div className="row" style={{ alignItems: 'flex-end', marginTop: 4, gap: 10 }}>
            <div className="kpi-val mono" style={{ fontSize: 30 }}>
              {peakLabel.replace('AM','').replace('PM','')}
              <span className="unit">{peakLabel.includes('PM') ? 'PM' : 'AM'}</span>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 18, color: 'var(--teal)', lineHeight: 1 }}>
                {num(data.peakFootfall)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600, marginTop: 3 }}>
                visitors
              </div>
            </div>
          </div>
          <div className="kpi-row" style={{ flexWrap: 'wrap' }}>
            <span className="tag teal">Today&apos;s Peak</span>
            <span style={{ color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{inr(data.peakHourRevenue)} this hour</span>
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
        </div>
      </div>
    </div>
  );
}
