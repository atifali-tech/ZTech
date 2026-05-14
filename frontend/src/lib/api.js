const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  kpis:          () => get('/api/dashboard/kpis'),
  demographics:  () => get('/api/dashboard/demographics'),
  revenueSplits: () => get('/api/dashboard/revenue-splits'),
  hourly:        () => get('/api/dashboard/hourly'),
  heatmap:       () => get('/api/dashboard/heatmap'),
  weekendWeekday:() => get('/api/dashboard/weekend-weekday'),
  comparative:   () => get('/api/dashboard/comparative'),
  topParks:      () => get('/api/dashboard/top-parks'),
  revenueTrend:  () => get('/api/dashboard/revenue-trend'),
  parks:         () => get('/api/dashboard/parks'),
  tickets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/api/tickets?${qs}`);
  },
};
