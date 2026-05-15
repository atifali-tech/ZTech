'use client';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
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

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

const DEFAULT_FILTERS = {
  park: 'All Parks', state: 'All States', cities: [],
  range: 'Last 7 days', date: todayStr, compare: false,
};

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

export default function Dashboard({ kpis: initKpis, revenueSplits: initRevenueSplits, hourly: initHourly, topParks: initTopParks }) {
  const [kpis,          setKpis]          = useState(initKpis);
  const [revenueSplits, setRevenueSplits] = useState(initRevenueSplits);
  const [hourly,        setHourly]        = useState(initHourly);
  const [topParks,      setTopParks]      = useState(initTopParks);

  const [filters,        setFilters]        = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [loading,        setLoading]        = useState(false);
  const [exportToast,    setExportToast]    = useState(null);
  const [parkCount, setParkCount] = useState(null);

  useEffect(() => {
    api.parks().then(ps => setParkCount(ps.length)).catch(() => {});
  }, []);

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

  useEffect(() => { fetchData(DEFAULT_FILTERS); }, []);

  const onApply = async () => {
    await fetchData(filters);
    setAppliedFilters(filters);
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
          <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport}/>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)' }}>
            <Icon name="info" size={13} color="var(--ink-4)"/>
            Showing data for{' '}
            <strong style={{ color: 'var(--ink)' }}>
              {(() => {
                const { park, state, cities } = appliedFilters;
                if (park !== 'All Parks') return park;
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

          <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity .25s' }}>
            <KpiRow data={kpis} revenueSplits={revenueSplits} topParks={topParks}/>
          </div>

          <div className="grid-2col">
            <HourlyChart data={hourly}/>
            <ParkPerformance topParks={topParks}/>
          </div>
          <div className="grid-2col">
            <RevenueSummary revenueSplits={revenueSplits}/>
            <TopParksRow topParks={topParks}/>
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
