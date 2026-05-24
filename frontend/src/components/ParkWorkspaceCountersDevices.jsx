'use client';
import { useState, useEffect, useRef } from 'react';
import Icon          from './Icon';
import Toast         from './Toast';
import ConfirmDialog from './ConfirmDialog';
import CounterModal  from './CounterModal';
import DeviceModal   from './DeviceModal';
import { useAuth }   from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function DeviceStatus({ status }) {
  const MAP = { Online: ['var(--good)', '●'], Offline: ['var(--ink-5)', '○'], Maintenance: ['#D89614', '◐'], Blocked: ['var(--red)', '✕'], Outdated: ['#A09AF0', '△'] };
  const [color, dot] = MAP[status] || ['var(--ink-4)', '?'];
  return <span style={{ color, fontWeight: 600, fontSize: 12 }}>{dot} {status}</span>;
}

function heartbeatLabel(ts) {
  if (!ts) return { text: 'Never', cls: 'stale-crit' };
  const secs = (Date.now() - new Date(ts)) / 1000;
  if (secs < 120)   return { text: `${Math.floor(secs)}s ago`,      cls: '' };
  if (secs < 3600)  return { text: `${Math.floor(secs / 60)}m ago`, cls: secs > 600 ? 'stale-warn' : '' };
  if (secs < 86400) return { text: `${Math.floor(secs / 3600)}h ago`, cls: 'stale-warn' };
  return { text: `${Math.floor(secs / 86400)}d ago`, cls: 'stale-crit' };
}

export default function ParkWorkspaceCountersDevices({ parkId, devicesAnchorId }) {
  const { can } = useAuth();

  const [counters,  setCounters]  = useState([]);
  const [devices,   setDevices]   = useState([]);
  const [zones,     setZones]     = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [counterModal, setCounterModal] = useState(null);
  const [deviceModal,  setDeviceModal]  = useState(null);
  const [confirm,      setConfirm]      = useState(null);
  const [toast, setToast] = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [c, d, z, u] = await Promise.all([
        apiFetch(`/api/operations/counters?park_id=${parkId}`),
        apiFetch(`/api/operations/devices?park_id=${parkId}`),
        apiFetch(`/api/operations/zones?park_id=${parkId}`),
        apiFetch('/api/users'),
      ]);
      setCounters(c); setDevices(d); setZones(z);
      setUsers(Array.isArray(u) ? u : (u.users || []));
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId]);

  const handleCounterSave = (saved) => {
    setCounters(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      return idx >= 0 ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved];
    });
    showToast(counterModal === 'create' ? 'Counter created' : 'Counter updated');
    setCounterModal(null);
  };

  const handleDeviceSave = (saved) => {
    setDevices(prev => {
      const idx = prev.findIndex(d => d.id === saved.id);
      return idx >= 0 ? prev.map(d => d.id === saved.id ? saved : d) : [...prev, saved];
    });
    showToast(deviceModal === 'create' ? 'Device added' : 'Device updated');
    setDeviceModal(null);
  };

  const doDelete = async () => {
    const { type, item } = confirm;
    setConfirm(null);
    try {
      if (type === 'counter') {
        await apiFetch(`/api/operations/counters/${item.id}`, { method: 'DELETE' });
        setCounters(prev => prev.filter(c => c.id !== item.id));
        showToast('Counter deleted');
      } else {
        await apiFetch(`/api/operations/devices/${item.id}`, { method: 'DELETE' });
        setDevices(prev => prev.filter(d => d.id !== item.id));
        showToast('Device deleted');
      }
    } catch (err) { showToast(err.message, 'error'); }
  };

  const unassignedDevices = devices.filter(d => !d.counter_id);

  if (loading) return <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>;

  return (
    <>
      {/* Counters */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Counters</div>
          <span className="tag">{counters.length} total</span>
          <div className="sec-actions">
            {can('counters.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setCounterModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> Add Counter
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {counters.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="grid" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>No Counters Configured</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-5)', maxWidth: 280, margin: '8px auto 0' }}>
                Counters are ticket-selling or entry-scanning stations. Add one to start tracking entries.
              </div>
              {can('counters.create') && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setCounterModal('create')}>
                  <Icon name="plus" size={12} color="#fff"/> Create First Counter
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Counter</th>
                  <th>Type</th>
                  <th>Zone</th>
                  <th>Device</th>
                  <th>Assigned User</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {counters.map(c => {
                  const assignedDevice = devices.find(d => d.counter_id === c.id);
                  const zone = zones.find(z => z.id === c.zone_id);
                  const user = users.find(u => u.id === c.assigned_user_id);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td><span className="tag" style={{ fontSize: 10 }}>{c.counter_type}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{zone?.name || <span style={{ color: 'var(--ink-5)' }}>—</span>}</td>
                      <td style={{ fontSize: 12 }}>
                        {assignedDevice
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: assignedDevice.status === 'Online' ? 'var(--good)' : 'var(--ink-5)' }}/>
                              {assignedDevice.name}
                            </span>
                          : <span style={{ color: 'var(--ink-5)' }}>—</span>
                        }
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{user?.name || <span style={{ color: 'var(--ink-5)' }}>—</span>}</td>
                      <td>{c.is_active ? <span className="tag green">Active</span> : <span className="tag gray">Inactive</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {can('counters.edit') && <button className="btn btn-ghost btn-sm" onClick={() => setCounterModal(c)}>Edit</button>}
                          {can('counters.delete') && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirm({ type: 'counter', item: c })}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Devices */}
      <div className="sec" id={devicesAnchorId} style={{ scrollMarginTop: 80 }}>
        <div className="sec-head">
          <div className="sec-title">Devices</div>
          <span className="tag">{devices.length} total</span>
          {unassignedDevices.length > 0 && <span className="tag amber">{unassignedDevices.length} unassigned</span>}
          <div className="sec-actions">
            {can('devices.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setDeviceModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> Add Device
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {devices.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="shield" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>No Devices Assigned</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-5)', maxWidth: 280, margin: '8px auto 0' }}>
                Assign a POS terminal, scanner, or tablet to a counter to enable live operations.
              </div>
              {can('devices.create') && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setDeviceModal('create')}>
                  <Icon name="plus" size={12} color="#fff"/> Assign First Device
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Last Heartbeat</th>
                  <th>Assigned Counter</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => {
                  const counter = counters.find(c => c.id === d.counter_id);
                  const hb = heartbeatLabel(d.last_heartbeat);
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td><span className="tag" style={{ fontSize: 10 }}>{d.device_type}</span></td>
                      <td><DeviceStatus status={d.status}/></td>
                      <td className={hb.cls} style={{ fontSize: 12 }}>{hb.text}</td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{counter?.name || <span style={{ color: 'var(--ink-5)' }}>Unassigned</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {can('devices.edit') && <button className="btn btn-ghost btn-sm" onClick={() => setDeviceModal(d)}>Edit</button>}
                          {can('devices.delete') && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirm({ type: 'device', item: d })}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {counterModal && (
        <CounterModal
          counter={counterModal === 'create' ? null : counterModal}
          parks={[{ id: parkId, name: '' }]}
          zones={zones}
          users={users}
          devices={devices}
          onSave={handleCounterSave}
          onClose={() => setCounterModal(null)}
        />
      )}

      {deviceModal && (
        <DeviceModal
          device={deviceModal === 'create' ? null : deviceModal}
          parks={[{ id: parkId, name: '' }]}
          counters={counters}
          onSave={handleDeviceSave}
          onClose={() => setDeviceModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === 'counter' ? 'Delete Counter' : 'Delete Device'}
        message={`Delete "${confirm?.item?.name}"?`}
        confirmLabel="Delete" danger
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
