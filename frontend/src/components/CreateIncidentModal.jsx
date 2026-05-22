'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const INCIDENT_TYPES = [
  'gate_blocked','scanner_failure','printer_failure','occupancy_breach',
  'shift_variance','device_offline','stale_heartbeat','counter_inactive','custom',
];
const SEVERITIES = ['critical','high','medium','low','info'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function CreateIncidentModal({ parks, users, onSave, onClose }) {
  const [form, setForm] = useState({
    park_id:       parks[0]?.id || '',
    incident_type: 'custom',
    severity:      'medium',
    title:         '',
    description:   '',
    assigned_to:   '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.park_id || !form.title.trim()) { setErr('Park and title are required'); return; }
    setSaving(true); setErr('');
    try {
      const result = await apiFetch('/api/operations/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          park_id:       form.park_id,
          incident_type: form.incident_type,
          severity:      form.severity,
          title:         form.title,
          description:   form.description || null,
          assigned_to:   form.assigned_to || null,
        }),
      });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-head">
          <span>Create Incident</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          {err && <div className="form-error">{err}</div>}
          <div className="form-row">
            <label className="form-label">Park *</label>
            <select className="form-control" value={form.park_id}
              onChange={e => setForm(f => ({ ...f, park_id: e.target.value }))}>
              {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Type</label>
              <select className="form-control" value={form.incident_type}
                onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Severity</label>
              <select className="form-control" value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Title *</label>
            <input className="form-control" type="text" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the incident"/>
          </div>
          <div className="form-row">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional additional context"/>
          </div>
          <div className="form-row">
            <label className="form-label">Assign To</label>
            <select className="form-control" value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
