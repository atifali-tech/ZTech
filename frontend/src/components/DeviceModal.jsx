'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DEVICE_TYPES    = ['POS','QR Scanner','Printer','Tablet','Kiosk','RFID Reader','Turnstile','Biometric'];
const DEVICE_STATUSES = ['Online','Offline','Maintenance','Blocked','Outdated'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function DeviceModal({ device, parks, counters, onSave, onClose }) {
  const [form, setForm] = useState({
    park_id:          device?.park_id || parks[0]?.id || '',
    name:             device?.name || '',
    device_type:      device?.device_type || 'POS',
    software_version: device?.software_version || '',
    counter_id:       device?.counter_id || '',
    status:           device?.status || 'Offline',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const parkCounters = counters.filter(c => c.park_id === form.park_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Device name is required'); return; }
    setSaving(true); setErr('');
    try {
      const body = {
        park_id:          form.park_id,
        name:             form.name,
        device_type:      form.device_type,
        software_version: form.software_version || null,
        counter_id:       form.counter_id || null,
        status:           form.status,
      };
      const result = device
        ? await apiFetch(`/api/operations/devices/${device.id}`, { method: 'PUT',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await apiFetch('/api/operations/devices',               { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-head">
          <span className="modal-title">{device ? 'Edit Device' : 'Add Device'}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{err}</div>}

          {!device && parks.length > 1 && (
            <div className="field">
              <label className="field-label">Park *</label>
              <select className="field-input" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value, counter_id: '' }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Device Name *</label>
            <input className="field-input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. POS-01" autoFocus required/>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Device Type</label>
              <select className="field-input" value={form.device_type}
                onChange={e => setForm(f => ({ ...f, device_type: e.target.value }))}>
                {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Software Version</label>
              <input className="field-input" value={form.software_version}
                onChange={e => setForm(f => ({ ...f, software_version: e.target.value }))}
                placeholder="e.g. v2.1.0"/>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Assigned Counter (optional)</label>
            <select className="field-input" value={form.counter_id}
              onChange={e => setForm(f => ({ ...f, counter_id: e.target.value }))}>
              <option value="">— None —</option>
              {parkCounters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {device && (
            <div className="field">
              <label className="field-label">Status</label>
              <select className="field-input" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {DEVICE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
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
