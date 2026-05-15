'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const DEFAULT_FILTERS = {
  park: 'All Parks', state: 'All States', city: 'All Cities',
  range: 'Last 7 days', compare: false,
};
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FilterBar from './FilterBar';
import KpiRow from './KpiRow';
import HourlyChart from './HourlyChart';
import TopParksRow from './TopParks';
import ParkPerformance from './ParkPerformance';
import RevenueSummary from './RevenueSummary';
import Icon from './Icon';
import BottomNav from './BottomNav';

export default function Dashboard({ kpis: initKpis, revenueSplits: initRevenueSplits, hourly: initHourly, topParks: initTopParks }) {
  const [kpis,          setKpis]          = useState(initKpis);
  const [revenueSplits, setRevenueSplits] = useState(initRevenueSplits);
  const [hourly,        setHourly]        = useState(initHourly);
  const [topParks,      setTopParks]      = useState(initTopParks);

  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);
  const [loading,     setLoading]     = useState(false);
  const [exportToast, setExportToast] = useState(null);

  const fetchData = async (f) => {
    setLoading(true);
    try {
      const [r0, r1, r2, r3] = await Promise.allSettled([
        api.kpis(f),
        api.revenueSplits(f),
        api.hourly(f),
        api.topParks(f),
      ]);
      if (r0.status === 'fulfilled') setKpis(r0.value);
      if (r1.status === 'fulfilled') setRevenueSplits(r1.value);
      if (r2.status === 'fulfilled') setHourly(r2.value);
      if (r3.status === 'fulfilled') setTopParks(r3.value);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(DEFAULT_FILTERS); }, []);

  const onApply = () => {
    fetchData(filters);
  };

  const onExport = (kind) => {
    setExportToast(`Exporting ${kind}…`);
    setTimeout(() => setExportToast(null), 2200);
  };

  return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <Topbar initialLiveCount={kpis?.liveCount || 1284}/>
        <div className="canvas">
          <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport}/>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-3)' }}>
            <Icon name="info" size={13} color="var(--ink-4)"/>
            Showing data for{' '}
            <strong style={{ color: 'var(--ink)' }}>
              {filters.park === 'All Parks' ? 'All 7 parks' : filters.park}
            </strong>{' '}
            · {filters.range.toLowerCase()} · Last refreshed -{' '}
            <span className="mono">2 mins ago</span>
            <span className="spacer"/>
            {loading && <span className="tag amber">Refreshing widgets…</span>}
            {filters.compare && <span className="tag teal">Comparing to previous period</span>}
          </div>

          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .25s' }}>
            <KpiRow data={kpis} revenueSplits={revenueSplits}/>
          </div>

          <div className="grid-2col">
            <HourlyChart data={hourly}/>
            <ParkPerformance/>
          </div>
          <div className="grid-2col">
            <RevenueSummary revenueSplits={revenueSplits}/>
            <TopParksRow topParks={topParks}/>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 11, marginTop: 8 }}>
            ZingParks Ops Console v1.0 · Phase 1 · © NovoStack 2026
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
