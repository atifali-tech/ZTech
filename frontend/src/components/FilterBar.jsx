'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

const PARKS_LIST = ['Jungle Trail', 'UP Darshan', 'Delhi Park', 'Rann Bagh', 'Konark Kids'];
const STATES = ['Uttar Pradesh', 'Delhi', 'Gujarat', 'Odisha'];
const STATE_CITIES = {
  'Uttar Pradesh': ['Noida', 'Lucknow'],
  'Delhi':         ['New Delhi'],
  'Gujarat':       ['Ahmedabad'],
  'Odisha':        ['Bhubaneswar'],
};

export default function FilterBar({ filters, setFilters, onApply, onExport }) {
  const [exportOpen, setExportOpen] = useState(false);
  const cities = filters.state === 'All States'
    ? ['All Cities', 'Noida', 'Lucknow', 'New Delhi', 'Ahmedabad', 'Bhubaneswar']
    : ['All Cities', ...(STATE_CITIES[filters.state] || [])];

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.menu-wrap')) setExportOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="filterbar">
      <div className="filter">
        <label className="filter-label">Park</label>
        <select className="filter-select" value={filters.park}
          onChange={e => setFilters(f => ({ ...f, park: e.target.value }))}>
          <option>All Parks</option>
          {PARKS_LIST.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div className="filter">
        <label className="filter-label">State</label>
        <select className="filter-select" value={filters.state}
          onChange={e => setFilters(f => ({ ...f, state: e.target.value, city: 'All Cities' }))}>
          <option>All States</option>
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="filter">
        <label className="filter-label">City</label>
        <select className="filter-select" value={filters.city}
          onChange={e => setFilters(f => ({ ...f, city: e.target.value }))}>
          {cities.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="filter">
        <label className="filter-label">Date Range</label>
        <select className="filter-select" value={filters.range}
          onChange={e => setFilters(f => ({ ...f, range: e.target.value }))}>
          <option>Today</option>
          <option>Yesterday</option>
          <option>Last 7 days</option>
          <option>Last 30 days</option>
          <option>This Quarter</option>
          <option>This Year</option>
          <option>Custom…</option>
        </select>
      </div>
      <div className="filter" style={{ maxWidth: 170 }}>
        <label className="filter-label">Date</label>
        <select className="filter-select" defaultValue="05 May 2026">
          <option>05 May 2026</option>
          <option>04 May 2026</option>
          <option>03 May 2026</option>
        </select>
      </div>

      <div style={{ flex: '0 0 1px', alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px', marginTop: 14 }}/>

      <button className={'compare-toggle' + (filters.compare ? ' on' : '')}
        onClick={() => setFilters(f => ({ ...f, compare: !f.compare }))}>
        <span className="switch"/>
        Compare to <span className="mono" style={{ color: 'var(--ink-3)' }}>prev period</span>
      </button>

      <button className="btn btn-ghost"
        onClick={() => setFilters({ park: 'All Parks', state: 'All States', city: 'All Cities', range: 'Last 7 days', compare: filters.compare })}>
        Reset
      </button>
      <button className="btn btn-primary" onClick={onApply}>
        <Icon name="filter" size={13} color="#fff"/> Apply
      </button>

      <div className="menu-wrap">
        <button className="btn" onClick={e => { e.stopPropagation(); setExportOpen(o => !o); }}>
          <Icon name="download" size={13}/> Export
          <Icon name="chevron" size={11} color="var(--ink-4)"/>
        </button>
        {exportOpen && (
          <div className="menu" onClick={() => setExportOpen(false)}>
            <button onClick={() => onExport('CSV')}>Download as CSV <span className="kbd">⌘E</span></button>
            <button onClick={() => onExport('Excel')}>Download as Excel</button>
            <div className="menu-sep"/>
            <button onClick={() => onExport('DSR')}><Icon name="file" size={13}/> DSR Report (Daily)</button>
            <button onClick={() => onExport('FY-DSR')}><Icon name="file" size={13}/> FY DSR Report</button>
          </div>
        )}
      </div>
    </div>
  );
}
