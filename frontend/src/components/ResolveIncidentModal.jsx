'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ResolveIncidentModal({ incident, onSave, onClose }) {
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const result = await apiFetch(`/api/operations/incidents/${incident.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_notes: notes || null }),
      });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <span>Resolve Incident</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          {err && <div className="form-error">{err}</div>}
          <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 12 }}>
            <strong>{incident.title}</strong>
          </div>
          <div className="form-row">
            <label className="form-label">Resolution Notes</label>
            <textarea className="form-control" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe how the incident was resolved (optional)"/>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Resolving…' : 'Mark Resolved'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
