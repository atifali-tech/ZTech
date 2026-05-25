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
    if (!form.name.trim()) { setErr('Zone name is required'); return; }
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
          <span className="modal-title">{zone ? 'Edit Zone' : 'Add Zone'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{err}</div>}

          {!zone && parks.length > 1 && (
            <div className="field">
              <label className="field-label">Park *</label>
              <select className="field-input" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Zone Name *</label>
            <input className="field-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. North Entry" autoFocus required/>
          </div>

          <div className="field">
            <label className="field-label">Zone Type</label>
            <select className="field-input" value={form.zone_type}
              onChange={e => setForm(f => ({ ...f, zone_type: e.target.value }))}>
              {ZONE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {zone && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                style={{ accentColor: 'var(--teal)', width: 14, height: 14 }}/>
              Active
            </label>
          )}
        </form>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
