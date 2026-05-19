'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FilterBar from './FilterBar';
import BusiestHoursCard from './BusiestHoursCard';
import TopPerformingParks from './TopPerformingParks';
import { KpiCard } from './KpiRow';
import Icon from './Icon';
import BottomNav from './BottomNav';
import { num, inr, inrFull, prevPeriodLabel, downloadCSV } from '../lib/format';
import RevenuePieCard, { COLOR_MAPS, InlinePieBreakdown } from './RevenuePieCard';

const today = new Date();
const todayStr      = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const monthStartStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;

const DEFAULT_FILTERS = {
  parks: [], state: 'All States', cities: [],
  range: 'Monthly', date: monthStartStr, dateEnd: todayStr, compare: false,
};

function KpiTableView({ items, colLabel, formatValue }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const thStyle = { textAlign: 'left', color: 'var(--ink-4)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0', borderBottom: '1px solid var(--border)' };
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          <th style={thStyle}>{colLabel}</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Value</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Share</th>
        </tr>
      </thead>
      <tbody>
        {items.map(i => (
          <tr key={i.name}>
            <td style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--ink-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: i.color, flexShrink: 0, display: 'inline-block' }}/>
                {i.name}
              </span>
            </td>
            <td style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 600, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace" }}>{formatValue(i.value)}</td>
            <td style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', monospace" }}>{total > 0 ? ((i.value / total) * 100).toFixed(1) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.export-menu-wrap')) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return (
    <div className="export-menu-wrap menu-wrap">
      <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        <Icon name="download" size={12}/> Export
        <Icon name="chevron" size={10} color="var(--ink-4)"/>
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          <button onClick={() => onExport('CSV')}>Download as CSV <span className="kbd">⌘E</span></button>
          <button onClick={() => onExport('Excel')}>Download as Excel</button>
          <div className="menu-sep"/>
          <button onClick={() => onExport('DSR')}><Icon name="file" size={13}/> DSR Report (Daily)</button>
          <button onClick={() => onExport('FY-DSR')}><Icon name="file" size={13}/> FY DSR Report</button>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ kpis: initKpis, revenueSplits: initRevenueSplits, topParks: initTopParks }) {
  const [kpis,           setKpis]          = useState(initKpis);
  const [revenueSplits,  setRevenueSplits] = useState(initRevenueSplits);
  const [topParks,       setTopParks]      = useState(initTopParks);
  const [busiestByPark,  setBusiestByPark]  = useState([]);
  const [topParksRev,    setTopParksRev]    = useState([]);

  const [filters,        setFilters]        = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [loading,        setLoading]        = useState(false);
  const [exportToast,    setExportToast]    = useState(null);
  const [parkCount,      setParkCount]      = useState(null);
  const [kpiTableView,   setKpiTableView]   = useState(null); // 'revenue' | 'visitors' | 'tickets'

  useEffect(() => {
    api.parks().then(ps => setParkCount(ps.length)).catch(() => {});
  }, []);

  const fetchData = async (f) => {
    setLoading(true);
    try {
      const [r0, r1, r2, r3, r4] = await Promise.allSettled([
        api.kpis(f),
        api.revenueSplits(f),
        api.topParks(f),
        api.busiestByPark(f),
        api.topParksRevenue({ ...f, parks: [], park: 'All Parks', state: 'All States', cities: [] }),
      ]);
      if (r0.status === 'fulfilled') setKpis(r0.value);
      if (r1.status === 'fulfilled') setRevenueSplits(r1.value);
      if (r2.status === 'fulfilled') setTopParks(r2.value);
      if (r3.status === 'fulfilled') setBusiestByPark(r3.value);
      if (r4.status === 'fulfilled') setTopParksRev(r4.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(DEFAULT_FILTERS); }, []);

  const onApply = async (overrideFilters) => {
    const f = overrideFilters ?? filters;
    await fetchData(f);
    setAppliedFilters(f);
  };

  const onExport = (kind) => {
    setExportToast(`Exporting ${kind}…`);
    setTimeout(() => setExportToast(null), 2200);
  };

  return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <Topbar/>
        <div className="canvas">
          <div className="filter-sticky">
            <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport}/>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
              <Icon name="info" size={13} color="var(--ink-4)"/>
              Showing data for{' '}
              <strong style={{ color: 'var(--ink)' }}>
                {(() => {
                  const { parks, state, cities } = appliedFilters;
                  if (parks && parks.length === 1) return parks[0];
                  if (parks && parks.length > 1 && parks.length <= 3) return parks.join(', ');
                  if (parks && parks.length > 3) return `${parks.slice(0, 2).join(', ')} +${parks.length - 2}`;
                  if (state === 'All States' && cities.length === 0)
                    return `All${parkCount != null ? ` ${parkCount}` : ''} parks`;
                  if (state !== 'All States' && cities.length === 0)
                    return `All parks · ${state}`;
                  if (cities.length === 1)
                    return `${cities[0]}${state !== 'All States' ? `, ${state}` : ''}`;
                  if (cities.length <= 3)
                    return `${cities.join(', ')}${state !== 'All States' ? ` · ${state}` : ''}`;
                  return `${cities.slice(0, 2).join(', ')} +${cities.length - 2}${state !== 'All States' ? ` · ${state}` : ''}`;
                })()}
              </strong>{' '}
              (<strong style={{ color: 'var(--ink)'}}>{appliedFilters.range}</strong>)
              <span className="spacer"/>
              {loading && <span className="tag amber">Refreshing widgets…</span>}
              {appliedFilters.compare && <span className="tag teal">Comparing to previous period</span>}
              <ExportMenu onExport={onExport}/>
            </div>
          </div>

          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .25s', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ROW 1 — 3 KPI cards */}
            {(() => {
              const catTotal   = (revenueSplits?.byCategory || []).reduce((s, c) => s + c.value, 0);
              const comparing  = kpis?.deltaLabel != null;
              const deltaLabel = comparing
                ? prevPeriodLabel(appliedFilters.range, appliedFilters.date, appliedFilters.dateEnd)
                : null;

              const revItems  = (topParks?.Revenue  || []).map(p => ({ name: p.name, value: p.value, color: p.color }));
              const visItems  = (topParks?.Footfall || []).map(p => ({ name: p.name, value: p.value, color: p.color }));
              const tixItems  = revenueSplits?.bySource || [];

              const kpiActions = (key, items, filename, headers, rowsFn) => (
                <>
                  <button className="btn btn-sm icon-btn" title={kpiTableView === key ? 'Chart view' : 'Table view'}
                    onClick={() => setKpiTableView(v => v === key ? null : key)}>
                    <Icon name={kpiTableView === key ? 'chart' : 'table'} size={13}/>
                  </button>
                  <button className="btn btn-sm icon-btn" title="Download CSV" disabled={!items.length}
                    onClick={() => downloadCSV(filename, headers, rowsFn(items))}>
                    <Icon name="download" size={13}/>
                  </button>
                </>
              );

              return (
                <div className="kpi-grid">
                  <KpiCard
                    label="Total Revenue" icon="chart"
                    value={inrFull(catTotal || kpis?.totalRevenue || 0)}
                    delta={comparing ? kpis.deltaRevenue : null}
                    deltaLabel={deltaLabel}
                    actions={kpiActions('revenue', revItems, 'revenue-by-park.csv',
                      ['Park', 'Revenue (INR)', 'Share (%)'],
                      (items) => { const t = items.reduce((s,i)=>s+i.value,0); return items.map(i=>[i.name, i.value.toFixed(2), t>0?((i.value/t)*100).toFixed(1):'0']); }
                    )}
                    extra={kpiTableView === 'revenue'
                      ? <KpiTableView items={revItems} colLabel="Park" formatValue={inr}/>
                      : <InlinePieBreakdown items={revItems} formatValue={inr}/>}
                  />
                  <KpiCard
                    label="Total Visitors" icon="users"
                    value={num(kpis?.totalVisitors)}
                    delta={comparing ? kpis.deltaVisitors : null}
                    deltaLabel={deltaLabel}
                    actions={kpiActions('visitors', visItems, 'visitors-by-park.csv',
                      ['Park', 'Visitors', 'Share (%)'],
                      (items) => { const t = items.reduce((s,i)=>s+i.value,0); return items.map(i=>[i.name, i.value, t>0?((i.value/t)*100).toFixed(1):'0']); }
                    )}
                    extra={kpiTableView === 'visitors'
                      ? <KpiTableView items={visItems} colLabel="Park" formatValue={num}/>
                      : <InlinePieBreakdown items={visItems} formatValue={num}/>}
                  />
                  <KpiCard
                    label="Ticket Transactions" icon="ticket"
                    value={num(kpis?.totalTickets)}
                    delta={comparing ? kpis.deltaTickets : null}
                    deltaLabel={deltaLabel}
                    actions={kpiActions('tickets', tixItems, 'tickets-by-source.csv',
                      ['Source', 'Transactions', 'Share (%)'],
                      (items) => { const t = items.reduce((s,i)=>s+i.value,0); return items.map(i=>[i.name, i.value, t>0?((i.value/t)*100).toFixed(1):'0']); }
                    )}
                    extra={kpiTableView === 'tickets'
                      ? <KpiTableView items={tixItems} colLabel="Source" formatValue={num}/>
                      : <InlinePieBreakdown items={tixItems} formatValue={num}/>}
                  />
                </div>
              );
            })()}

            {/* ROW 2 — 2 pie charts side by side */}
            <div className="grid-2col">
              <RevenuePieCard
                title="Revenue by Category"
                items={revenueSplits?.byCategory || []}
                colorMap={COLOR_MAPS.category}
                compare={appliedFilters.compare}
                range={appliedFilters.range}
                date={appliedFilters.date}
                dateEnd={appliedFilters.dateEnd}
              />
              <RevenuePieCard
                title="Revenue by Payment Mode"
                items={revenueSplits?.byPayment || []}
                colorMap={COLOR_MAPS.payment}
                compare={appliedFilters.compare}
                range={appliedFilters.range}
                date={appliedFilters.date}
                dateEnd={appliedFilters.dateEnd}
              />
            </div>

            {/* ROW 3 — Top Performing Parks */}
            <TopPerformingParks
              parks={topParksRev}
              parkCount={parkCount}
              selectedParks={appliedFilters.parks || []}
              dateLabel={appliedFilters.range}
              compare={appliedFilters.compare}
              date={appliedFilters.date}
              dateEnd={appliedFilters.dateEnd}
            />

            {/* ROW 4 — Busiest Hours by Park */}
            <BusiestHoursCard
              busiestByPark={busiestByPark}
              appliedFilters={appliedFilters}
            />
          </div>

          <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 11, marginTop: 8 }}>
            ZTech Operations Dashboard v1.0 · © NovoStack 2026
          </div>
        </div>
      </div>

      <BottomNav active="dashboard"/>

      {exportToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--ink)', color: '#fff',
          padding: '10px 14px', borderRadius: 6, fontSize: 12.5,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 100,
        }}>
          <Icon name="download" size={13} color="#fff"/> {exportToast}
        </div>
      )}
    </div>
  );
}
