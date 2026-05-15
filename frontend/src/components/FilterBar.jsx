'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';
import CityDropdown from './CityDropdown';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Main FilterBar ────────────────────────────────────────────────────────────
export default function FilterBar({ filters, setFilters, onApply, showCity = true }) {
  const [parks, setParks] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/api/dashboard/parks`)
      .then(r => r.json())
      .then(setParks)
      .catch(err => console.error('[FilterBar] Failed to load parks:', err));
  }, []);

  // ── Derived options ───────────────────────────────────────────────────────
  const allStates = [...new Set(parks.map(p => p.state))].sort();

  const cityOptions = filters.state !== 'All States'
    ? [...new Set(parks.filter(p => p.state === filters.state).map(p => p.city))].sort()
    : [...new Set(parks.map(p => p.city))].sort();

  const visibleParks = parks.filter(p => {
    if (filters.state !== 'All States' && p.state !== filters.state) return false;
    if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false;
    return true;
  });

  // ── Smart cascade helpers ─────────────────────────────────────────────────
  const autoPark = (cityList, stateFilter) => {
    if (cityList.length !== 1) return 'All Parks';
    const city = cityList[0];
    const inCity = parks.filter(p =>
      p.city === city && (stateFilter === 'All States' || p.state === stateFilter)
    );
    return inCity.length === 1 ? inCity[0].name : 'All Parks';
  };

  // ── Cascade handlers ──────────────────────────────────────────────────────
  const onParkChange = (name) => {
    if (name === 'All Parks') {
      setFilters(f => ({ ...f, park: 'All Parks' }));
    } else {
      const p = parks.find(pk => pk.name === name);
      setFilters(f => ({
        ...f,
        park:   name,
        state:  p?.state  ?? f.state,
        cities: p?.city ? [p.city] : f.cities,
      }));
    }
  };

  const onStateChange = (state) => {
    if (state === 'All States') {
      setFilters(f => ({ ...f, state, cities: [], park: 'All Parks' }));
      return;
    }
    const citiesInState = [...new Set(parks.filter(p => p.state === state).map(p => p.city))].sort();
    if (citiesInState.length === 1) {
      const city = citiesInState[0];
      const park = autoPark([city], state);
      setFilters(f => ({ ...f, state, cities: [city], park }));
    } else {
      setFilters(f => ({ ...f, state, cities: [], park: 'All Parks' }));
    }
  };

  const onCitiesChange = (selectedCities) => {
    const park = autoPark(selectedCities, filters.state);
    setFilters(f => ({ ...f, cities: selectedCities, park }));
  };

  const onReset = () => {
    const d = new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    setFilters(f => ({
      park: 'All Parks', state: 'All States', cities: [],
      range: 'Last 7 days', date: ds, compare: f.compare,
    }));
  };

  return (
    <div className="filterbar">

      {/* Park */}
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

      {/* City — checkbox multi-select */}
      {showCity && (
        <div className="filter">
          <label className="filter-label">City</label>
          <CityDropdown options={cityOptions} selected={filters.cities} onChange={onCitiesChange}/>
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

      {/* Date */}
      <div className="filter" style={{ maxWidth: 170 }}>
        <label className="filter-label">Date</label>
        <select className="filter-select" value={filters.date}
          onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}>
          {Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            return <option key={val} value={val}>{label}</option>;
          })}
        </select>
      </div>

      <div style={{ flex: '0 0 1px', alignSelf: 'stretch', background: 'var(--border)', margin: '0 4px', marginTop: 14 }}/>

      <button className={'compare-toggle' + (filters.compare ? ' on' : '')}
        onClick={() => setFilters(f => ({ ...f, compare: !f.compare }))}>
        <span className="switch"/>
        Compare to <span className="mono" style={{ color: 'var(--ink-3)', fontStyle: 'normal' }}>Prev. Period</span>
      </button>

      <button className="btn btn-ghost" onClick={onReset}>Reset</button>

      <button className="btn btn-primary" onClick={onApply}>
        <Icon name="filter" size={13} color="#fff"/> Apply
      </button>

    </div>
  );
}
