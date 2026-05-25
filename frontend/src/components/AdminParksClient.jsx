'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter }     from 'next/navigation';
import Sidebar           from './Sidebar';
import Topbar            from './Topbar';
import Icon              from './Icon';
import Toast             from './Toast';
import ConfirmDialog     from './ConfirmDialog';
import ParkFormModal     from './ParkFormModal';
import ParkMoreMenu      from './ParkMoreMenu';
import { useAuth }       from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Health classification (mirrors ParkHealthWidget logic) ────────────────────
function computeSetupPct(c) {
  const checks = [c.zones > 0, c.gates > 0, c.counters > 0, c.devices > 0, c.pricing_rules > 0, c.users > 0];
  return (checks.filter(Boolean).length / checks.length) * 100;
}

function classifyPark(c) {
  if (!c) return null;
  if (c.pricing_rules === 0 || c.zones === 0 || c.users === 0) return 'Attention Required';
  const pct = computeSetupPct(c);
  if (pct >= 80) return 'Operational';
  if (pct >= 20) return 'Setup In Progress';
  return 'Draft';
}

const STATUS_CFG = {
  'Operational':        { color: '#1F8A4A', bg: '#E6F4EC', border: '#B3DEC1',             label: 'Operational'        },
  'Setup In Progress':  { color: '#8A5E0B', bg: '#FCF5E4', border: 'var(--amber-100)',    label: 'Setup In Progress'  },
  'Attention Required': { color: '#C53A2B', bg: 'var(--red-50)', border: 'var(--red-100)', label: 'Attention Required' },
  'Draft':              { color: '#5A6070', bg: 'var(--surface-2)', border: 'var(--border)', label: 'Draft'           },
};

// ── Small reusable primitives ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (!status) return <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>;
  const cfg = STATUS_CFG[status] || STATUS_CFG['Draft'];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }}/>
      {cfg.label}
    </span>
  );
}

function HealthPct({ pct }) {
  if (pct == null) return <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>;
  const color = pct >= 80 ? '#1F8A4A' : pct >= 50 ? '#D89614' : '#C53A2B';
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color }}>
      {Math.round(pct)}%
    </span>
  );
}

function PricingBadge({ n }) {
  if (n == null) return <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>;
  if (n > 0) return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: '#1F8A4A',
      background: '#E6F4EC', border: '1px solid #B3DEC1',
      borderRadius: 4, padding: '2px 7px',
    }}>Configured</span>
  );
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: '#8A5E0B',
      background: '#FCF5E4', border: '1px solid var(--amber-100)',
      borderRadius: 4, padding: '2px 7px',
    }}>Missing</span>
  );
}


function SortArrow({ field, sort }) {
  const active = sort.field === field;
  const asc  = active && sort.dir === 'asc';
  const desc = active && sort.dir === 'desc';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, marginLeft: 5, verticalAlign: 'middle', lineHeight: 1 }}>
      <svg width="7" height="5" viewBox="0 0 7 5" fill={asc ? 'var(--teal)' : (active ? 'var(--ink-4)' : 'var(--ink-5)')} style={{ display: 'block' }}>
        <path d="M3.5 0L7 5H0z"/>
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" fill={desc ? 'var(--teal)' : (active ? 'var(--ink-4)' : 'var(--ink-5)')} style={{ display: 'block' }}>
        <path d="M3.5 5L0 0h7z"/>
      </svg>
    </span>
  );
}

// ── Summary card for the top strip ────────────────────────────────────────────
function SummaryCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '14px 18px',
      display: 'flex', flexDirection: 'column', gap: 4, flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={12} color="var(--ink-4)"/>
        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--ink)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AdminParksClient() {
  const router = useRouter();
  const { can } = useAuth();

  const [parks,        setParks]        = useState([]);
  const [summaries,    setSummaries]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [denied,       setDenied]       = useState(false);
  const [modal,        setModal]        = useState(null);   // null | 'create' | park object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast,        setToast]        = useState({ msg: null, type: 'ok' });
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity,   setFilterCity]   = useState('');
  const [filterState,  setFilterState]  = useState('');
  const [sort,         setSort]         = useState({ field: 'name', dir: 'asc' });
  const [page,         setPage]         = useState(1);
  const PAGE_SIZE = 15;

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    setDenied(false);
    try {
      const data = await apiFetch('/api/parks');
      setParks(data);
      data.forEach(p => {
        apiFetch(`/api/parks/${p.id}/summary`)
          .then(s => setSummaries(prev => ({ ...prev, [p.id]: s })))
          .catch(() => {});
      });
    } catch (err) {
      if (err.message?.includes('Permission denied') || err.message?.includes('denied')) setDenied(true);
      else showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, []);

  // ── Derived row data ─────────────────────────────────────────────────────────
  const rows = useMemo(() => parks.map(p => {
    const s = summaries[p.id];
    const c = s?.counts;
    const status  = c ? classifyPark(c) : null;
    const health  = c ? computeSetupPct(c) : null;
    return { ...p, counts: c, status, health, loaded: !!s, manager: s?.park_manager ?? null };
  }), [parks, summaries]);

  // ── Filter options ────────────────────────────────────────────────────────────
  const cityOptions  = useMemo(() => {
    const source = filterState ? parks.filter(p => p.state === filterState) : parks;
    return [...new Set(source.map(p => p.city).filter(Boolean))].sort();
  }, [parks, filterState]);
  const stateOptions = useMemo(() => [...new Set(parks.map(p => p.state).filter(Boolean))].sort(), [parks]);

  // ── Filtered + sorted rows ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (filterStatus) result = result.filter(r => r.status === filterStatus);
    if (filterCity)   result = result.filter(r => r.city === filterCity);
    if (filterState)  result = result.filter(r => r.state === filterState);
    return result;
  }, [rows, search, filterStatus, filterCity, filterState]);

  const sorted = useMemo(() => {
    const STATUS_ORDER = { 'Attention Required': 0, 'Setup In Progress': 1, 'Draft': 2, 'Operational': 3 };
    return [...filtered].sort((a, b) => {
      let va, vb;
      if (sort.field === 'status') {
        va = STATUS_ORDER[a.status] ?? 99;
        vb = STATUS_ORDER[b.status] ?? 99;
      } else if (sort.field === 'health') {
        va = a.health ?? -1;
        vb = b.health ?? -1;
      } else {
        va = (a[sort.field] || '').toString().toLowerCase();
        vb = (b[sort.field] || '').toString().toLowerCase();
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' }
    );
    setPage(1);
  };

  // ── Summary counts ────────────────────────────────────────────────────────────
  const loadedRows    = rows.filter(r => r.loaded);
  const countByStatus = (s) => loadedRows.filter(r => r.status === s).length;
  const totalShifts   = loadedRows.reduce((sum, r) => sum + (r.counts?.shifts_open || 0), 0);

  // ── Event handlers ────────────────────────────────────────────────────────────
  const handleSave = (saved) => {
    setParks(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'Park updated' : 'Park created');
    if (!isEdit) router.push(`/admin/parks/${saved.id}`);
  };

  const doDelete = async () => {
    const park = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/parks/${park.id}`, { method: 'DELETE' });
      setParks(prev => prev.filter(p => p.id !== park.id));
      showToast('Park deleted');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Edit modal — optionally navigate to a specific workspace tab
  const openEdit = (park, tab) => {
    if (tab) {
      router.push(`/admin/parks/${park.id}?tab=${tab}`);
    } else {
      setModal(park);
    }
  };

  const resetFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterCity(''); setFilterState(''); setPage(1);
  };
  const hasFilters = search || filterStatus || filterCity || filterState;

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <Sidebar active="parks"/>
      <div className="main">
        <Topbar current="Parks" icon="map"/>
        <div className="canvas" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Summary strip ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <SummaryCard label="Total Parks"       value={parks.length}             icon="map"     color="var(--ink)"/>
            <SummaryCard label="Operational"        value={countByStatus('Operational')}        icon="check"   color="#1F8A4A"/>
            <SummaryCard label="Setup In Progress"  value={countByStatus('Setup In Progress')}  icon="clock"   color="#D89614"/>
            <SummaryCard label="Attention Required" value={countByStatus('Attention Required')} icon="alert"   color="#C53A2B"/>
            <SummaryCard label="Open Shifts"        value={totalShifts}              icon="clock"   color={totalShifts > 0 ? '#1F8A4A' : 'var(--ink-4)'}/>
          </div>

          {/* ── Table card ───────────────────────────────────────────────────── */}
          <div className="sec" style={{ overflow: 'hidden' }}>

            {/* Header */}
            <div className="sec-head" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="sec-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="map" size={12} color="var(--ink-3)"/>
                Parks
              </div>
              <span className="tag">{parks.length} total</span>
              {loadedRows.length < parks.length && (
                <span className="tag amber" style={{ fontSize: 10 }}>Loading details…</span>
              )}
              <span className="spacer"/>
              {can('parks.create') && (
                <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                  <Icon name="plus" size={12} color="#fff"/> Add Park
                </button>
              )}
            </div>

            {/* Filter bar — same pattern as Dashboard FilterBar */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div className="filterbar" style={{ margin: 0 }}>

                {/* Search */}
                <div className="filter" style={{ flex: '2 1 180px', maxWidth: 280 }}>
                  <label className="filter-label">Search</label>
                  <input
                    className="filter-input"
                    placeholder="Park name or code…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>

                {/* Status */}
                <div className="filter">
                  <label className="filter-label">Status</label>
                  <select className="filter-select" value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                    <option value="">All Statuses</option>
                    {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* State */}
                {stateOptions.length > 1 && (
                  <div className="filter">
                    <label className="filter-label">State</label>
                    <select className="filter-select" value={filterState}
                      onChange={e => { setFilterState(e.target.value); setFilterCity(''); setPage(1); }}>
                      <option value="">All States</option>
                      {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {/* City */}
                {cityOptions.length > 1 && (
                  <div className="filter">
                    <label className="filter-label">City</label>
                    <select className="filter-select" value={filterCity}
                      onChange={e => { setFilterCity(e.target.value); setPage(1); }}>
                      <option value="">All Cities</option>
                      {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {hasFilters && (
                  <div className="filter" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Reset</button>
                  </div>
                )}

                <div style={{ flex: '0 0 auto', alignSelf: 'flex-end', paddingBottom: 1 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>
                    {sorted.length} {sorted.length === 1 ? 'park' : 'parks'}
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <table className="data-table">
                  <tbody>
                    {[...Array(5)].map((_, i) => (
                      <tr key={i} className="skeleton-row">
                        {[90, 100, 160, 110, 130, 110, 90, 60, 60].map((w, j) => (
                          <td key={j}><span className="skeleton-cell" style={{ width: w }}/></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : denied ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                  You do not have permission to view parks.
                </div>
              ) : parks.length === 0 ? (
                <div style={{ padding: 64, textAlign: 'center' }}>
                  <Icon name="map" size={40} color="var(--ink-5)"/>
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>No parks yet</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-4)' }}>Create your first park to get started.</div>
                  {can('parks.create') && (
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('create')}>
                      + Add Park
                    </button>
                  )}
                </div>
              ) : sorted.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                  No parks match the current filters.{' '}
                  <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Clear filters</button>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="sortable" onClick={() => toggleSort('id')} style={{ whiteSpace: 'nowrap' }}>
                        Park Code<SortArrow field="id" sort={sort}/>
                      </th>
                      <th className="sortable" onClick={() => toggleSort('name')}>
                        Park Name<SortArrow field="name" sort={sort}/>
                      </th>
                      <th className="sortable" onClick={() => toggleSort('city')}>
                        City<SortArrow field="city" sort={sort}/>
                      </th>
                      <th>Park Manager</th>
                      <th className="sortable" onClick={() => toggleSort('status')}>
                        Status<SortArrow field="status" sort={sort}/>
                      </th>
                      <th>Pricing</th>
                      <th style={{ textAlign: 'center' }}>Open Shifts</th>
                      <th className="sortable" onClick={() => toggleSort('health')} style={{ textAlign: 'right' }}>
                        Health<SortArrow field="health" sort={sort}/>
                      </th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(r => {
                      const c = r.counts;
                      return (
                        <tr key={r.id}>
                          {/* Park Code */}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span style={{
                                width: 9, height: 9, borderRadius: '50%',
                                background: r.color_hex || '#8A92A3', flexShrink: 0,
                              }}/>
                              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{r.id}</span>
                            </div>
                          </td>

                          {/* Park Name */}
                          <td>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{r.name}</span>
                          </td>

                          {/* City */}
                          <td style={{ color: 'var(--ink-3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {r.city || '—'}
                            {r.state && r.state !== r.city && (
                              <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>, {r.state}</span>
                            )}
                          </td>

                          {/* Park Manager */}
                          <td>
                            {!r.loaded ? (
                              <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>
                            ) : r.manager ? (
                              <span style={{ fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 500 }}>{r.manager.name}</span>
                            ) : (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, fontWeight: 600, color: '#8A5E0B',
                                background: '#FCF5E4', border: '1px solid var(--amber-100)',
                                borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap',
                              }}>
                                ⚠ Unassigned
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td>
                            {!r.loaded
                              ? <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>
                              : <StatusBadge status={r.status}/>
                            }
                          </td>

                          {/* Pricing */}
                          <td>
                            {r.loaded ? <PricingBadge n={c?.pricing_rules}/> : <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>}
                          </td>

                          {/* Open Shifts */}
                          <td style={{ textAlign: 'center' }}>
                            {r.loaded ? (
                              c?.shifts_open > 0
                                ? <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#1F8A4A' }}>{c.shifts_open}</span>
                                : <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ink-5)' }}>0</span>
                            ) : <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>}
                          </td>

                          {/* Health % */}
                          <td style={{ textAlign: 'right' }}>
                            {r.loaded ? <HealthPct pct={r.health}/> : <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: 11, padding: '3px 10px' }}
                                onClick={() => router.push(`/admin/parks/${r.id}`)}
                              >
                                View
                              </button>
                              <ParkMoreMenu park={r} onEdit={openEdit} onDelete={setDeleteTarget} can={can}/>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !loading && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderTop: '1px solid var(--border)',
                fontSize: 12, color: 'var(--ink-3)',
              }}>
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} parks
                </span>
                <div className="pager">
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                  <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const pg = totalPages <= 7 ? i + 1
                      : page <= 4 ? i + 1
                      : page >= totalPages - 3 ? totalPages - 6 + i
                      : page - 3 + i;
                    return (
                      <button key={pg} className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setPage(pg)}>{pg}</button>
                    );
                  })}
                  <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
                  <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 11, marginBottom: 8 }}>
            ZTech Operations Dashboard v1.0 · © NovoStack 2026
          </div>
        </div>
      </div>

      {modal && (
        <ParkFormModal
          park={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Park"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Parks with existing tickets cannot be deleted.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
