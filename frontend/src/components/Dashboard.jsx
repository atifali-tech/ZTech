'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FilterBar from './FilterBar';
import KpiRow from './KpiRow';
import DemographicsSection from './Demographics';
import RevenueSplits from './RevenueSplits';
import HourlyChart from './HourlyChart';
import Heatmap from './Heatmap';
import WeekendWeekday from './WeekendWeekday';
import Comparative from './Comparative';
import TopParksRow from './TopParks';
import Icon from './Icon';
import { num } from '../lib/format';

export default function Dashboard({ kpis, demographics, revenueSplits, hourly, heatmap, weekendWeekday, comparative, topParks, revenueTrend }) {
  const [filters, setFilters] = useState({
    park: 'All Parks', state: 'All States', city: 'All Cities',
    range: 'Last 7 days', compare: false,
  });
  const [loading,     setLoading]     = useState(false);
  const [exportToast, setExportToast] = useState(null);

  const showComparative = filters.range === 'This Quarter' || filters.range === 'This Year';

  const onApply = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
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
              {filters.park === 'All Parks' ? 'All 5 parks' : filters.park}
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

          <DemographicsSection data={demographics}/>
          <RevenueSplits data={revenueSplits}/>
          <HourlyChart data={hourly}/>
          <Heatmap data={heatmap}/>
          <WeekendWeekday data={weekendWeekday}/>
          <Comparative data={comparative} visible={showComparative}/>
          <TopParksRow topParks={topParks} trendData={revenueTrend}/>

          <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 11, marginTop: 8 }}>
            ZingParks Ops Console v1.0 · Phase 1 · © NovoStack 2026
          </div>
        </div>
      </div>

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
