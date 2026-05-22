'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar             from './Sidebar';
import Topbar              from './Topbar';
import Icon                from './Icon';
import Toast               from './Toast';
import OpenShiftModal      from './OpenShiftModal';
import CloseShiftModal     from './CloseShiftModal';
import ReconcileShiftModal from './ReconcileShiftModal';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const STATUS_TAG = {
  Open:              'tag green',
  Operating:         'tag amber',
  Closed:            'tag gray',
  Reconciled:        'tag indigo',
  'Variance Flagged':'tag red',
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmt(v) {
  return v != null ? `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function VarianceCell({ variance }) {
  if (variance == null) return <span style={{ color: 'var(--ink-5)' }}>—</span>;
  const v = parseFloat(variance);
  const cls = v < 0 ? 'variance-bad' : v > 0 ? 'variance-ok' : '';
  return <span className={cls}>{fmt(variance)}</span>;
}

export default function ShiftsClient() {
  const { can } = useAuth();
  const [shifts,       setShifts]       = useState([]);
  const [parks,        setParks]        = useState([]);
  const [counters,     setCounters]     = useState([]);
  const [parkFilter,   setParkFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [toast,        setToast]        = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (parkFilter)   qs.set('park_id', parkFilter);
      if (statusFilter) qs.set('status',  statusFilter);
      const [s, p, c] = await Promise.all([
        apiFetch('/api/operations/shifts' + (qs.toString() ? `?${qs}` : '')),
        apiFetch('/api/parks'),
        apiFetch('/api/operations/counters'),
      ]);
      setShifts(s); setParks(p); setCounters(c);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter, statusFilter]);

  const handleSave = (saved) => {
    setShifts(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    const msg = modal === 'open' ? 'Shift opened' : modal?.type === 'reconcile' ? 'Shift reconciled' : 'Shift closed';
    setModal(null);
    showToast(msg);
  };

  return (
    <div className="app">
      <Sidebar active="op-shifts"/>
      <div className="main">
        <Topbar current="Shifts" icon="lock"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Shift Sessions</div>
              <span className="tag">{shifts.length} shown</span>
              <div className="sec-actions">
                <select className="filter-select" value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                  <option value="">All Parks</option>
                  {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  {['Open','Operating','Closed','Variance Flagged','Reconciled'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {can('shifts.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('open')}>
                    + Open Shift
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : shifts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="clock" size={32}/></div>
                  <div className="empty-state-title">No shifts found</div>
                  <div className="empty-state-sub">
                    {can('shifts.create') ? 'Open a new shift to get started.' : 'No shifts match your current filters.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Park</th>
                        <th>Counter</th>
                        <th>Status</th>
                        <th>Opened</th>
                        <th>Closed</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Variance</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.user_name}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{s.park_name}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-4)' }}>{s.counter_name || '—'}</td>
                          <td><span className={STATUS_TAG[s.status] || 'tag'}>{s.status}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(s.opened_at)}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{fmtDate(s.closed_at)}</td>
                          <td style={{ fontSize: 13 }}>{fmt(s.expected_rev)}</td>
                          <td style={{ fontSize: 13 }}>{fmt(s.actual_rev)}</td>
                          <td><VarianceCell variance={s.variance}/></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {can('shifts.close') && ['Open','Operating'].includes(s.status) && (
                                <button className="btn btn-ghost btn-sm" title="Close Shift"
                                  onClick={() => setModal({ type: 'close', shift: s })}>
                                  Close
                                </button>
                              )}
                              {can('shifts.close') && ['Closed','Variance Flagged'].includes(s.status) && (
                                <button className="btn btn-ghost btn-sm" title="Reconcile"
                                  style={{ color: 'var(--indigo)' }}
                                  onClick={() => setModal({ type: 'reconcile', shift: s })}>
                                  Reconcile
                                </button>
                              )}
                            </div>
                          </td>
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

      {modal === 'open' && (
        <OpenShiftModal parks={parks} counters={counters} onSave={handleSave} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'close' && (
        <CloseShiftModal shift={modal.shift} onSave={handleSave} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'reconcile' && (
        <ReconcileShiftModal shift={modal.shift} onSave={handleSave} onClose={() => setModal(null)}/>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
