'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

const DEFAULT_FILTERS = {
  park: 'All Parks', state: 'All States', cities: [],
  range: 'Monthly', date: todayStr, dateEnd: todayStr, compare: false,
};
import FilterBar from './FilterBar';
import HourlyChart from './HourlyChart';
import DemographicsSection from './Demographics';
import RevenueSplits from './RevenueSplits';
import Heatmap from './Heatmap';
import WeekendWeekday from './WeekendWeekday';
import Comparative from './Comparative';
import TopParksRow from './TopParks';
import Icon from './Icon';
import { inr, num, formatHour } from '../lib/format';

const TABS = ['Footfall', 'Revenue', 'Demographics', 'Trends'];

// ── CSV helper ────────────────────────────────────────────────
function dl(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// ── Control row: title + Chart|Table toggle + CSV ─────────────
// subtle=true → used as group label above multi-card chart grids (smaller, muted)
// subtle=false → used as table-mode header (prominent)
function CtrlRow({ title, ctrl, subtle = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{
        flex: 1,
        fontSize:      subtle ? 10.5 : 13,
        fontWeight:    subtle ? 600  : 700,
        color:         subtle ? 'var(--ink-4)' : 'var(--ink)',
        letterSpacing: subtle ? '0.06em' : '-0.2px',
        textTransform: subtle ? 'uppercase' : 'none',
      }}>
        {title}
      </span>
      {ctrl}
    </div>
  );
}

// ── Simple table ──────────────────────────────────────────────
function SimpleTable({ headers, rows, mono = [] }) {
  return (
    <div className="sec" style={{ overflow: 'auto' }}>
      <table className="data-table" style={{ minWidth: 480 }}>
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={mono.includes(j) ? 'mono' : ''}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Table views ───────────────────────────────────────────────
function WwdFootfallTable({ data }) {
  if (!data) return null;
  return (
    <SimpleTable
      headers={['Park', 'Weekend', 'Weekday', 'Δ vs Weekday']}
      mono={[1, 2, 3]}
      rows={data.footfall.map(d => [
        d.park,
        num(d.weekend),
        num(d.weekday),
        `+${((d.weekend - d.weekday) / d.weekday * 100).toFixed(1)}%`,
      ])}
    />
  );
}

function WwdRevenueTable({ data }) {
  if (!data) return null;
  return (
    <SimpleTable
      headers={['Park', 'Weekend', 'Weekday', 'Δ vs Weekday']}
      mono={[1, 2, 3]}
      rows={data.revenue.map(d => [
        d.park,
        inr(d.weekend),
        inr(d.weekday),
        `+${((d.weekend - d.weekday) / d.weekday * 100).toFixed(1)}%`,
      ])}
    />
  );
}

function HeatmapTable({ data }) {
  if (!data) return null;
  const cells = data.data
    .flatMap((row, di) => row.map((v, hi) => ({ day: data.days[di], hour: formatHour(data.hours[hi]), v })))
    .sort((a, b) => b.v - a.v)
    .slice(0, 15);
  return (
    <SimpleTable
      headers={['Rank', 'Day', 'Hour', 'Visitors']}
      mono={[0, 3]}
      rows={cells.map((c, i) => [i + 1, c.day, c.hour, num(c.v)])}
    />
  );
}

function TopParksTable({ topParks, metric = 'Revenue' }) {
  if (!topParks) return null;
  const list    = topParks[metric] || [];
  const isMoney = ['Revenue', 'Activities', 'F&B'].includes(metric);
  return (
    <SimpleTable
      headers={['Rank', 'Park', 'City', 'State', metric]}
      mono={[0, 4]}
      rows={list.map((p, i) => [i + 1, p.name, p.city, p.state, isMoney ? inr(p.value) : num(p.value)])}
    />
  );
}

function RevenueSplitsTable({ data }) {
  if (!data) return null;
  const sections = [
    { label: 'By Demographic', rows: data.byDemographic },
    { label: 'By Category',    rows: data.byCategory    },
    { label: 'By Source',      rows: data.bySource      },
    { label: 'By Payment',     rows: data.byPayment     },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sections.map(s => {
        const total = s.rows.reduce((sum, r) => sum + r.value, 0);
        return (
          <SimpleTable
            key={s.label}
            headers={[s.label, 'Amount', '% of Total']}
            mono={[1, 2]}
            rows={s.rows.map(r => [r.name, inr(r.value), `${(r.value / total * 100).toFixed(1)}%`])}
          />
        );
      })}
    </div>
  );
}

function ComparativeTable({ data }) {
  if (!data) return null;
  const pct = (curr, prev) => `${curr >= prev ? '+' : ''}${((curr - prev) / prev * 100).toFixed(1)}%`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SimpleTable
        headers={['Quarter', 'FY26', 'FY25', 'Change']}
        mono={[1, 2, 3]}
        rows={data.qvq.map(d => [d.q, inr(d.curr), inr(d.prev), pct(d.curr, d.prev)])}
      />
      <SimpleTable
        headers={['Month', '2026', '2025', 'Change']}
        mono={[1, 2, 3]}
        rows={data.yvy.map(d => [d.m, inr(d.curr), inr(d.prev), pct(d.curr, d.prev)])}
      />
    </div>
  );
}

function DemographicsTable({ data }) {
  if (!data) return null;
  return (
    <SimpleTable
      headers={['Age Group', 'Total', 'Male', 'Female', 'Other', '% Share']}
      mono={[1, 2, 3, 4, 5]}
      rows={data.demographics.map(d => [d.name, num(d.total), num(d.m), num(d.f), num(d.o), `${d.pct.toFixed(1)}%`])}
    />
  );
}

// ── CSV generators ─────────────────────────────────────────────
const pct = (a, b) => `+${((a - b) / b * 100).toFixed(1)}%`;

function csvWwdFootfall(wd) {
  dl([
    ['Park', 'Weekend', 'Weekday', 'Diff%'],
    ...(wd?.footfall || []).map(d => [d.park, d.weekend, d.weekday, pct(d.weekend, d.weekday)]),
  ], 'footfall-weekend-weekday.csv');
}

function csvHeatmap(hm) {
  dl([
    ['Day', 'Hour', 'Visitors'],
    ...((hm?.data || []).flatMap((row, di) =>
      row.map((v, hi) => [hm.days[di], formatHour(hm.hours[hi]), v])
    )),
  ], 'peak-hour-heatmap.csv');
}

function csvTopParks(tp, metric, filename) {
  dl([
    ['Rank', 'Park', 'City', 'State', metric],
    ...(tp?.[metric] || []).map((p, i) => [i + 1, p.name, p.city, p.state, p.value]),
  ], filename);
}

function csvRevenueSplits(rs) {
  dl([
    ['Type', 'Segment', 'Amount'],
    ...(rs?.byDemographic || []).map(r => ['Demographic', r.name, r.value]),
    ...(rs?.byCategory    || []).map(r => ['Category',    r.name, r.value]),
    ...(rs?.bySource      || []).map(r => ['Source',      r.name, r.value]),
    ...(rs?.byPayment     || []).map(r => ['Payment',     r.name, r.value]),
  ], 'revenue-splits.csv');
}

function csvWwdRevenue(wd) {
  dl([
    ['Park', 'Weekend', 'Weekday', 'Diff%'],
    ...(wd?.revenue || []).map(d => [d.park, d.weekend, d.weekday, pct(d.weekend, d.weekday)]),
  ], 'revenue-weekend-weekday.csv');
}

function csvComparative(cp) {
  const chg = (curr, prev) => `${curr >= prev ? '+' : ''}${((curr - prev) / prev * 100).toFixed(1)}%`;
  dl([
    ['Type', 'Period', 'Current', 'Previous', 'Change%'],
    ...(cp?.qvq || []).map(d => ['QvQ', d.q, d.curr, d.prev, chg(d.curr, d.prev)]),
    ...(cp?.yvy || []).map(d => ['YvY', d.m, d.curr, d.prev, chg(d.curr, d.prev)]),
  ], 'comparative.csv');
}

function csvDemographics(demo) {
  dl([
    ['Age Group', 'Total', 'Male', 'Female', 'Other', '% Share'],
    ...(demo?.demographics || []).map(d => [d.name, d.total, d.m, d.f, d.o, `${d.pct.toFixed(1)}%`]),
  ], 'demographics.csv');
}

// ── Main ──────────────────────────────────────────────────────
export default function AnalyticsClient({
  demographics:   initDemographics,
  revenueSplits:  initRevenueSplits,
  heatmap:        initHeatmap,
  weekendWeekday: initWeekendWeekday,
  comparative:    initComparative,
  topParks:       initTopParks,
}) {
  const [demographics,   setDemographics]   = useState(initDemographics);
  const [revenueSplits,  setRevenueSplits]  = useState(initRevenueSplits);
  const [heatmap,        setHeatmap]        = useState(initHeatmap);
  const [weekendWeekday, setWeekendWeekday] = useState(initWeekendWeekday);
  const [comparative,    setComparative]    = useState(initComparative);
  const [topParks,       setTopParks]       = useState(initTopParks);
  const [hourly,         setHourly]         = useState(null);

  const [tab,       setTab]       = useState('Footfall');
  const [filters,   setFilters]   = useState(DEFAULT_FILTERS);
  const [viewModes, setViewModes] = useState({});
  const [loading,   setLoading]   = useState(false);
  const [parkCount, setParkCount] = useState(0);

  const fetchData = async (f) => {
    setLoading(true);
    try {
      const [r0, r1, r2, r3, r4, r5, r6] = await Promise.allSettled([
        api.demographics(f),
        api.revenueSplits(f),
        api.heatmap(f),
        api.weekendWeekday(f),
        api.comparative(f),
        api.topParks(f),
        api.hourly(f),
      ]);
      if (r0.status === 'fulfilled') setDemographics(r0.value);
      if (r1.status === 'fulfilled') setRevenueSplits(r1.value);
      if (r2.status === 'fulfilled') setHeatmap(r2.value);
      if (r3.status === 'fulfilled') setWeekendWeekday(r3.value);
      if (r4.status === 'fulfilled') setComparative(r4.value);
      if (r5.status === 'fulfilled') setTopParks(r5.value);
      if (r6.status === 'fulfilled') setHourly(r6.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(DEFAULT_FILTERS);
    api.parks().then(ps => setParkCount(ps.length)).catch(() => {});
  }, []);

  const onApply = () => fetchData(filters);
  const onExport = () => {};

  const isChart = id => (viewModes[id] || 'chart') === 'chart';

  // Returns the Chart|Table toggle + CSV button JSX for a given section
  const mkCtrl = (id, onCsv) => {
    const view = viewModes[id] || 'chart';
    const setV = v => setViewModes(m => ({ ...m, [id]: v }));
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {['chart', 'table'].map((v, i) => (
            <button key={v} onClick={() => setV(v)} style={{
              padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: 1.6,
              background: view === v ? 'var(--teal)' : 'transparent',
              color:      view === v ? '#fff' : 'var(--ink-4)',
              border: 'none',
              borderRight: i === 0 ? '1px solid var(--border)' : 'none',
            }}>
              {v === 'chart' ? 'Chart' : 'Table'}
            </button>
          ))}
        </div>
        <button onClick={onCsv} className="btn btn-sm" style={{ fontSize: 11 }}>
          <Icon name="download" size={12}/> CSV
        </button>
      </div>
    );
  };

  return (
    <>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>Analytics</div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>Deep-dive analysis across all 7 parks</div>
      </div>

      <div className="tabs" style={{ alignSelf: 'flex-start' }}>
        {TABS.map(t => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport} showCity={false}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-3)' }}>
        <Icon name="info" size={13} color="var(--ink-4)"/>
        Showing data for{' '}
        <strong style={{ color: 'var(--ink)' }}>
          {filters.park !== 'All Parks' ? filters.park
            : filters.state !== 'All States' ? filters.state
            : `All ${parkCount || '—'} parks`}
        </strong>{' '}
        · {filters.range.toLowerCase()}
        <span className="spacer"/>
        {loading   && <span className="tag amber">Refreshing…</span>}
        {filters.compare && <span className="tag teal">Comparing to previous period</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.55 : 1, transition: 'opacity .25s' }}>

        {/* ── FOOTFALL ─────────────────────────────────────── */}
        {tab === 'Footfall' && <>
          <HourlyChart data={hourly} appliedFilters={filters}/>
          {isChart('wwd-footfall')
            ? <WeekendWeekday data={weekendWeekday} view="footfall"
                headerExtra={mkCtrl('wwd-footfall', () => csvWwdFootfall(weekendWeekday))}/>
            : <><CtrlRow title="Footfall · Weekend vs Weekday" ctrl={mkCtrl('wwd-footfall', () => csvWwdFootfall(weekendWeekday))}/><WwdFootfallTable data={weekendWeekday}/></>
          }
          {isChart('heatmap')
            ? <Heatmap data={heatmap} title="Weekly Peak Hour Heatmap"
                headerExtra={mkCtrl('heatmap', () => csvHeatmap(heatmap))}/>
            : <><CtrlRow title="Weekly Peak Hour Heatmap" ctrl={mkCtrl('heatmap', () => csvHeatmap(heatmap))}/><HeatmapTable data={heatmap}/></>
          }
          {isChart('top-parks-footfall')
            ? <TopParksRow topParks={topParks} initialTab="Footfall"
                headerExtra={mkCtrl('top-parks-footfall', () => csvTopParks(topParks, 'Footfall', 'top-parks-footfall.csv'))}/>
            : <><CtrlRow title="Top Performing Parks · Footfall" ctrl={mkCtrl('top-parks-footfall', () => csvTopParks(topParks, 'Footfall', 'top-parks-footfall.csv'))}/><TopParksTable topParks={topParks} metric="Footfall"/></>
          }
        </>}

        {/* ── REVENUE ──────────────────────────────────────── */}
        {tab === 'Revenue' && <>
          <div>
            <CtrlRow
              title="Revenue Splits"
              ctrl={mkCtrl('revenue-splits', () => csvRevenueSplits(revenueSplits))}
              subtle={isChart('revenue-splits')}
            />
            {isChart('revenue-splits')
              ? <RevenueSplits data={revenueSplits}/>
              : <RevenueSplitsTable data={revenueSplits}/>
            }
          </div>
          {isChart('wwd-revenue')
            ? <WeekendWeekday data={weekendWeekday} view="revenue"
                headerExtra={mkCtrl('wwd-revenue', () => csvWwdRevenue(weekendWeekday))}/>
            : <><CtrlRow title="Revenue · Weekend vs Weekday" ctrl={mkCtrl('wwd-revenue', () => csvWwdRevenue(weekendWeekday))}/><WwdRevenueTable data={weekendWeekday}/></>
          }
          <div>
            <CtrlRow
              title="Quarter vs Quarter · Year vs Year"
              ctrl={mkCtrl('comparative-revenue', () => csvComparative(comparative))}
              subtle={isChart('comparative-revenue')}
            />
            {isChart('comparative-revenue')
              ? <Comparative data={comparative} visible={true}/>
              : <ComparativeTable data={comparative}/>
            }
          </div>
          {isChart('top-parks-revenue')
            ? <TopParksRow topParks={topParks} initialTab="Revenue"
                headerExtra={mkCtrl('top-parks-revenue', () => csvTopParks(topParks, 'Revenue', 'top-parks-revenue.csv'))}/>
            : <><CtrlRow title="Top Performing Parks · Revenue" ctrl={mkCtrl('top-parks-revenue', () => csvTopParks(topParks, 'Revenue', 'top-parks-revenue.csv'))}/><TopParksTable topParks={topParks} metric="Revenue"/></>
          }
        </>}

        {/* ── DEMOGRAPHICS ─────────────────────────────────── */}
        {tab === 'Demographics' && <>
          {isChart('demographics')
            ? <DemographicsSection data={demographics}
                headerExtra={mkCtrl('demographics', () => csvDemographics(demographics))}/>
            : <><CtrlRow title="Visitor Demographics" ctrl={mkCtrl('demographics', () => csvDemographics(demographics))}/><DemographicsTable data={demographics}/></>
          }
        </>}

        {/* ── TRENDS ───────────────────────────────────────── */}
        {tab === 'Trends' && <>
          <div>
            <CtrlRow
              title="Quarter vs Quarter · Year vs Year"
              ctrl={mkCtrl('comparative-trends', () => csvComparative(comparative))}
              subtle={isChart('comparative-trends')}
            />
            {isChart('comparative-trends')
              ? <Comparative data={comparative} visible={true}/>
              : <ComparativeTable data={comparative}/>
            }
          </div>
          {isChart('top-parks-trends')
            ? <TopParksRow topParks={topParks}
                headerExtra={mkCtrl('top-parks-trends', () => csvTopParks(topParks, 'Revenue', 'top-parks-trends.csv'))}/>
            : <><CtrlRow title="Top Performing Parks · All Metrics" ctrl={mkCtrl('top-parks-trends', () => csvTopParks(topParks, 'Revenue', 'top-parks-trends.csv'))}/><TopParksTable topParks={topParks} metric="Revenue"/></>
          }
        </>}

      </div>

      <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 11, marginTop: 8 }}>
        ZTech Operations Dashboard v1.0 · © NovoStack 2026
      </div>
    </>
  );
}
