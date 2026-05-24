'use client';
import { useState, useEffect, useRef } from 'react';
import Icon               from './Icon';
import Toast              from './Toast';
import OpenShiftModal     from './OpenShiftModal';
import CloseShiftModal    from './CloseShiftModal';
import ReconcileShiftModal from './ReconcileShiftModal';
import { useAuth }        from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const STATUS_TAG = {
  Open:               'tag green',
  Operating:          'tag amber',
  Closed:             'tag gray',
  Reconciled:         'tag indigo',
  'Variance Flagged': 'tag red',
};

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

const STATUSES = ['', 'Open', 'Operating', 'Closed', 'Variance Flagged', 'Reconciled'];

export default function ParkWorkspaceShifts({ parkId }) {
  const { can } = useAuth();

  const [shifts,       setShifts]       = useState([]);
  const [counters,     setCounters]     = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [toast, setToast] = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const parkObj = [{ id: parkId, name: '' }];

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ park_id: parkId });
      if (statusFilter) qs.set('status', statusFilter);
      const [s, c] = await Promise.all([
        apiFetch(`/api/operations/shifts?${qs}`),
        apiFetch(`/api/operations/counters?park_id=${parkId}`),
      ]);
      setShifts(s); setCounters(c);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId, statusFilter]);

  const handleSave = (saved) => {
    setShifts(prev => {
      const idx = prev.findIndex(s => s.id === saved.id);
      return idx >= 0 ? prev.map(s => s.id === saved.id ? saved : s) : [saved, ...prev];
    });
    const msg = modal === 'open' ? 'Shift opened' : modal?.type === 'reconcile' ? 'Shift reconciled' : 'Shift closed';
    setModal(null);
    showToast(msg);
  };

  if (loading) return <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>;

  return (
    <>
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Shift Sessions</div>
          <span className="tag">{shifts.length} shown</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {STATUSES.map(s => (
              <button key={s || 'all'}
                className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-ghost'}`}
                style={{ padding: '0 8px', height: 26 }}
                onClick={() => setStatusFilter(s)}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <div className="sec-actions">
            {can('shifts.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal('open')}>
                <Icon name="plus" size={12} color="#fff"/> Open Shift
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {shifts.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Icon name="clock" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>No shifts found.</div>
              {can('shifts.create') && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setModal('open')}>
                  Open First Shift
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Counter</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Closed</th>
                  <th style={{ textAlign: 'right' }}>Expected</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.user_name}</td>
                    <td style={{ fontSize: 13, color: 'var(--ink-4)' }}>{s.counter_name || '—'}</td>
                    <td><span className={STATUS_TAG[s.status] || 'tag'}>{s.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(s.opened_at)}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{fmtDate(s.closed_at)}</td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{fmt(s.expected_rev)}</td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{fmt(s.actual_rev)}</td>
                    <td style={{ textAlign: 'right' }}><VarianceCell variance={s.variance}/></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {can('shifts.close') && ['Open', 'Operating'].includes(s.status) && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'close', shift: s })}>Close</button>
                        )}
                        {can('shifts.close') && ['Closed', 'Variance Flagged'].includes(s.status) && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--indigo)' }}
                            onClick={() => setModal({ type: 'reconcile', shift: s })}>Reconcile</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal === 'open' && (
        <OpenShiftModal parks={parkObj} counters={counters} onSave={handleSave} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'close' && (
        <CloseShiftModal shift={modal.shift} onSave={handleSave} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'reconcile' && (
        <ReconcileShiftModal shift={modal.shift} onSave={handleSave} onClose={() => setModal(null)}/>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
