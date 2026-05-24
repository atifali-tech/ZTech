'use client';
import { useState, useEffect, useRef } from 'react';
import Icon         from './Icon';
import Toast        from './Toast';
import ConfirmDialog from './ConfirmDialog';
import ZoneModal    from './ZoneModal';
import GateModal    from './GateModal';
import { useAuth }  from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const GATE_TYPE_TAG = { Entry: 'tag green', Exit: 'tag red', Mixed: 'tag amber', VIP: 'tag indigo' };
const ZONE_TYPE_COLORS = { Entry: '#1D9E75', Exit: '#E24B4A', VIP: '#7F77DD', Food: '#EF9F27', Rides: '#378ADD', Parking: '#8A92A3', General: '#5DCAA5', Restricted: '#E24B4A' };

export default function ParkWorkspaceZonesGates({ parkId }) {
  const { can } = useAuth();
  const park = [{ id: parkId }]; // minimal park list for modals

  const [zones,   setZones]   = useState([]);
  const [gates,   setGates]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoneModal, setZoneModal] = useState(null); // null | 'create' | zone
  const [gateModal, setGateModal] = useState(null); // null | 'create' | gate
  const [confirm,   setConfirm]   = useState(null); // { type, item }
  const [toast, setToast] = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [z, g] = await Promise.all([
        apiFetch(`/api/operations/zones?park_id=${parkId}`),
        apiFetch(`/api/operations/gates?park_id=${parkId}`),
      ]);
      setZones(z);
      setGates(g);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId]);

  const handleZoneSave = (saved) => {
    setZones(prev => {
      const idx = prev.findIndex(z => z.id === saved.id);
      return idx >= 0 ? prev.map(z => z.id === saved.id ? saved : z) : [...prev, saved];
    });
    showToast(zoneModal === 'create' ? 'Zone created' : 'Zone updated');
    setZoneModal(null);
  };

  const handleGateSave = (saved) => {
    setGates(prev => {
      const idx = prev.findIndex(g => g.id === saved.id);
      return idx >= 0 ? prev.map(g => g.id === saved.id ? saved : g) : [...prev, saved];
    });
    showToast(gateModal === 'create' ? 'Gate created' : 'Gate updated');
    setGateModal(null);
  };

  const doDelete = async () => {
    const { type, item } = confirm;
    setConfirm(null);
    try {
      if (type === 'zone') {
        await apiFetch(`/api/operations/zones/${item.id}`, { method: 'DELETE' });
        setZones(prev => prev.filter(z => z.id !== item.id));
        showToast('Zone deleted');
      } else {
        await apiFetch(`/api/operations/gates/${item.id}`, { method: 'DELETE' });
        setGates(prev => prev.filter(g => g.id !== item.id));
        showToast('Gate deleted');
      }
    } catch (err) { showToast(err.message, 'error'); }
  };

  if (loading) return <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>;

  return (
    <>
      {/* Zones section */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Zones</div>
          <span className="tag">{zones.length} total</span>
          <div className="sec-actions">
            {can('zones.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setZoneModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> Add Zone
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {zones.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Icon name="map" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink-3)' }}>No Zones Configured</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-5)', maxWidth: 280, margin: '8px auto 0' }}>
                Zones let you organise this park into areas like Entry, Exit, VIP, and Rides.
              </div>
              {can('zones.create') && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setZoneModal('create')}>
                  <Icon name="plus" size={12} color="#fff"/> Create First Zone
                </button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zone Name</th>
                  <th>Type</th>
                  <th>Gates</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {zones.map(z => {
                  const zoneGates = gates.filter(g => g.zone_id === z.id);
                  return (
                    <tr key={z.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ZONE_TYPE_COLORS[z.zone_type] || '#8A92A3', flexShrink: 0 }}/>
                          {z.name}
                        </div>
                      </td>
                      <td><span className="tag" style={{ fontSize: 10 }}>{z.zone_type}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                        {zoneGates.length === 0
                          ? <span style={{ color: 'var(--ink-5)' }}>—</span>
                          : zoneGates.map(g => (
                            <span key={g.id} style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: g.is_active ? 'var(--good)' : 'var(--ink-5)' }}/>
                              {g.name}
                              <span style={{ fontSize: 10, color: 'var(--ink-4)' }}>({g.gate_type})</span>
                            </span>
                          ))
                        }
                      </td>
                      <td>{z.is_active ? <span className="tag green">Active</span> : <span className="tag gray">Inactive</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => setGateModal({ mode: 'create', zone_id: z.id })}
                            title="Add gate to this zone">
                            + Gate
                          </button>
                          {can('zones.edit') && (
                            <button className="btn btn-ghost btn-sm" onClick={() => setZoneModal(z)}>Edit</button>
                          )}
                          {can('zones.delete') && (
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                              onClick={() => setConfirm({ type: 'zone', item: z })}>Delete</button>
                          )}
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

      {/* Unzoned gates */}
      {(() => {
        const unzoned = gates.filter(g => !g.zone_id);
        if (unzoned.length === 0) return null;
        return (
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Gates (no zone assigned)</div>
              <span className="tag amber">{unzoned.length}</span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr><th>Gate Name</th><th>Type</th><th>Occupancy</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {unzoned.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>{g.name}</td>
                      <td><span className={GATE_TYPE_TAG[g.gate_type] || 'tag'} style={{ fontSize: 10 }}>{g.gate_type}</span></td>
                      <td>{g.occupancy_enabled ? <span className="tag green" style={{ fontSize: 10 }}>Enabled</span> : <span style={{ color: 'var(--ink-5)', fontSize: 12 }}>—</span>}</td>
                      <td>{g.is_active ? <span className="tag green">Active</span> : <span className="tag gray">Inactive</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {can('gates.edit') && <button className="btn btn-ghost btn-sm" onClick={() => setGateModal(g)}>Edit</button>}
                          {can('gates.delete') && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setConfirm({ type: 'gate', item: g })}>Delete</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Add gate button (standalone) */}
      {can('gates.create') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setGateModal({ mode: 'create' })}>
            <Icon name="plus" size={12}/> Add Standalone Gate
          </button>
        </div>
      )}

      {/* Zone modal */}
      {zoneModal && (
        <ZoneModal
          zone={zoneModal === 'create' ? null : zoneModal}
          parks={[{ id: parkId, name: '' }]}
          onSave={handleZoneSave}
          onClose={() => setZoneModal(null)}
        />
      )}

      {/* Gate modal */}
      {gateModal && (
        <GateModal
          gate={gateModal === 'create' || gateModal?.mode === 'create' ? null : gateModal}
          parks={[{ id: parkId, name: '' }]}
          zones={zones}
          onSave={handleGateSave}
          onClose={() => setGateModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.type === 'zone' ? 'Delete Zone' : 'Delete Gate'}
        message={`Delete "${confirm?.item?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
