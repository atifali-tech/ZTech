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

export default function CloseShiftModal({ shift, onSave, onClose }) {
  const [form, setForm] = useState({ declared_cash: '', actual_rev: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const result = await apiFetch(`/api/operations/shifts/${shift.id}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declared_cash: form.declared_cash ? parseFloat(form.declared_cash) : null,
          actual_rev:    form.actual_rev    ? parseFloat(form.actual_rev)    : null,
          notes:         form.notes || null,
        }),
      });
      onSave(result);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <span>Close Shift</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>
            Closing shift for <strong>{shift.user_name}</strong> at <strong>{shift.park_name}</strong>
            {shift.counter_name && <> — {shift.counter_name}</>}.
          </p>
          {(shift.opening_cash || shift.expected_rev) && (
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--ink-4)', marginBottom: 12 }}>
              {shift.opening_cash && <span>Opening cash: {fmt(shift.opening_cash)}</span>}
              {shift.expected_rev && <span>Expected: {fmt(shift.expected_rev)}</span>}
            </div>
          )}
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Declared Cash</label>
              <input className="form-control" type="number" min="0" step="0.01"
                value={form.declared_cash} onChange={e => setForm(f => ({ ...f, declared_cash: e.target.value }))}
                placeholder="Cash counted at close"/>
            </div>
            <div>
              <label className="form-label">Actual Revenue</label>
              <input className="form-control" type="number" min="0" step="0.01"
                value={form.actual_rev} onChange={e => setForm(f => ({ ...f, actual_rev: e.target.value }))}
                placeholder="Leave blank = declared"/>
            </div>
          </div>
          <div className="form-row">
            <label className="form-label">Supervisor Notes</label>
            <textarea className="form-control" rows={3}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any discrepancies or observations…"/>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={saving}>{saving ? 'Closing…' : 'Close Shift'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
