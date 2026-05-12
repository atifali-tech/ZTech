'use client';
import Icon from './Icon';
import { Sparkline, Delta } from './Primitives';
import { num, inr, inrFull, formatHour } from '../lib/format';

const PARKS = [
  { id: 'jt', name: 'Jungle Trail', color: '#0E7C66' },
  { id: 'ud', name: 'UP Darshan',   color: '#5A6BCF' },
  { id: 'dp', name: 'Delhi Park',   color: '#D89614' },
];

function KpiCard({ label, icon, value, spark, sparkColor, delta, deltaLabel = 'vs yesterday', legend }) {
  return (
    <div className="sec kpi">
      <div className="kpi-label">
        {icon && <Icon name={icon} size={13} color="var(--ink-4)"/>}
        {label}
      </div>
      <div className="row" style={{ alignItems: 'flex-end', marginTop: 4, gap: 14 }}>
        <div className="kpi-val">{value}</div>
        <div style={{ marginLeft: 'auto' }}>
          {spark && <Sparkline data={spark} color={sparkColor} width={120} height={36}/>}
        </div>
      </div>
      <div className="kpi-row">
        {delta != null && <Delta value={delta}/>}
        <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>{deltaLabel}</span>
        <span className="spacer"/>
        <span style={{ fontSize: 10.5, color: 'var(--ink-4)', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 600 }}>7-day trend</span>
      </div>
      {legend && (
        <div className="legend-dots">
          {legend.map((l, i) => (
            <span key={i}>
              <span className="dot" style={{ background: l.color }}/>
              {l.name} <span className="mono" style={{ color: 'var(--ink-4)', marginLeft: 3 }}>{l.val}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KpiRow({ data }) {
  if (!data) return null;

  const peakLabel = formatHour(data.peakHour);
  const parkLegend = PARKS.map((p, i) => ({
    name: p.name.split(' ')[0],
    color: p.color,
    val: ['38%', '22%', '18%'][i],
  }));

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors"
          icon="users"
          value={num(data.totalVisitors)}
          spark={data.sparkVisitors}
          sparkColor="#0E7C66"
          delta={5.8}
          legend={parkLegend}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Revenue"
          icon="chart"
          value={inrFull(data.totalRevenue)}
          spark={data.sparkRevenue}
          sparkColor="#5A6BCF"
          delta={-7.4}
          legend={[
            { name: 'Tickets',    color: '#0E7C66', val: '64%' },
            { name: 'Activities', color: '#D89614', val: '18%' },
            { name: 'F&B',        color: '#E5604D', val: '10%' },
          ]}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Tickets"
          icon="ticket"
          value={num(data.totalTickets)}
          spark={data.sparkTickets}
          sparkColor="#D89614"
          delta={6.0}
          legend={[
            { name: 'Counter',  color: '#0E7C66', val: '54%' },
            { name: 'Web',      color: '#5A6BCF', val: '32%' },
            { name: 'WhatsApp', color: '#D89614', val: '14%' },
          ]}
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)' }}>
          <div className="kpi-label"><Icon name="clock" size={13} color="var(--ink-4)"/> Peak Hour</div>
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
            <span className="tag teal">Today's Peak</span>
            <span style={{ color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{inr(data.peakHourRevenue)} this hour</span>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
            {(data.sparkPeak || []).map((v, i) => {
              const maxv = Math.max(...(data.sparkPeak || [1]));
              const h = (v / maxv) * 100;
              return (
                <div key={i} style={{
                  flex: 1, height: h + '%',
                  background: i === (data.sparkPeak || []).length - 1 ? 'var(--teal)' : 'var(--teal-100)',
                  borderRadius: 1.5,
                }}/>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-4)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
