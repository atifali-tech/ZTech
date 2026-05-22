'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmt(v) {
  return v != null ? `₹${parseFloat(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ReconcileShiftModal({ shift, onSave, onClose }) {
  const [notes,  setNotes]  = useState('');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const result = await apiFetch(`/api/operations/shifts/${shift.id}/reconcile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const v = shift.variance != null ? parseFloat(shift.variance) : null;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-head">
          <span>Reconcile Shift</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
            Marking shift for <strong>{shift.user_name}</strong> at <strong>{shift.park_name}</strong> as Reconciled.
          </p>
          {v != null && (
            <div style={{ marginBottom: 12 }}>
              <span className={v < 0 ? 'variance-bad' : v > 0 ? 'variance-ok' : ''} style={{ fontSize: 13 }}>
                Variance: {fmt(shift.variance)}
              </span>
              {v < 0 && <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 8 }}>Please note discrepancy in supervisor notes.</span>}
            </div>
          )}
          <div className="form-row">
            <label className="form-label">Supervisor Notes</label>
            <textarea className="form-control" rows={3}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Explain variance or confirm reconciliation…"/>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Reconciling…' : 'Mark Reconciled'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
