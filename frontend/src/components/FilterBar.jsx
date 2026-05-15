'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function FilterBar({ filters, setFilters, onApply, onExport, showCity = true }) {
  const [parks,      setParks]      = useState([]);
  const [exportOpen, setExportOpen] = useState(false);

  // Fetch all parks from DB on mount — single source of truth for all dropdowns
  useEffect(() => {
    fetch(`${BASE}/api/dashboard/parks`)
      .then(r => r.json())
      .then(setParks)
      .catch(err => console.error('[FilterBar] Failed to load parks:', err));
  }, []);

  // Click-outside closes export menu
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.menu-wrap')) setExportOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Derived options (all from parks data, nothing hardcoded) ─────────────
  const allStates = [...new Set(parks.map(p => p.state))].sort();

  const cityOptions = filters.state !== 'All States'
    ? [...new Set(parks.filter(p => p.state === filters.state).map(p => p.city))].sort()
    : [...new Set(parks.map(p => p.city))].sort();

  // Parks visible in the park dropdown — filtered by current state + city selection
  const visibleParks = parks.filter(p => {
    if (filters.state !== 'All States' && p.state !== filters.state) return false;
    if (filters.city  !== 'All Cities' && p.city  !== filters.city)  return false;
    return true;
  });

  // ── Cascade handlers ──────────────────────────────────────────────────────
  const onParkChange = (name) => {
    if (name === 'All Parks') {
      setFilters(f => ({ ...f, park: 'All Parks' }));
    } else {
      const p = parks.find(pk => pk.name === name);
      // Auto-set state and city from the selected park's record
      setFilters(f => ({ ...f, park: name, state: p?.state ?? f.state, city: p?.city ?? f.city }));
    }
  };

  const onStateChange = (state) => {
    // Narrowing state resets city and park (they may not exist in the new state)
    setFilters(f => ({ ...f, state, city: 'All Cities', park: 'All Parks' }));
  };

  const onCityChange = (city) => {
    if (city === 'All Cities') {
      setFilters(f => ({ ...f, city: 'All Cities' }));
    } else {
      const p = parks.find(pk => pk.city === city);
      // Auto-set state from the city's park record; reset park (city may span multiple parks)
      setFilters(f => ({ ...f, city, state: p?.state ?? f.state, park: 'All Parks' }));
    }
  };

  const onReset = () => {
    setFilters(f => ({
      park: 'All Parks', state: 'All States', city: 'All Cities',
      range: 'Last 7 days', compare: f.compare,
    }));
  };

  return (
    <div className="filterbar">

      {/* Park — grouped by state using <optgroup> */}
      <div className="filter">
        <label className="filter-label">Park</label>
        <select className="filter-select" value={filters.park} onChange={e => onParkChange(e.target.value)}>
          <option value="All Parks">All Parks</option>
          {visibleParks.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      {/* State */}
      <div className="filter">
        <label className="filter-label">State</label>
        <select className="filter-select" value={filters.state} onChange={e => onStateChange(e.target.value)}>
          <option value="All States">All States</option>
          {allStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* City — scoped to selected state */}
      {showCity && (
        <div className="filter">
          <label className="filter-label">City</label>
          <select className="filter-select" value={filters.city} onChange={e => onCityChange(e.target.value)}>
            <option value="All Cities">All Cities</option>
            {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Date Range */}
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

      {/* Date (static for now — no dynamic date picker yet) */}
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

      <button className="btn btn-ghost" onClick={onReset}>Reset</button>

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
