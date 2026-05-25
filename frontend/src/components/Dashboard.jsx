'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';
import { useFilterState, scopeLabel, makeDefaultFilters } from '../lib/useFilterState';
import ExportMenu from './ExportMenu';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FilterBar from './FilterBar';
import TopPerformingParks from './TopPerformingParks';
import { KpiCard, ModernDonut } from './KpiRow';
import Icon from './Icon';
import BottomNav from './BottomNav';
import { num, inr, inrFull, prevPeriodLabel, downloadCSV } from '../lib/format';
import { COLOR_MAPS } from './RevenuePieCard';
import RevenueBarCard from './RevenueBarCard';
import ParkHealthWidget from './ParkHealthWidget';

function normTrend(data) {
  const raw = Array.isArray(data) ? data : (data?.daily ?? data?.trend ?? data?.data ?? []);
  return raw.map(r => ({
    date:     r.date     ?? r.period    ?? '',
    revenue:  r.revenue  ?? r.total_revenue  ?? r.rev     ?? 0,
    visitors: r.visitors ?? r.total_visitors ?? r.footfall ?? 0,
    tickets:  r.tickets  ?? r.total_tickets  ?? r.txns     ?? 0,
  }));
}

function OperationalWidget({ title, value, sub, icon, tone = 'teal', items = [] }) {
  const toneColor = {
    teal: 'var(--teal)',
    amber: 'var(--amber)',
    red: 'var(--red)',
    indigo: 'var(--indigo)',
    ink: 'var(--ink-3)',
  }[tone] || 'var(--teal)';

  return (
    <div className="sec ops-card">
      <div className="ops-card-head">
        <div className="ops-icon" style={{ color: toneColor }}>
          <Icon name={icon} size={14}/>
        </div>
        <div className="ops-title">{title}</div>
      </div>
      <div className="ops-value">{value}</div>
      <div className="ops-sub">{sub}</div>
      {!!items.length && (
        <div className="ops-list">
          {items.map(item => (
            <div key={item.label} className="ops-list-row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ kpis: initKpis, revenueSplits: initRevenueSplits, topParks: initTopParks }) {
  const [kpis,          setKpis]         = useState(initKpis);
  const [revenueSplits, setRevenueSplits] = useState(initRevenueSplits);
  const [topParks,      setTopParks]      = useState(initTopParks);
  const [busiestByPark, setBusiestByPark] = useState([]);
  const [topParksRev,   setTopParksRev]   = useState([]);
  const [trendData,     setTrendData]     = useState([]);

  const { filters, setFilters, appliedFilters, setAppliedFilters, loading, setLoading, parks, parkCount } = useFilterState('Monthly');
  const [exportToast,  setExportToast]  = useState(null);

  const fetchData = async (f) => {
    setLoading(true);
    try {
      const [r0, r1, r2, r3, r4, r5] = await Promise.allSettled([
        api.kpis(f),
        api.revenueSplits(f),
        api.topParks(f),
        api.busiestByPark(f),
        api.topParksRevenue({ ...f, parks: [], park: 'All Parks', state: 'All States', cities: [] }),
        api.revenueTrend(f),
      ]);
      if (r0.status === 'fulfilled') setKpis(r0.value);
      if (r1.status === 'fulfilled') setRevenueSplits(r1.value);
      if (r2.status === 'fulfilled') setTopParks(r2.value);
      if (r3.status === 'fulfilled') setBusiestByPark(r3.value);
      if (r4.status === 'fulfilled') setTopParksRev(r4.value);
      if (r5.status === 'fulfilled') setTrendData(normTrend(r5.value));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(makeDefaultFilters()); }, []);

  const onApply = async (overrideFilters) => {
    const f = overrideFilters ?? filters;
    await fetchData(f);
    setAppliedFilters(f);
  };

  const onExport = (kind) => {
    setExportToast(`Exporting ${kind}…`);
    setTimeout(() => setExportToast(null), 2200);
  };

  const catTotal = useMemo(
    () => (revenueSplits?.byCategory || []).reduce((s, c) => s + c.value, 0),
    [revenueSplits],
  );
  const revItems = useMemo(
    () => (topParks?.Revenue  || []).map(p => ({ name: p.name, value: p.value, color: p.color })),
    [topParks],
  );
  const visItems = useMemo(
    () => (topParks?.Footfall || []).map(p => ({ name: p.name, value: p.value, color: p.color })),
    [topParks],
  );
  const tixItems = useMemo(() => {
    const raw = revenueSplits?.bySource || [];
    const valMap = {}, prevMap = {}, colorMap = {};
    raw.forEach(r => {
      const label = (r.name && r.name.trim()) ? r.name.trim() : null;
      if (!label) return;
      valMap[label]   = (valMap[label]  || 0) + (Number(r.value) || 0);
      if (r.prevValue != null) prevMap[label] = (prevMap[label] || 0) + (Number(r.prevValue) || 0);
      if (r.color) colorMap[label] = r.color;
    });
    return Object.entries(valMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name,
        value,
        color: colorMap[name],
        prevValue: prevMap[name] ?? null,
      }));
  }, [revenueSplits]);

  // Sparkline arrays from last 14 trend points
  const sparkRev = useMemo(() => trendData.slice(-14).map(r => r.revenue),  [trendData]);
  const sparkVis = useMemo(() => trendData.slice(-14).map(r => r.visitors), [trendData]);

  return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <Topbar/>
        <div className="canvas">
          <div className="filter-sticky">
            <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport} parks={parks}/>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
              <Icon name="info" size={13} color="var(--ink-4)"/>
              Showing data for{' '}
              <strong style={{ color: 'var(--ink)' }}>{scopeLabel(appliedFilters, parkCount)}</strong>{' '}
              (<strong style={{ color: 'var(--ink)' }}>{appliedFilters.range}</strong>)
              <span className="spacer"/>
              {loading && <span className="tag amber">Refreshing widgets…</span>}
              {appliedFilters.compare && (
                <span className="tag teal">
                  Comparing to {prevPeriodLabel(appliedFilters.range, appliedFilters.date, appliedFilters.dateEnd)}
                </span>
              )}
              <ExportMenu onExport={onExport} appliedFilters={appliedFilters}/>
            </div>
          </div>

          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .25s', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ROW 1 — 3 KPI cards with mini sparklines */}
            {(() => {
              const comparing  = kpis?.deltaLabel != null;

              const kpiActions = (items, filename, headers, rowsFn) => (
                <>
                  <button className="btn btn-sm icon-btn" title="Download CSV" disabled={!items.length}
                    onClick={() => downloadCSV(filename, headers, rowsFn(items))}>
                    <Icon name="download" size={13}/>
                  </button>
                </>
              );

              return (
                <div className="dashboard-kpi-grid">
                  <KpiCard
                    label="Total Revenue" icon="chart"
                    value={inrFull(catTotal || kpis?.totalRevenue || 0)}
                    delta={comparing ? kpis.deltaRevenue : null}
                    sparkData={sparkRev}
                    sparkColor="var(--teal)"
                    actions={kpiActions(revItems, 'revenue-by-park.csv',
                      ['Park', 'Revenue (INR)', 'Share (%)'],
                      (items) => { const t = items.reduce((s,i)=>s+i.value,0); return items.map(i=>[i.name, i.value.toFixed(2), t>0?((i.value/t)*100).toFixed(1):'0']); }
                    )}
                    extra={<ModernDonut rows={revItems} centerLabel="Revenue" centerValue={inrFull(catTotal || kpis?.totalRevenue || 0)} formatValue={inr} currency/>}
                  />
                  <KpiCard
                    label="Total Visitors" icon="users"
                    value={num(kpis?.totalVisitors)}
                    delta={comparing ? kpis.deltaVisitors : null}
                    sparkData={sparkVis}
                    sparkColor="var(--amber)"
                    actions={kpiActions(visItems, 'visitors-by-park.csv',
                      ['Park', 'Visitors', 'Share (%)'],
                      (items) => { const t = items.reduce((s,i)=>s+i.value,0); return items.map(i=>[i.name, i.value, t>0?((i.value/t)*100).toFixed(1):'0']); }
                    )}
                    extra={<ModernDonut rows={visItems} centerLabel="Visitors" centerValue={num(kpis?.totalVisitors)} formatValue={num}/>}
                  />
                  <ParkHealthWidget parks={parks} filters={appliedFilters}/>
                </div>
              );
            })()}

            {/* ROW 2 — Revenue breakdowns (full width, high priority data) */}
            <div className="grid-3col">
              <RevenueBarCard
                title="Revenue by Category"
                items={revenueSplits?.byCategory || []}
                colorMap={COLOR_MAPS.category}
                compare={appliedFilters.compare}
                range={appliedFilters.range}
                date={appliedFilters.date}
                dateEnd={appliedFilters.dateEnd}
              />
              <RevenueBarCard
                title="Revenue by Payment Mode"
                items={revenueSplits?.byPayment || []}
                colorMap={COLOR_MAPS.payment}
                compare={appliedFilters.compare}
                range={appliedFilters.range}
                date={appliedFilters.date}
                dateEnd={appliedFilters.dateEnd}
              />
              <RevenueBarCard
                title="Revenue by Source"
                items={tixItems}
                colorMap={COLOR_MAPS.source}
                compare={appliedFilters.compare}
                range={appliedFilters.range}
                date={appliedFilters.date}
                dateEnd={appliedFilters.dateEnd}
              />
            </div>

            {/* ROW 3 — Top Performing Parks (detailed leaderboard, full width) */}
            <TopPerformingParks
              parks={topParksRev}
              selectedParks={appliedFilters.parks || []}
              compare={appliedFilters.compare}
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
