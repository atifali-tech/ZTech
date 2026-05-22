'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar       from './Sidebar';
import Topbar        from './Topbar';
import Icon          from './Icon';
import Toast         from './Toast';
import ConfirmDialog from './ConfirmDialog';
import GateModal     from './GateModal';
import { useAuth }   from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const OP_STATUS_TAG = {
  Active:      'tag green',
  Congested:   'tag amber',
  Maintenance: 'tag red',
  Inactive:    'tag gray',
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function GatesClient() {
  const { can } = useAuth();
  const [gates,      setGates]      = useState([]);
  const [parks,      setParks]      = useState([]);
  const [zones,      setZones]      = useState([]);
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
      const [g, p, z] = await Promise.all([
        apiFetch('/api/operations/gates' + (parkFilter ? `?park_id=${parkFilter}` : '')),
        apiFetch('/api/parks'),
        apiFetch('/api/operations/zones'),
      ]);
      setGates(g); setParks(p); setZones(z);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter]);

  const handleSave = (saved) => {
    setGates(prev => {
      const idx = prev.findIndex(g => g.id === saved.id);
      return idx >= 0 ? prev.map(g => g.id === saved.id ? saved : g) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'Gate updated' : 'Gate created');
  };

  const doDelete = async () => {
    const gate = confirm;
    setConfirm(null);
    try {
      await apiFetch(`/api/operations/gates/${gate.id}`, { method: 'DELETE' });
      setGates(prev => prev.filter(g => g.id !== gate.id));
      showToast('Gate deleted');
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <div className="app">
      <Sidebar active="op-gates"/>
      <div className="main">
        <Topbar current="Gates" icon="ticket"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Gates</div>
              <span className="tag">{gates.length} total</span>
              <div className="sec-actions">
                <select className="filter-select" value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                  <option value="">All Parks</option>
                  {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {can('gates.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    + Add Gate
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : gates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="ticket" size={32}/></div>
                  <div className="empty-state-title">No gates found</div>
                  <div className="empty-state-sub">
                    {can('gates.create') ? 'Add gates to start tracking entry and exit.' : 'No gates match your current filters.'}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Gate Name</th>
                        <th>Park</th>
                        <th>Zone</th>
                        <th>Type</th>
                        <th>Occupancy</th>
                        <th>Status</th>
                        {(can('gates.edit') || can('gates.delete')) && <th style={{ textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gates.map(g => {
                        const opStatus = g.op_status || (g.is_active ? 'Active' : 'Inactive');
                        return (
                          <tr key={g.id}>
                            <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{g.name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{g.park_name}</td>
                            <td style={{ fontSize: 13, color: 'var(--ink-4)' }}>{g.zone_name || '—'}</td>
                            <td><span className="tag">{g.gate_type}</span></td>
                            <td>
                              <span className={g.occupancy_enabled ? 'tag green' : 'tag gray'}>
                                {g.occupancy_enabled ? 'Enabled' : 'Off'}
                              </span>
                            </td>
                            <td>
                              <span className={OP_STATUS_TAG[opStatus] || 'tag'}>{opStatus}</span>
                            </td>
                            {(can('gates.edit') || can('gates.delete')) && (
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  {can('gates.edit') && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => setModal(g)}>Edit</button>
                                  )}
                                  {can('gates.delete') && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                                      onClick={() => setConfirm(g)}>Delete</button>
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
        <GateModal
          gate={modal === 'create' ? null : modal}
          parks={parks}
          zones={zones}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Delete Gate"
        message={`Delete gate "${confirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
