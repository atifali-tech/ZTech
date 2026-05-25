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
    if (!form.name.trim()) { setErr('Gate name is required'); return; }
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
          <span className="modal-title">{gate ? 'Edit Gate' : 'Add Gate'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{err}</div>}

          {!gate && parks.length > 1 && (
            <div className="field">
              <label className="field-label">Park *</label>
              <select className="field-input" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value, zone_id: '' }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Gate Name *</label>
            <input className="field-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Entry Gate" autoFocus required/>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Gate Type</label>
              <select className="field-input" value={form.gate_type}
                onChange={e => setForm(f => ({ ...f, gate_type: e.target.value }))}>
                {GATE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Zone (optional)</label>
              <select className="field-input" value={form.zone_id}
                onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}>
                <option value="">— None —</option>
                {parkZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={form.occupancy_enabled}
                onChange={e => setForm(f => ({ ...f, occupancy_enabled: e.target.checked }))}
                style={{ accentColor: 'var(--teal)', width: 14, height: 14 }}/>
              Occupancy Tracking
            </label>
            {gate && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  style={{ accentColor: 'var(--teal)', width: 14, height: 14 }}/>
                Active
              </label>
            )}
          </div>
        </form>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
