'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar       from './Sidebar';
import Topbar        from './Topbar';
import Icon          from './Icon';
import Toast         from './Toast';
import ConfirmDialog from './ConfirmDialog';
import DeviceModal   from './DeviceModal';
import { useAuth }   from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEVICE_STATUSES = ['Online','Offline','Maintenance','Blocked','Outdated'];

const STATUS_TAG = {
  Online:      'tag green',
  Offline:     'tag gray',
  Maintenance: 'tag amber',
  Blocked:     'tag red',
  Outdated:    'tag plum',
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function heartbeatLabel(ts) {
  if (!ts) return { text: 'Never', cls: 'stale-crit' };
  const secs = (Date.now() - new Date(ts)) / 1000;
  if (secs < 120)    return { text: `${Math.floor(secs)}s ago`,      cls: 'stale-ok' };
  if (secs < 600)    return { text: `${Math.floor(secs/60)}m ago`,   cls: 'stale-ok' };
  if (secs < 3600)   return { text: `${Math.floor(secs/60)}m ago`,   cls: 'stale-warn' };
  if (secs < 86400)  return { text: `${Math.floor(secs/3600)}h ago`, cls: 'stale-warn' };
  return { text: `${Math.floor(secs/86400)}d ago`, cls: 'stale-crit' };
}

export default function DevicesClient() {
  const { can } = useAuth();
  const [devices,      setDevices]      = useState([]);
  const [parks,        setParks]        = useState([]);
  const [counters,     setCounters]     = useState([]);
  const [parkFilter,   setParkFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(null);
  const [confirm,      setConfirm]      = useState(null);
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
      const [d, p, c] = await Promise.all([
        apiFetch('/api/operations/devices' + (qs.toString() ? `?${qs}` : '')),
        apiFetch('/api/parks'),
        apiFetch('/api/operations/counters'),
      ]);
      setDevices(d); setParks(p); setCounters(c);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter, statusFilter]);

  const handleSave = (saved) => {
    setDevices(prev => {
      const idx = prev.findIndex(d => d.id === saved.id);
      return idx >= 0 ? prev.map(d => d.id === saved.id ? saved : d) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'Device updated' : 'Device added');
  };

  const confirmDelete = (device) => {
    setConfirm(device);
  };

  const doDelete = async () => {
    const device = confirm;
    setConfirm(null);
    try {
      await apiFetch(`/api/operations/devices/${device.id}`, { method: 'DELETE' });
      setDevices(prev => prev.filter(d => d.id !== device.id));
      showToast('Device removed');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="app">
      <Sidebar active="op-devices"/>
      <div className="main">
        <Topbar current="Devices" icon="shield"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Devices</div>
              <span className="tag">{devices.length} total</span>
              <div className="sec-actions">
                <select className="filter-select" value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                  <option value="">All Parks</option>
                  {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  {DEVICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {can('devices.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    + Add Device
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : devices.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="shield" size={32}/></div>
                  <div className="empty-state-title">No devices found</div>
                  <div className="empty-state-sub">
                    {can('devices.create') ? 'Add a device to start tracking hardware.' : 'No devices match your current filters.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Device Name</th>
                        <th>Park</th>
                        <th>Counter</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Version</th>
                        <th>Last Heartbeat</th>
                        {(can('devices.edit') || can('devices.delete')) && <th style={{ textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map(d => {
                        const hb = heartbeatLabel(d.last_heartbeat);
                        return (
                          <tr key={d.id}>
                            <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{d.name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{d.park_name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-4)' }}>{d.counter_name || '—'}</td>
                            <td><span className="tag">{d.device_type}</span></td>
                            <td><span className={STATUS_TAG[d.status] || 'tag'}>{d.status}</span></td>
                            <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{d.software_version || '—'}</td>
                            <td>
                              <span className={hb.cls} style={{ fontSize: 12 }}>{hb.text}</span>
                            </td>
                            {(can('devices.edit') || can('devices.delete')) && (
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  {can('devices.edit') && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(d)}>
                                      Edit
                                    </button>
                                  )}
                                  {can('devices.delete') && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                      onClick={() => confirmDelete(d)}>
                                      Remove
                                    </button>
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
        <DeviceModal
          device={modal === 'create' ? null : modal}
          parks={parks}
          counters={counters}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Remove Device"
        message={`Remove "${confirm?.name}"? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
