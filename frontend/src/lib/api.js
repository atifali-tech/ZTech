const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

// Serialize filter object to a query string.
// Omits keys whose value is the "All ..." sentinel so the backend sees no param.
function qs(filters) {
  if (!filters) return '';
  const p = {};
  if (filters.park  && filters.park  !== 'All Parks')  p.park  = filters.park;
  if (filters.state && filters.state !== 'All States') p.state = filters.state;
  if (filters.city  && filters.city  !== 'All Cities') p.city  = filters.city;
  if (filters.range)                                   p.range = filters.range;
  const str = new URLSearchParams(p).toString();
  return str ? `?${str}` : '';
}

export const api = {
  kpis:          (f) => get(`/api/dashboard/kpis${qs(f)}`),
  demographics:  (f) => get(`/api/dashboard/demographics${qs(f)}`),
  revenueSplits: (f) => get(`/api/dashboard/revenue-splits${qs(f)}`),
  hourly:        (f) => get(`/api/dashboard/hourly${qs(f)}`),
  heatmap:       (f) => get(`/api/dashboard/heatmap${qs(f)}`),
  weekendWeekday:(f) => get(`/api/dashboard/weekend-weekday${qs(f)}`),
  comparative:   (f) => get(`/api/dashboard/comparative${qs(f)}`),
  topParks:      (f) => get(`/api/dashboard/top-parks${qs(f)}`),
  revenueTrend:  (f) => get(`/api/dashboard/revenue-trend${qs(f)}`),
  parks:         ()  => get('/api/dashboard/parks'),
  tickets: (params = {}) => {
    const s = new URLSearchParams(params).toString();
    return get(`/api/tickets?${s}`);
  },
};
