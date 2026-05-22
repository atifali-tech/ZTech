'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar       from './Sidebar';
import Topbar        from './Topbar';
import Icon          from './Icon';
import Toast         from './Toast';
import ConfirmDialog from './ConfirmDialog';
import CounterModal  from './CounterModal';
import { useAuth }   from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const OP_STATUS_TAG = {
  'Shift Open':  'tag green',
  Active:        'tag green',
  Maintenance:   'tag amber',
  Inactive:      'tag gray',
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const DEVICE_STATUS_TAG = { Online: 'tag green', Offline: 'tag gray', Maintenance: 'tag amber', Blocked: 'tag red' };

export default function CountersClient() {
  const { can } = useAuth();
  const [counters,   setCounters]   = useState([]);
  const [parks,      setParks]      = useState([]);
  const [zones,      setZones]      = useState([]);
  const [users,      setUsers]      = useState([]);
  const [devices,    setDevices]    = useState([]);
  const [parkFilter, setParkFilter] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [confirm,    setConfirm]    = useState(null);
  const [toast,      setToast]      = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [c, p, z, u, d] = await Promise.all([
        apiFetch('/api/operations/counters' + (parkFilter ? `?park_id=${parkFilter}` : '')),
        apiFetch('/api/parks'),
        apiFetch('/api/operations/zones'),
        apiFetch('/api/users'),
        apiFetch('/api/operations/devices'),
      ]);
      setCounters(c); setParks(p); setZones(z);
      setUsers(Array.isArray(u) ? u : (u.users || []));
      setDevices(d);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter]);

  const handleSave = (saved) => {
    setCounters(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'Counter updated' : 'Counter created');
  };

  const doDelete = async () => {
    const counter = confirm;
    setConfirm(null);
    try {
      await apiFetch(`/api/operations/counters/${counter.id}`, { method: 'DELETE' });
      setCounters(prev => prev.filter(c => c.id !== counter.id));
      showToast('Counter deleted');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="app">
      <Sidebar active="op-counters"/>
      <div className="main">
        <Topbar current="Counters" icon="grid"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Counters</div>
              <span className="tag">{counters.length} total</span>
              <div className="sec-actions">
                <select className="filter-select" value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                  <option value="">All Parks</option>
                  {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {can('counters.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    + Add Counter
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : counters.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="grid" size={32}/></div>
                  <div className="empty-state-title">No counters found</div>
                  <div className="empty-state-sub">
                    {can('counters.create') ? 'Add a counter to start managing ticketing points.' : 'No counters match your current filters.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Counter</th>
                        <th>Park</th>
                        <th>Zone</th>
                        <th>Type</th>
                        <th>Assigned User</th>
                        <th>Device</th>
                        <th>Status</th>
                        {(can('counters.edit') || can('counters.delete')) && <th style={{ textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {counters.map(c => {
                        const opStatus = c.op_status || (c.is_active ? 'Active' : 'Inactive');
                        return (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.park_name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-4)' }}>{c.zone_name || '—'}</td>
                            <td><span className="tag">{c.counter_type}</span></td>
                            <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.assigned_user_name || <span style={{ color: 'var(--ink-5)' }}>Unassigned</span>}</td>
                            <td>
                              {c.assigned_device_name ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.assigned_device_name}</span>
                                  {c.device_status && <span className={DEVICE_STATUS_TAG[c.device_status] || 'tag'} style={{ fontSize: 10 }}>{c.device_status}</span>}
                                </div>
                              ) : <span style={{ color: 'var(--ink-5)', fontSize: 13 }}>—</span>}
                            </td>
                            <td><span className={OP_STATUS_TAG[opStatus] || 'tag'}>{opStatus}</span></td>
                            {(can('counters.edit') || can('counters.delete')) && (
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  {can('counters.edit') && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(c)}>Edit</button>
                                  )}
                                  {can('counters.delete') && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                      onClick={() => setConfirm(c)}>Delete</button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <CounterModal
          counter={modal === 'create' ? null : modal}
          parks={parks}
          zones={zones}
          users={users}
          devices={devices}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete Counter"
        message={`Delete counter "${confirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
