'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ZONE_TYPES = ['General','Entry','Exit','VIP','Food','Rides','Parking','Restricted'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ZoneModal({ zone, parks, onSave, onClose }) {
  const [form, setForm] = useState({
    park_id:   zone?.park_id || parks[0]?.id || '',
    name:      zone?.name || '',
    zone_type: zone?.zone_type || 'General',
    is_active: zone?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.park_id || !form.name.trim()) { setErr('Park and name are required'); return; }
    setSaving(true); setErr('');
    try {
      const result = zone
        ? await apiFetch(`/api/operations/zones/${zone.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: form.name, zone_type: form.zone_type, is_active: form.is_active }),
          })
        : await apiFetch('/api/operations/zones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <span>{zone ? 'Edit Zone' : 'Add Zone'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          {!zone && (
            <div className="form-row">
              <label className="form-label">Park *</label>
              <select className="form-control" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Zone Name *</label>
            <input className="form-control" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. North Entry" required/>
          </div>
          <div className="form-row">
            <label className="form-label">Zone Type</label>
            <select className="form-control" value={form.zone_type}
              onChange={e => setForm(f => ({ ...f, zone_type: e.target.value }))}>
              {ZONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {zone && (
            <div className="form-row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}/>
                Active
              </label>
            </div>
          )}
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
