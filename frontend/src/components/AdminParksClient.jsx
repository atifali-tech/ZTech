'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar           from './Sidebar';
import Topbar            from './Topbar';
import Icon              from './Icon';
import Toast             from './Toast';
import ConfirmDialog     from './ConfirmDialog';
import ParkFormModal     from './ParkFormModal';
import ParkSettingsModal from './ParkSettingsModal';
import { useAuth }       from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function AdminParksClient() {
  const { can } = useAuth();
  const [parks,        setParks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [denied,       setDenied]       = useState(false);
  const [modal,        setModal]        = useState(null); // null | 'create' | park-object
  const [settingsPark, setSettingsPark] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast,        setToast]        = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    setDenied(false);
    try {
      const data = await apiFetch('/api/parks');
      setParks(data);
    } catch (err) {
      if (err.message?.includes('Permission denied') || err.message?.includes('denied')) setDenied(true);
      else showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, []);

  const handleSave = (saved) => {
    setParks(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'Park updated' : 'Park created');
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

  return (
    <div className="app">
      <Sidebar active="parks"/>
      <div className="main">
        <Topbar current="Parks Management" icon="map"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Parks</div>
              <span className="tag">{parks.length} total</span>
              <div className="sec-actions">
                {can('parks.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    + Add Park
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : denied ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                  You do not have permission to view parks.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Park Name</th>
                        <th>City</th>
                        <th>State</th>
                        <th>Capacity</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parks.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: p.color_hex || '#8A92A3', flexShrink: 0,
                                display: 'inline-block',
                              }}/>
                              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{p.id}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{p.city || '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{p.state || '—'}</td>
                          <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                            {p.capacity ? p.capacity.toLocaleString() : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {can('parks.edit') && (
                                <button className="btn btn-ghost btn-sm" title="Operational Settings"
                                  onClick={() => setSettingsPark(p)}>
                                  Settings
                                </button>
                              )}
                              {can('parks.edit') && (
                                <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setModal(p)}>
                                  Edit
                                </button>
                              )}
                              {can('parks.delete') && (
                                <button className="btn btn-ghost btn-sm" title="Delete"
                                  onClick={() => setDeleteTarget(p)}
                                  style={{ color: 'var(--red)' }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {parks.length === 0 && !loading && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '24px 0' }}>No parks found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

      {settingsPark && (
        <ParkSettingsModal
          park={settingsPark}
          onClose={() => setSettingsPark(null)}
          onSaved={() => { setSettingsPark(null); showToast('Operational settings saved'); }}
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
