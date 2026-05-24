'use client';
import { useState, useEffect, useRef } from 'react';
import Icon                from './Icon';
import Toast               from './Toast';
import CreateIncidentModal from './CreateIncidentModal';
import ResolveIncidentModal from './ResolveIncidentModal';
import { useAuth }         from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const SEV_TAG = {
  critical: 'tag sev-critical',
  high:     'tag sev-high',
  medium:   'tag sev-medium',
  low:      'tag sev-low',
  info:     'tag sev-info',
};

const ALERT_STATUS_TAG = {
  open:         'tag red',
  acknowledged: 'tag amber',
  resolved:     'tag green',
  suppressed:   'tag gray',
};

const INC_STATUS_TAG = {
  open:          'tag red',
  investigating: 'tag amber',
  resolved:      'tag green',
  closed:        'tag gray',
};

function tsLabel(ts) {
  if (!ts) return '—';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function ParkWorkspaceOps({ parkId }) {
  const { can } = useAuth();

  const [alerts,    setAlerts]    = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [acting,    setActing]    = useState(null);
  const [modal,     setModal]     = useState(null);
  const [alertStatusFilter, setAlertStatusFilter] = useState('open,acknowledged');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState('');
  const [toast, setToast] = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const parkObj = [{ id: parkId, name: '' }];

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const alertQs = new URLSearchParams({ park_id: parkId });
      const statuses = alertStatusFilter ? alertStatusFilter.split(',') : [];
      statuses.forEach(st => alertQs.append('status', st.trim()));

      const incQs = new URLSearchParams({ park_id: parkId });
      if (incidentStatusFilter) incQs.set('status', incidentStatusFilter);

      const [a, inc, u] = await Promise.all([
        apiFetch(`/api/operations/alerts?${alertQs}`),
        apiFetch(`/api/operations/incidents?${incQs}`),
        apiFetch('/api/users?limit=200'),
      ]);
      setAlerts(a);
      setIncidents(inc);
      setUsers(Array.isArray(u) ? u : (u.users || []));
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId, alertStatusFilter, incidentStatusFilter]);

  const doAlertAction = async (alertId, action) => {
    setActing(alertId + action);
    try {
      const updated = await apiFetch(`/api/operations/alerts/${alertId}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(`Alert ${action}d`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setActing(null); }
  };

  const doInvestigate = async (incidentId) => {
    setActing('inc' + incidentId);
    try {
      const updated = await apiFetch(`/api/operations/incidents/${incidentId}/investigate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
      showToast('Now investigating incident');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setActing(null); }
  };

  const handleIncidentCreated = (newInc) => {
    setIncidents(prev => [newInc, ...prev]);
    setModal(null);
    showToast('Incident created');
  };

  const handleIncidentResolved = (updated) => {
    setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
    setModal(null);
    showToast('Incident resolved');
  };

  const activeAlerts    = alerts.filter(a => a.status === 'open' || a.status === 'acknowledged');
  const criticalAlerts  = alerts.filter(a => a.severity === 'critical');
  const openIncidents   = incidents.filter(i => i.status === 'open' || i.status === 'investigating');

  if (loading) return <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>;

  return (
    <>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="fin-kpi" style={{ minWidth: 80 }}>
          <div className="fin-kpi-val" style={activeAlerts.length > 0 ? { color: 'var(--red)' } : {}}>{activeAlerts.length}</div>
          <div className="fin-kpi-label">Active Alerts</div>
        </div>
        <div className="fin-kpi" style={{ minWidth: 80 }}>
          <div className="fin-kpi-val" style={criticalAlerts.length > 0 ? { color: 'var(--red)' } : {}}>{criticalAlerts.length}</div>
          <div className="fin-kpi-label">Critical</div>
        </div>
        <div className="fin-kpi" style={{ minWidth: 80 }}>
          <div className="fin-kpi-val" style={openIncidents.length > 0 ? { color: '#D89614' } : {}}>{openIncidents.length}</div>
          <div className="fin-kpi-label">Open Incidents</div>
        </div>
      </div>

      {/* Alerts section */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Alerts</div>
          <span className="tag">{alerts.length} shown</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {[
              { val: 'open,acknowledged', label: 'Active' },
              { val: 'open',              label: 'Open' },
              { val: 'acknowledged',      label: 'Acked' },
              { val: 'resolved',          label: 'Resolved' },
              { val: '',                  label: 'All' },
            ].map(({ val, label }) => (
              <button key={val || 'all'}
                className={`btn btn-sm${alertStatusFilter === val ? ' btn-primary' : ' btn-ghost'}`}
                style={{ padding: '0 8px', height: 26 }}
                onClick={() => setAlertStatusFilter(val)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {alerts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Icon name="checkCircle" size={32} color="var(--good)"/>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>No alerts match this filter.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Severity</th>
                  <th>Title / Type</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 90 }}>Age</th>
                  {can('alerts.manage') && <th style={{ width: 180, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id}>
                    <td><span className={SEV_TAG[a.severity] || 'tag'}>{a.severity}</span></td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{a.alert_type?.replace(/_/g, ' ')}</div>
                      {a.body && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{a.body}</div>}
                    </td>
                    <td><span className={ALERT_STATUS_TAG[a.status] || 'tag'}>{a.status}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--ink-5)' }}>{tsLabel(a.created_at)}</td>
                    {can('alerts.manage') && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {a.status === 'open' && (
                            <button className="btn btn-ghost btn-sm"
                              disabled={acting === a.id + 'acknowledge'}
                              onClick={() => doAlertAction(a.id, 'acknowledge')}>
                              Ack
                            </button>
                          )}
                          {(a.status === 'open' || a.status === 'acknowledged') && (
                            <>
                              <button className="btn btn-ghost btn-sm"
                                disabled={acting === a.id + 'resolve'}
                                onClick={() => doAlertAction(a.id, 'resolve')}>
                                Resolve
                              </button>
                              <button className="btn btn-ghost btn-sm"
                                disabled={acting === a.id + 'suppress'}
                                onClick={() => doAlertAction(a.id, 'suppress')}>
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
          )}
        </div>
      </div>

      {/* Incidents section */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Incidents</div>
          <span className="tag">{incidents.length} shown</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {[
              { val: '',             label: 'All' },
              { val: 'open',         label: 'Open' },
              { val: 'investigating', label: 'Investigating' },
              { val: 'resolved',     label: 'Resolved' },
            ].map(({ val, label }) => (
              <button key={val || 'all'}
                className={`btn btn-sm${incidentStatusFilter === val ? ' btn-primary' : ' btn-ghost'}`}
                style={{ padding: '0 8px', height: 26 }}
                onClick={() => setIncidentStatusFilter(val)}>
                {label}
              </button>
            ))}
          </div>
          <div className="sec-actions">
            {can('incidents.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> New Incident
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {incidents.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Icon name="checkCircle" size={32} color="var(--good)"/>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>No incidents found.</div>
              {can('incidents.create') && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal('create')}>
                  + Report Incident
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Severity</th>
                  <th>Title / Type</th>
                  <th>Assigned To</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 90 }}>Age</th>
                  {can('incidents.manage') && <th style={{ width: 160, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td><span className={SEV_TAG[inc.severity] || 'tag'}>{inc.severity}</span></td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{inc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{inc.incident_type?.replace(/_/g, ' ')}</div>
                      {inc.description && <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 1 }}>{inc.description}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                      {inc.assigned_to_name || <span style={{ color: 'var(--ink-5)' }}>Unassigned</span>}
                    </td>
                    <td><span className={INC_STATUS_TAG[inc.status] || 'tag'}>{inc.status}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--ink-5)' }}>{tsLabel(inc.created_at)}</td>
                    {can('incidents.manage') && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {inc.status === 'open' && (
                            <button className="btn btn-ghost btn-sm"
                              disabled={acting === 'inc' + inc.id}
                              onClick={() => doInvestigate(inc.id)}>
                              Investigate
                            </button>
                          )}
                          {(inc.status === 'open' || inc.status === 'investigating') && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--good)' }}
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
          )}
        </div>
      </div>

      {modal === 'create' && (
        <CreateIncidentModal parks={parkObj} users={users} onSave={handleIncidentCreated} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'resolve' && (
        <ResolveIncidentModal incident={modal.incident} onSave={handleIncidentResolved} onClose={() => setModal(null)}/>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
