'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const COUNTER_TYPES = ['Ticketing','Refund','VIP','Self-Service','Parking','Temporary'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function CounterModal({ counter, parks, zones, users, devices, onSave, onClose }) {
  const [form, setForm] = useState({
    park_id:            counter?.park_id || parks[0]?.id || '',
    zone_id:            counter?.zone_id || '',
    name:               counter?.name || '',
    counter_type:       counter?.counter_type || 'Ticketing',
    is_active:          counter?.is_active ?? true,
    assigned_user_id:   counter?.assigned_user_id || '',
    assigned_device_id: counter?.assigned_device_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const parkZones   = zones.filter(z => z.park_id === form.park_id && z.is_active);
  const parkUsers   = users.filter(u => u.park_id === form.park_id || !u.park_id);
  const parkDevices = devices.filter(d => d.park_id === form.park_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.park_id || !form.name.trim()) { setErr('Park and name are required'); return; }
    setSaving(true); setErr('');
    try {
      const body = {
        park_id:            form.park_id,
        zone_id:            form.zone_id || null,
        name:               form.name,
        counter_type:       form.counter_type,
        is_active:          form.is_active,
        assigned_user_id:   form.assigned_user_id || null,
        assigned_device_id: form.assigned_device_id || null,
      };
      const result = counter
        ? await apiFetch(`/api/operations/counters/${counter.id}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch('/api/operations/counters',                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <span>{counter ? 'Edit Counter' : 'Add Counter'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          {!counter && (
            <div className="form-row">
              <label className="form-label">Park *</label>
              <select className="form-control" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value, zone_id: '', assigned_user_id: '', assigned_device_id: '' }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Counter Name *</label>
              <input className="form-control" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Counter A" required/>
            </div>
            <div>
              <label className="form-label">Counter Type</label>
              <select className="form-control" value={form.counter_type}
                onChange={e => setForm(f => ({ ...f, counter_type: e.target.value }))}>
                {COUNTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Zone (optional)</label>
            <select className="form-control" value={form.zone_id}
              onChange={e => setForm(f => ({ ...f, zone_id: e.target.value }))}>
              <option value="">— None —</option>
              {parkZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Assigned User (optional)</label>
            <select className="form-control" value={form.assigned_user_id}
              onChange={e => setForm(f => ({ ...f, assigned_user_id: e.target.value }))}>
              <option value="">— None —</option>
              {parkUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Assigned Device (optional)</label>
            <select className="form-control" value={form.assigned_device_id}
              onChange={e => setForm(f => ({ ...f, assigned_device_id: e.target.value }))}>
              <option value="">— None —</option>
              {parkDevices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.device_type})</option>)}
            </select>
          </div>
          {counter && (
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
