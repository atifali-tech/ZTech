'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import Icon    from './Icon';
import Toast   from './Toast';
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
  open:         'tag red',
  acknowledged: 'tag amber',
  resolved:     'tag green',
  suppressed:   'tag gray',
};

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

const SEV_KPIS = [
  { label: 'Critical', key: 'critical', cls: 'sev-critical' },
  { label: 'High',     key: 'high',     cls: 'sev-high'     },
  { label: 'Medium',   key: 'medium',   cls: 'sev-medium'   },
  { label: 'Total',    key: 'total',    cls: null            },
];

export default function OpsAlertsClient() {
  const { can } = useAuth();
  const [alerts,     setAlerts]     = useState([]);
  const [parks,      setParks]      = useState([]);
  const [summary,    setSummary]    = useState({});
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState(null);
  const [generating, setGenerating] = useState(false);
  const [toast,      setToast]      = useState({ msg: null, type: 'ok' });
  const [filters,    setFilters]    = useState({ park_id: '', status: 'open,acknowledged', severity: '', alert_type: '' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.park_id)    qs.set('park_id',    filters.park_id);
      if (filters.severity)   qs.set('severity',   filters.severity);
      if (filters.alert_type) qs.set('alert_type', filters.alert_type);
      const statuses = filters.status ? filters.status.split(',') : [];
      statuses.forEach(st => qs.append('status', st.trim()));

      const [a, p, s] = await Promise.all([
        apiFetch(`/api/operations/alerts?${qs.toString()}`),
        apiFetch('/api/parks'),
        apiFetch('/api/operations/alerts/summary' + (filters.park_id ? `?park_id=${filters.park_id}` : '')),
      ]);
      setAlerts(a); setParks(p); setSummary(s);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current?.(); }, [filters.park_id, filters.status, filters.severity, filters.alert_type]);

  const doAction = async (alertId, action) => {
    setActing(alertId + action);
    try {
      const updated = await apiFetch(`/api/operations/alerts/${alertId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(`Alert ${action}d`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActing(null);
    }
  };

  const generateAlerts = async () => {
    setGenerating(true);
    try {
      const body = filters.park_id ? JSON.stringify({ park_id: filters.park_id }) : '{}';
      await apiFetch('/api/operations/alerts/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      showToast('Alert generation triggered');
      setTimeout(() => fetchRef.current?.(), 1200);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  return (
    <div className="app">
      <Sidebar active="op-alerts"/>
      <div className="main">
        <Topbar current="Operational Alerts" icon="warning"/>
        <div className="canvas">

          {/* Severity summary + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {SEV_KPIS.map(({ label, key, cls }) => (
              <div key={key} className={`fin-kpi${cls ? ` ${cls}` : ''}`} style={{ minWidth: 80 }}>
                <div className="fin-kpi-val" style={cls ? { color: 'inherit' } : undefined}>{summary[key] ?? 0}</div>
                <div className="fin-kpi-label">{label}</div>
              </div>
            ))}
            {can('alerts.manage') && (
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }}
                onClick={generateAlerts} disabled={generating}>
                <Icon name="refresh" size={13}/> {generating ? 'Generating…' : 'Generate Alerts'}
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
              <option value="open,acknowledged">Active (Open + Ack)</option>
              <option value="open">Open Only</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="suppressed">Suppressed</option>
              <option value="">All Statuses</option>
            </select>
            <select className="filter-select" value={filters.severity} onChange={e => setFilter('severity', e.target.value)}>
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="filter-select" value={filters.alert_type} onChange={e => setFilter('alert_type', e.target.value)}>
              <option value="">All Types</option>
              <option value="stale_heartbeat">Stale Heartbeat</option>
              <option value="device_offline">Device Offline</option>
              <option value="device_blocked">Device Blocked</option>
              <option value="gate_congested">Gate Congested</option>
              <option value="gate_maintenance">Gate Maintenance</option>
              <option value="shift_variance">Shift Variance</option>
              <option value="counter_inactive">Counter Inactive</option>
              <option value="occupancy_warning">Occupancy Warning</option>
              <option value="occupancy_critical">Occupancy Critical</option>
            </select>
          </div>

          {/* Alert table */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Alerts</div>
              <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>{alerts.length} shown</span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : alerts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="checkCircle" size={32} color="var(--green)"/></div>
                  <div className="empty-state-title">No alerts match your filters</div>
                  <div className="empty-state-sub">
                    {filters.status === 'open,acknowledged' ? 'All active alerts are resolved or suppressed.' : 'Try adjusting the filters above.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 90 }}>Severity</th>
                        <th>Title / Type</th>
                        <th>Park · Target</th>
                        <th style={{ width: 100 }}>Status</th>
                        <th style={{ width: 90 }}>Age</th>
                        {can('alerts.manage') && <th style={{ width: 190 }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map(a => (
                        <tr key={a.id}>
                          <td><span className={SEV_TAG[a.severity] || 'tag'}>{a.severity}</span></td>
                          <td>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{a.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{a.alert_type.replace(/_/g, ' ')}</div>
                            {a.body && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{a.body}</div>}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                            <div>{parks.find(p => p.id === a.park_id)?.name || a.park_id || '—'}</div>
                            {a.target_type && <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{a.target_type} {String(a.target_id || '').slice(0, 8)}</div>}
                          </td>
                          <td><span className={STATUS_TAG[a.status] || 'tag'}>{a.status}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--ink-5)' }}>{tsLabel(a.created_at)}</td>
                          {can('alerts.manage') && (
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {a.status === 'open' && (
                                  <button className="btn btn-ghost btn-sm"
                                    disabled={acting === a.id + 'acknowledge'}
                                    onClick={() => doAction(a.id, 'acknowledge')}>
                                    Ack
                                  </button>
                                )}
                                {(a.status === 'open' || a.status === 'acknowledged') && (
                                  <>
                                    <button className="btn btn-ghost btn-sm"
                                      disabled={acting === a.id + 'resolve'}
                                      onClick={() => doAction(a.id, 'resolve')}>
                                      Resolve
                                    </button>
                                    <button className="btn btn-ghost btn-sm"
                                      disabled={acting === a.id + 'suppress'}
                                      onClick={() => doAction(a.id, 'suppress')}>
                                      Suppress
                                    </button>
                                  </>
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

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
