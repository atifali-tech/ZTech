'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const GATE_TYPES = ['Entry','Exit','Mixed','VIP','Staff','Emergency','Validation Only'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function GateModal({ gate, parks, zones, onSave, onClose }) {
  const [form, setForm] = useState({
    park_id:           gate?.park_id || parks[0]?.id || '',
    zone_id:           gate?.zone_id || '',
    name:              gate?.name || '',
    gate_type:         gate?.gate_type || 'Entry',
    occupancy_enabled: gate?.occupancy_enabled ?? false,
    is_active:         gate?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const parkZones = zones.filter(z => z.park_id === form.park_id && z.is_active);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.park_id || !form.name.trim()) { setErr('Park and name are required'); return; }
    setSaving(true); setErr('');
    try {
      const body = {
        park_id:           form.park_id,
        zone_id:           form.zone_id || null,
        name:              form.name,
        gate_type:         form.gate_type,
        occupancy_enabled: form.occupancy_enabled,
        is_active:         form.is_active,
      };
      const result = gate
        ? await apiFetch(`/api/operations/gates/${gate.id}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch('/api/operations/gates',             { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <span>{gate ? 'Edit Gate' : 'Add Gate'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          {!gate && (
            <div className="form-row">
              <label className="form-label">Park *</label>
              <select className="form-control" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value, zone_id: '' }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Gate Name *</label>
            <input className="form-control" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Entry Gate" required/>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Gate Type</label>
              <select className="form-control" value={form.gate_type}
                onChange={e => setForm(f => ({ ...f, gate_type: e.target.value }))}>
                {GATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Zone (optional)</label>
              <select className="form-control" value={form.zone_id}
                onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}>
                <option value="">— None —</option>
                {parkZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.occupancy_enabled}
                onChange={e => setForm(f => ({ ...f, occupancy_enabled: e.target.checked }))}/>
              Occupancy Tracking
            </label>
            {gate && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}/>
                Active
              </label>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
