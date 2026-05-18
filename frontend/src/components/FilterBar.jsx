'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';
import CityDropdown from './CityDropdown';
import DatePicker    from './DatePicker';
import WeekPicker    from './WeekPicker';
import MonthPicker   from './MonthPicker';
import QuarterPicker from './QuarterPicker';
import YearPicker    from './YearPicker';

const BASE   = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const RANGES = ['Daily','Weekly','Monthly','Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months','Custom Range'];

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function computeDefaultDates(range) {
  const today = new Date(); today.setHours(0,0,0,0);
  const ts = toStr(today);
  switch (range) {
    case 'Daily':   return { date: ts, dateEnd: ts };
    case 'Weekly': {
      const mon = new Date(today); mon.setDate(today.getDate()-(today.getDay()+6)%7);
      return { date: toStr(mon), dateEnd: ts };
    }
    case 'Monthly': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Quarterly': {
      const s = new Date(today.getFullYear(), Math.floor(today.getMonth()/3)*3, 1);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Yearly': {
      return { date: `${today.getFullYear()}-01-01`, dateEnd: ts };
    }
    case 'Last 3 Months': {
      const s = new Date(today); s.setMonth(s.getMonth()-3);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Last 6 Months': {
      const s = new Date(today); s.setMonth(s.getMonth()-6);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Last 12 Months': {
      const s = new Date(today); s.setFullYear(s.getFullYear()-1);
      return { date: toStr(s), dateEnd: ts };
    }
    default: return { date: ts, dateEnd: ts };
  }
}

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
export default function FilterBar({ filters, setFilters, onApply, showCity = true }) {
  const [parks, setParks] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/api/dashboard/parks`)
      .then(r => r.json())
      .then(setParks)
      .catch(err => console.error('[FilterBar] Failed to load parks:', err));
  }, []);

  const allStates = [...new Set(parks.map(p => p.state))].sort();

  const cityOptions = filters.state !== 'All States'
    ? [...new Set(parks.filter(p=>p.state===filters.state).map(p=>p.city))].sort()
    : [...new Set(parks.map(p=>p.city))].sort();

  const visibleParks = parks.filter(p => {
    if (filters.state !== 'All States' && p.state !== filters.state) return false;
    if (filters.cities.length > 0 && !filters.cities.includes(p.city)) return false;
    return true;
  });

  const autoPark = (cityList, stateFilter) => {
    if (cityList.length !== 1) return 'All Parks';
    const inCity = parks.filter(p => p.city===cityList[0] && (stateFilter==='All States'||p.state===stateFilter));
    return inCity.length === 1 ? inCity[0].name : 'All Parks';
  };

  const onParkChange = (name) => {
    if (name === 'All Parks') { setFilters(f=>({...f,park:'All Parks'})); return; }
    const p = parks.find(pk=>pk.name===name);
    setFilters(f=>({...f,park:name,state:p?.state??f.state,cities:p?.city?[p.city]:f.cities}));
  };

  const onStateChange = (state) => {
    if (state === 'All States') { setFilters(f=>({...f,state,cities:[],park:'All Parks'})); return; }
    const citiesInState = [...new Set(parks.filter(p=>p.state===state).map(p=>p.city))].sort();
    if (citiesInState.length===1) {
      const city = citiesInState[0];
      setFilters(f=>({...f,state,cities:[city],park:autoPark([city],state)}));
    } else {
      setFilters(f=>({...f,state,cities:[],park:'All Parks'}));
    }
  };

  const onCitiesChange = (selectedCities) => {
    setFilters(f=>({...f,cities:selectedCities,park:autoPark(selectedCities,f.state)}));
  };

  const onRangeChange = (range) => {
    const { date, dateEnd } = computeDefaultDates(range);
    setFilters(f=>({...f,range,date,dateEnd}));
  };

  const onReset = () => {
    const { date, dateEnd } = computeDefaultDates('Monthly');
    const resetF = { park: 'All Parks', state: 'All States', cities: [], range: 'Monthly', date, dateEnd, compare: filters.compare };
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
        <select className="filter-select" value={filters.park} onChange={e=>onParkChange(e.target.value)}>
          <option value="All Parks">All Parks</option>
          {visibleParks.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
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
          ({ Daily: 'Yesterday', Weekly: 'Previous Week', Monthly: 'Previous Month',
             Quarterly: 'Previous Quarter', Yearly: 'Previous Year',
             'Last 3 Months': 'Prev. 3 Months', 'Last 6 Months': 'Prev. 6 Months',
             'Last 12 Months': 'Prev. 12 Months' })[filters.range] || 'Previous Period'
        }</span>
      </button>

      <button className="btn btn-ghost" onClick={onReset}>Reset</button>

      <button className="btn btn-primary" onClick={() => onApply()}>
        <Icon name="filter" size={13} color="#fff"/> Apply
      </button>

    </div>
  );
}
