'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar               from './Sidebar';
import Topbar                from './Topbar';
import Icon                  from './Icon';
import Toast                 from './Toast';
import CreateIncidentModal   from './CreateIncidentModal';
import ResolveIncidentModal  from './ResolveIncidentModal';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const SEV_TAG = {
  critical: 'tag sev-critical',
  high:     'tag sev-high',
  medium:   'tag sev-medium',
  low:      'tag sev-low',
  info:     'tag sev-info',
};

const STATUS_TAG = {
  open:          'tag red',
  investigating: 'tag blue',
  resolved:      'tag green',
  closed:        'tag gray',
};

const INCIDENT_TYPES = [
  'gate_blocked','scanner_failure','printer_failure','occupancy_breach',
  'shift_variance','device_offline','stale_heartbeat','counter_inactive','custom',
];
const SEVERITIES = ['critical','high','medium','low','info'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function tsLabel(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

const SUMMARY_KPIS = [
  { label: 'Open',          key: 'open',         cls: 'red'   },
  { label: 'Investigating', key: 'investigating', cls: 'blue'  },
  { label: 'Critical',      key: 'critical',      cls: 'red'   },
  { label: 'High',          key: 'high',          cls: 'amber' },
  { label: 'Total Active',  key: 'total_active',  cls: null    },
];

export default function OpsIncidentsClient() {
  const { can } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [summary,   setSummary]   = useState({});
  const [parks,     setParks]     = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [acting,    setActing]    = useState(null);
  const [toast,     setToast]     = useState({ msg: null, type: 'ok' });
  const [filters,   setFilters]   = useState({ park_id: '', status: '', severity: '', incident_type: '' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.park_id)      qs.set('park_id',       filters.park_id);
      if (filters.status)       qs.set('status',        filters.status);
      if (filters.severity)     qs.set('severity',      filters.severity);
      if (filters.incident_type) qs.set('incident_type', filters.incident_type);

      const summaryQs = filters.park_id ? `?park_id=${filters.park_id}` : '';

      const [inc, p, u, s] = await Promise.all([
        apiFetch(`/api/operations/incidents?${qs.toString()}`),
        apiFetch('/api/parks'),
        apiFetch('/api/users?limit=200'),
        apiFetch(`/api/operations/incidents/summary${summaryQs}`),
      ]);
      setIncidents(inc);
      setParks(p);
      setUsers(Array.isArray(u) ? u : (u.users || []));
      setSummary(s);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current?.(); }, [filters.park_id, filters.status, filters.severity, filters.incident_type]);

  const doInvestigate = async (incidentId) => {
    setActing(incidentId);
    try {
      const updated = await apiFetch(`/api/operations/incidents/${incidentId}/investigate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
      showToast('Now investigating incident');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActing(null);
    }
  };

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const handleCreate = (newInc) => {
    setIncidents(prev => [newInc, ...prev]);
    setModal(null);
    showToast('Incident created');
  };

  const handleResolved = (updated) => {
    setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
    setModal(null);
    showToast('Incident resolved');
  };

  return (
    <div className="app">
      <Sidebar active="op-incidents"/>
      <div className="main">
        <Topbar current="Operational Incidents" icon="xCircle"/>
        <div className="canvas">

          {/* Summary KPIs + action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {SUMMARY_KPIS.map(({ label, key, cls }) => (
              <div key={key} className="fin-kpi" style={{ minWidth: 80 }}>
                <div className="fin-kpi-val" style={cls === 'red' ? { color: 'var(--red)' } : cls === 'blue' ? { color: '#1A56DB' } : undefined}>
                  {summary[key] ?? 0}
                </div>
                <div className="fin-kpi-label">{label}</div>
              </div>
            ))}
            {can('incidents.create') && (
              <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 13 }} onClick={() => setModal('create')}>
                + New Incident
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="ops-action-bar" style={{ borderRadius: 6, marginBottom: 16, border: '1px solid var(--border)' }}>
            <select className="filter-select" value={filters.park_id} onChange={e => setFilter('park_id', e.target.value)}>
              <option value="">All Parks</option>
              {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select className="filter-select" value={filters.severity} onChange={e => setFilter('severity', e.target.value)}>
              <option value="">All Severities</option>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="filter-select" value={filters.incident_type} onChange={e => setFilter('incident_type', e.target.value)}>
              <option value="">All Types</option>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Incidents</div>
              <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>{incidents.length} shown</span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : incidents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="checkCircle" size={32} color="var(--green)"/></div>
                  <div className="empty-state-title">No incidents match your filters</div>
                  <div className="empty-state-sub">
                    {!filters.status ? 'All incidents are resolved or closed.' : 'Try adjusting the filters above.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Severity</th>
                        <th>Title / Type</th>
                        <th>Park</th>
                        <th>Assigned To</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th style={{ width: 90 }}>Age</th>
                        {can('incidents.manage') && <th style={{ width: 190 }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map(inc => (
                        <tr key={inc.id}>
                          <td><span className={SEV_TAG[inc.severity] || 'tag'}>{inc.severity}</span></td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{inc.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{inc.incident_type.replace(/_/g, ' ')}</div>
                            {inc.description && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{inc.description}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                            {parks.find(p => p.id === inc.park_id)?.name || inc.park_id || '—'}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                            {inc.assigned_to_name || <span style={{ color: 'var(--ink-5)' }}>Unassigned</span>}
                          </td>
                          <td><span className={STATUS_TAG[inc.status] || 'tag'}>{inc.status}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--ink-5)' }}>{tsLabel(inc.created_at)}</td>
                          {can('incidents.manage') && (
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {inc.status === 'open' && (
                                  <button className="btn btn-ghost btn-sm"
                                    disabled={acting === inc.id}
                                    onClick={() => doInvestigate(inc.id)}>
                                    Investigate
                                  </button>
                                )}
                                {(inc.status === 'open' || inc.status === 'investigating') && (
                                  <button className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--good)' }}
                                    onClick={() => setModal({ type: 'resolve', incident: inc })}>
                                    Resolve
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal === 'create' && (
        <CreateIncidentModal parks={parks} users={users} onSave={handleCreate} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'resolve' && (
        <ResolveIncidentModal incident={modal.incident} onSave={handleResolved} onClose={() => setModal(null)}/>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
