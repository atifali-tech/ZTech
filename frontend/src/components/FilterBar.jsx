'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';
import CityDropdown from './CityDropdown';
import ParkDropdown from './ParkDropdown';
import DatePicker    from './DatePicker';
import WeekPicker    from './WeekPicker';
import MonthPicker   from './MonthPicker';
import QuarterPicker from './QuarterPicker';
import YearPicker    from './YearPicker';
import { api } from '../lib/api';
import { computeDefaultDates, makeDefaultFilters } from '../lib/filterDefaults';

const RANGES = ['Daily','Weekly','Monthly','Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months','Custom Range'];

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function addDays(str, n) {
  const d = new Date(str + 'T00:00:00'); d.setDate(d.getDate() + n); return d;
}
function prevPeriodShort(range, date) {
  if (!date) return 'Previous Period';
  switch (range) {
    case 'Daily': {
      const d = addDays(date, -1);
      return `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    case 'Weekly': {
      const s = addDays(date, -7), e = addDays(date, -1);
      return `${MO[s.getMonth()]} ${s.getDate()} – ${MO[e.getMonth()]} ${e.getDate()}`;
    }
    case 'Monthly': {
      const d = new Date(date + 'T00:00:00');
      const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return `${MO[p.getMonth()]} ${p.getFullYear()}`;
    }
    case 'Quarterly': {
      const d = new Date(date + 'T00:00:00');
      const q = Math.floor(d.getMonth() / 3);
      return q === 0 ? `Q4 ${d.getFullYear() - 1}` : `Q${q} ${d.getFullYear()}`;
    }
    case 'Yearly': {
      return `${new Date(date + 'T00:00:00').getFullYear() - 1}`;
    }
    case 'Last 3 Months':  return 'Prev. 3 Months';
    case 'Last 6 Months':  return 'Prev. 6 Months';
    case 'Last 12 Months': return 'Prev. 12 Months';
    default: return 'Previous Period';
  }
}

function fmtRolling(a, b) {
  if (!a || !b) return '';
  const s = new Date(a+'T00:00:00'), e = new Date(b+'T00:00:00');
  const sy = s.getFullYear(), ey = e.getFullYear();
  const sm = MO[s.getMonth()], em = MO[e.getMonth()];
  if (sy === ey) return `${sm} – ${em} ${ey}`;
  return `${sm} '${String(sy).slice(2)} – ${em} '${String(ey).slice(2)}`;
}

function dateLabel(range) {
  const MAP = { Daily:'Select Day', Weekly:'Select Week', Monthly:'Select Month', Quarterly:'Select Quarter', Yearly:'Select Year' };
  return MAP[range] || 'Period';
}

// ── Main FilterBar ────────────────────────────────────────────────────────────
export default function FilterBar({ filters, setFilters, onApply, showCity = true, parks: parksProp }) {
  const [parksOwned, setParksOwned] = useState([]);

  useEffect(() => {
    if (parksProp !== undefined) return; // parent supplies parks via useFilterState — skip fetch
    api.parks()
      .then(setParksOwned)
      .catch(err => console.error('[FilterBar] Failed to load parks:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const parks = parksProp !== undefined ? parksProp : parksOwned;

  // Server already returns only the parks this user may access — no client-side re-filter needed.
  const allStates = [...new Set(parks.map(p => p.state))].sort();

  const cityOptions = filters.state !== 'All States'
    ? [...new Set(parks.filter(p=>p.state===filters.state).map(p=>p.city))].sort()
    : [...new Set(parks.map(p=>p.city))].sort();

  const visibleParks = parks.filter(p => {
    if (filters.state !== 'All States' && p.state !== filters.state) return false;
    if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false;
    return true;
  });

  const onParksChange = (selectedParks) => {
    setFilters(f => ({ ...f, parks: selectedParks }));
  };

  const onStateChange = (state) => {
    if (state === 'All States') { setFilters(f=>({...f,state,cities:[],parks:[]})); return; }
    const citiesInState = [...new Set(parks.filter(p=>p.state===state).map(p=>p.city))].sort();
    if (citiesInState.length===1) {
      setFilters(f=>({...f,state,cities:[citiesInState[0]],parks:[]}));
    } else {
      setFilters(f=>({...f,state,cities:[],parks:[]}));
    }
  };

  const onCitiesChange = (selectedCities) => {
    setFilters(f => ({ ...f, cities: selectedCities, parks: [] }));
  };

  const onRangeChange = (range) => {
    const { date, dateEnd } = computeDefaultDates(range);
    setFilters(f=>({...f,range,date,dateEnd}));
  };

  const onReset = () => {
    const resetF = makeDefaultFilters();
    setFilters(() => resetF);
    onApply(resetF);
  };

  const isRolling = ['Last 3 Months','Last 6 Months','Last 12 Months'].includes(filters.range);
  const isCustom  = filters.range === 'Custom Range';
  const setDate   = (date, dateEnd) => setFilters(f=>({...f,date,dateEnd:dateEnd??date}));

  return (
    <div className="filterbar">

      {/* Park */}
      <div className="filter">
        <label className="filter-label">Park</label>
        <ParkDropdown parks={visibleParks} selected={filters.parks || []} onChange={onParksChange}/>
      </div>

      {/* State */}
      <div className="filter">
        <label className="filter-label">State</label>
        <select className="filter-select" value={filters.state} onChange={e=>onStateChange(e.target.value)}>
          <option value="All States">All States</option>
          {allStates.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* City */}
      {showCity && (
        <div className="filter">
          <label className="filter-label">City</label>
          <CityDropdown options={cityOptions} selected={filters.cities} onChange={onCitiesChange}/>
        </div>
      )}

      {/* Date Range */}
      <div className="filter">
        <label className="filter-label">Date Range</label>
        <select className="filter-select" value={filters.range} onChange={e=>onRangeChange(e.target.value)}>
          {RANGES.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Date picker — changes based on range */}
      {isRolling ? (
        <div className="filter">
          <label className="filter-label">Period</label>
          <div className="picker-readonly">{fmtRolling(filters.date, filters.dateEnd)}</div>
        </div>
      ) : isCustom ? (
        <>
          <div className="filter">
            <label className="filter-label">Start Date</label>
            <DatePicker value={filters.date} onChange={d=>setFilters(f=>({...f,date:d}))}/>
          </div>
          <div className="filter">
            <label className="filter-label">End Date</label>
            <DatePicker value={filters.dateEnd} onChange={d=>setFilters(f=>({...f,dateEnd:d}))}/>
          </div>
        </>
      ) : (
        <div className="filter">
          <label className="filter-label">{dateLabel(filters.range)}</label>
          {filters.range==='Daily'     && <DatePicker    value={filters.date} onChange={d=>setDate(d,d)}/>}
          {filters.range==='Weekly'    && <WeekPicker    value={filters.date} valueEnd={filters.dateEnd} onChange={(d,de)=>setDate(d,de)}/>}
          {filters.range==='Monthly'   && <MonthPicker   value={filters.date} onChange={(d,de)=>setDate(d,de)}/>}
          {filters.range==='Quarterly' && <QuarterPicker value={filters.date} onChange={(d,de)=>setDate(d,de)}/>}
          {filters.range==='Yearly'    && <YearPicker    value={filters.date} onChange={(d,de)=>setDate(d,de)}/>}
        </div>
      )}

      <div style={{flex:'0 0 1px',alignSelf:'stretch',background:'var(--border)',margin:'0 4px',marginTop:14}}/>

      <button className={`compare-toggle${filters.compare?' on':''}`}
        onClick={()=>setFilters(f=>({...f,compare:!f.compare}))}>
        <span className="switch"/>
        vs. <span className="mono" style={{color:'var(--ink-3)',fontStyle:'normal'}}>{
          prevPeriodShort(filters.range, filters.date)
        }</span>
      </button>

      <button className="btn btn-primary" onClick={() => onApply()}>
        <Icon name="filter" size={13} color="#fff"/> Apply
      </button>

      <button className="btn btn-ghost" onClick={onReset}>Reset</button>

    </div>
  );
}
