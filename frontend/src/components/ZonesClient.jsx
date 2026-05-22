'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar   from './Sidebar';
import Topbar    from './Topbar';
import Icon      from './Icon';
import ZoneModal from './ZoneModal';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ZonesClient() {
  const { can } = useAuth();
  const [zones,   setZones]   = useState([]);
  const [parks,   setParks]   = useState([]);
  const [parkFilter, setParkFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [z, p] = await Promise.all([
        apiFetch('/api/operations/zones' + (parkFilter ? `?park_id=${parkFilter}` : '')),
        apiFetch('/api/parks'),
      ]);
      setZones(z);
      setParks(p);
    } catch (err) { showToast(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkFilter]);

  const handleSave = (saved) => {
    setZones(prev => {
      const idx = prev.findIndex(z => z.id === saved.id);
      return idx >= 0 ? prev.map(z => z.id === saved.id ? saved : z) : [...prev, saved];
    });
    setModal(null);
    showToast(modal === 'create' ? 'Zone created' : 'Zone updated');
  };

  const handleDelete = async (zone) => {
    if (!confirm(`Delete zone "${zone.name}"?`)) return;
    try {
      await apiFetch(`/api/operations/zones/${zone.id}`, { method: 'DELETE' });
      setZones(prev => prev.filter(z => z.id !== zone.id));
      showToast('Zone deleted');
    } catch (err) { showToast(err.message); }
  };

  return (
    <div className="app">
      <Sidebar active="op-zones"/>
      <div className="main">
        <Topbar current="Zones" icon="map"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Zones</div>
              <span className="tag">{zones.length} total</span>
              <div className="sec-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-control" style={{ fontSize: 13, padding: '4px 8px', width: 160 }}
                  value={parkFilter} onChange={e => setParkFilter(e.target.value)}>
                  <option value="">All Parks</option>
                  {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {can('zones.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    <Icon name="map" size={12} color="#fff"/> Add Zone
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading zones…</span></div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Zone Name</th>
                      <th>Park</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map(z => (
                      <tr key={z.id}>
                        <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{z.name}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{z.park_name}</td>
                        <td><span className="tag">{z.zone_type}</span></td>
                        <td>
                          <span style={{ fontSize: 12, color: z.is_active ? 'var(--green)' : 'var(--ink-4)' }}>
                            {z.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {can('zones.edit') && (
                            <button className="btn btn-sm icon-btn" title="Edit" onClick={() => setModal(z)}>
                              <Icon name="cog" size={13}/>
                            </button>
                          )}
                          {can('zones.delete') && (
                            <button className="btn btn-sm icon-btn" title="Delete" onClick={() => handleDelete(z)} style={{ color: 'var(--red)' }}>
                              <Icon name="trash" size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {zones.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '24px 0' }}>No zones found</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <ZoneModal
          zone={modal === 'create' ? null : modal}
          parks={parks}
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
