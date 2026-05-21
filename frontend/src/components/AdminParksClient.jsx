'use client';
import { useState, useEffect } from 'react';
import Sidebar        from './Sidebar';
import Topbar         from './Topbar';
import Icon           from './Icon';
import ParkFormModal  from './ParkFormModal';
import { useAuth }    from '../lib/auth-context';

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
  const [parks,    setParks]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [denied,   setDenied]   = useState(false);
  const [modal,    setModal]    = useState(null); // null | 'create' | park-object
  const [deleting, setDeleting] = useState(null);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchParks = async () => {
    setLoading(true);
    setDenied(false);
    try {
      const data = await apiFetch('/api/parks');
      setParks(data);
    } catch (err) {
      if (err.message?.includes('Permission denied') || err.message?.includes('denied')) setDenied(true);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchParks(); }, []);

  const handleSave = (saved) => {
    setParks(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
    setModal(null);
    showToast(modal === 'create' ? 'Park created' : 'Park updated');
  };

  const handleDelete = async (park) => {
    if (!confirm(`Delete ${park.name}? This cannot be undone.`)) return;
    setDeleting(park.id);
    try {
      await apiFetch(`/api/parks/${park.id}`, { method: 'DELETE' });
      setParks(prev => prev.filter(p => p.id !== park.id));
      showToast('Park deleted');
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeleting(null);
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
                    <Icon name="map" size={12} color="#fff"/> Add Park
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading parks…</span></div>
              ) : denied ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                  You do not have permission to view parks.
                </div>
              ) : (
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
                          {can('parks.edit') && (
                            <button className="btn btn-sm icon-btn" title="Edit" onClick={() => setModal(p)}>
                              <Icon name="cog" size={13}/>
                            </button>
                          )}
                          {can('parks.delete') && (
                            <button className="btn btn-sm icon-btn" title="Delete"
                              disabled={deleting === p.id}
                              onClick={() => handleDelete(p)}
                              style={{ color: 'var(--red)' }}>
                              <Icon name="trash" size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {parks.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '24px 0' }}>No parks found</td></tr>
                    )}
                  </tbody>
                </table>
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--ink)', color: '#fff',
          padding: '10px 16px', borderRadius: 6, fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 200,
        }}>{toast}</div>
      )}
    </div>
  );
}
