'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter }     from 'next/navigation';
import Sidebar           from './Sidebar';
import Topbar            from './Topbar';
import Icon              from './Icon';
import Toast             from './Toast';
import ConfirmDialog     from './ConfirmDialog';
import ParkFormModal     from './ParkFormModal';
import { useAuth }       from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function DeviceDots({ online, total }) {
  if (!total) return <span style={{ color: 'var(--ink-5)', fontSize: 11 }}>—</span>;
  const dots = Array.from({ length: Math.min(total, 6) }, (_, i) => (
    <span key={i} style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: i < online ? 'var(--good)' : 'var(--ink-5)',
      marginRight: 2,
    }}/>
  ));
  return <span title={`${online}/${total} online`}>{dots}{total > 6 && <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>+{total - 6}</span>}</span>;
}

function CountPill({ n, label, warn }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 600, color: warn && n === 0 ? 'var(--ink-5)' : 'var(--ink-3)',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      <span style={{ fontWeight: 400, color: 'var(--ink-4)' }}>{label}</span>
    </span>
  );
}

export default function AdminParksClient() {
  const router = useRouter();
  const { can } = useAuth();
  const [parks,        setParks]        = useState([]);
  const [summaries,    setSummaries]    = useState({});
  const [loading,      setLoading]      = useState(true);
  const [denied,       setDenied]       = useState(false);
  const [modal,        setModal]        = useState(null);
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
      // Load summaries in background — fail silently per park
      data.forEach(p => {
        apiFetch(`/api/parks/${p.id}/summary`)
          .then(s => setSummaries(prev => ({ ...prev, [p.id]: s })))
          .catch(() => {});
      });
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
    if (!isEdit) {
      // Navigate to workspace immediately after creation
      router.push(`/admin/parks/${saved.id}`);
    }
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
        <Topbar current="Parks" icon="map"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Parks</div>
              <span className="tag">{parks.length} total</span>
              <div className="sec-actions">
                {can('parks.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    <Icon name="plus" size={12} color="#fff"/> Add Park
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
              ) : parks.length === 0 ? (
                <div style={{ padding: 64, textAlign: 'center' }}>
                  <Icon name="map" size={40} color="var(--ink-5)"/>
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>No parks yet</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-4)' }}>Create your first park to get started.</div>
                  {can('parks.create') && (
                    <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setModal('create')}>
                      + Add Park
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {parks.map(p => {
                    const s = summaries[p.id];
                    const c = s?.counts;
                    return (
                      <div
                        key={p.id}
                        onClick={() => router.push(`/admin/parks/${p.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '14px 20px', borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', transition: 'background .1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}
                      >
                        {/* Color dot + code */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 96, flexShrink: 0 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: p.color_hex || '#8A92A3', flexShrink: 0,
                          }}/>
                          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{p.id}</span>
                        </div>

                        {/* Name + location */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2 }}>
                            {[p.city, p.state].filter(Boolean).join(', ')}
                            {p.capacity ? ` · ${p.capacity.toLocaleString()} cap` : ''}
                          </div>
                        </div>

                        {/* Resource pills */}
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                          {c ? (
                            <>
                              <CountPill n={c.zones}    label="zones"    warn/>
                              <CountPill n={c.counters} label="counters" warn/>
                              <span title={`${c.devices_online}/${c.devices} devices online`}>
                                <DeviceDots online={c.devices_online} total={c.devices}/>
                              </span>
                              <CountPill n={c.users}    label="users"/>
                              {c.shifts_open > 0 && (
                                <span className="tag green" style={{ fontSize: 10 }}>{c.shifts_open} shift{c.shifts_open > 1 ? 's' : ''} open</span>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>Loading…</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          {can('parks.edit') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setModal(p)}>Edit</button>
                          )}
                          {can('parks.delete') && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                              onClick={() => setDeleteTarget(p)}>Delete</button>
                          )}
                          <span style={{ color: 'var(--ink-5)', padding: '0 4px', alignSelf: 'center', fontSize: 16 }}>›</span>
                        </div>
                      </div>
                    );
                  })}
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
