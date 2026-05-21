import { useState, useEffect } from 'react';
import { api } from './api';
import { computeDefaultDates } from './filterDefaults';

// Canonical default filter shape — always use parks[] array, never park string.
// Both Dashboard and Analytics use this to stay consistent with FilterBar's output.
export function makeDefaultFilters(range = 'Monthly') {
  const { date, dateEnd } = computeDefaultDates(range);
  return {
    parks:   [],
    state:   'All States',
    cities:  [],
    range,
    date,
    dateEnd,
    compare: false,
  };
}

// Shared filter state used by Dashboard and Analytics pages.
// Encapsulates: pending filters (UI), applied filters (data), loading flag, park count.
// onApply / onReset remain in each page because they trigger page-specific data fetches.
export function useFilterState(defaultRange = 'Monthly') {
  const initial = makeDefaultFilters(defaultRange);
  const [filters,        setFilters]        = useState(initial);
  const [appliedFilters, setAppliedFilters] = useState(initial);
  const [loading,        setLoading]        = useState(false);
  const [parks,          setParks]          = useState([]);
  const [parkCount,      setParkCount]      = useState(null);

  useEffect(() => {
    api.parks()
      .then(ps => { setParks(ps); setParkCount(ps.length); })
      .catch(() => {});
  }, []);

  return { filters, setFilters, appliedFilters, setAppliedFilters, loading, setLoading, parks, parkCount };
}

// Build the human-readable scope label shown below the FilterBar.
export function scopeLabel(appliedFilters, parkCount) {
  const { parks, state, cities } = appliedFilters;
  if (parks && parks.length === 1)  return parks[0];
  if (parks && parks.length > 1 && parks.length <= 3) return parks.join(', ');
  if (parks && parks.length > 3)    return `${parks.slice(0, 2).join(', ')} +${parks.length - 2}`;
  if (state === 'All States' && (!cities || cities.length === 0))
    return `All${parkCount != null ? ` ${parkCount}` : ''} parks`;
  if (state !== 'All States' && (!cities || cities.length === 0))
    return `All parks · ${state}`;
  if (cities && cities.length === 1)
    return `${cities[0]}${state !== 'All States' ? `, ${state}` : ''}`;
  if (cities && cities.length <= 3)
    return `${cities.join(', ')}${state !== 'All States' ? ` · ${state}` : ''}`;
  return `${cities.slice(0, 2).join(', ')} +${cities.length - 2}${state !== 'All States' ? ` · ${state}` : ''}`;
}
