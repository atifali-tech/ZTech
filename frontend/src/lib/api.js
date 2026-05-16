const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', credentials: 'include' });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || `POST ${path} failed`); }
  return res.json();
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || `PUT ${path} failed`); }
  return res.json();
}

async function del(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || `DELETE ${path} failed`); }
  return res.json();
}

// Serialize filter object to a query string.
// Omits keys whose value is the "All ..." sentinel so the backend sees no param.
function qs(filters) {
  if (!filters) return '';
  const p = new URLSearchParams();
  if (filters.park  && filters.park  !== 'All Parks')  p.set('park',  filters.park);
  if (filters.state && filters.state !== 'All States') p.set('state', filters.state);
  if (filters.cities && filters.cities.length > 0) filters.cities.forEach(c => p.append('city', c));
  if (filters.range)   p.set('range',   filters.range);
  if (filters.date)    p.set('date',    filters.date);
  if (filters.dateEnd) p.set('dateEnd', filters.dateEnd);
  if (filters.compare) p.set('compare', 'true');
  const str = p.toString();
  return str ? `?${str}` : '';
}

export const api = {
  // Dashboard data
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

  // Auth
  login:          (body) => post('/api/auth/login', body),
  logout:         ()     => post('/api/auth/logout', {}),
  me:             ()     => get('/api/auth/me'),
  changePassword: (body) => post('/api/auth/change-password', body),

  // Users CRUD
  users:        ()       => get('/api/users'),
  user:         (id)     => get(`/api/users/${id}`),
  createUser:   (body)   => post('/api/users', body),
  updateUser:   (id, b)  => put(`/api/users/${id}`, b),
  deleteUser:   (id)     => del(`/api/users/${id}`),

  // Parks CRUD
  allParks:     ()       => get('/api/parks'),
  park:         (id)     => get(`/api/parks/${id}`),
  createPark:   (body)   => post('/api/parks', body),
  updatePark:   (id, b)  => put(`/api/parks/${id}`, b),
  deletePark:   (id)     => del(`/api/parks/${id}`),
};
