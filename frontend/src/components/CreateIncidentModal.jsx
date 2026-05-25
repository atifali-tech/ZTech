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
    if (!form.title.trim()) { setErr('Title is required'); return; }
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
          <span className="modal-title">Create Incident</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          {err && <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{err}</div>}

          {parks.length > 1 && (
            <div className="field">
              <label className="field-label">Park *</label>
              <select className="field-input" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label className="field-label">Type</label>
              <select className="field-input" value={form.incident_type}
                onChange={e => setForm(f => ({ ...f, incident_type: e.target.value }))}>
                {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Severity</label>
              <select className="field-input" value={form.severity}
                onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Title *</label>
            <input className="field-input" type="text" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Brief description of the incident" autoFocus/>
          </div>

          <div className="field">
            <label className="field-label">Description</label>
            <textarea className="field-input" rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional additional context"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}/>
          </div>

          <div className="field">
            <label className="field-label">Assign To</label>
            <select className="field-input" value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </form>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Incident'}
          </button>
        </div>
      </div>
    </div>
  );
}
