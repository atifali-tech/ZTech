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

export default function OpenShiftModal({ parks, counters, onSave, onClose }) {
  const [form, setForm] = useState({ park_id: parks[0]?.id || '', counter_id: '', opening_cash: '', expected_rev: '' });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const parkCounters = counters.filter(c => c.park_id === form.park_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const result = await apiFetch('/api/operations/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          park_id:      form.park_id,
          counter_id:   form.counter_id || null,
          opening_cash: form.opening_cash ? parseFloat(form.opening_cash) : null,
          expected_rev: form.expected_rev ? parseFloat(form.expected_rev) : null,
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
          <span className="modal-title">Open Shift</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>{err}</div>}

          {parks.length > 1 && (
            <div className="field">
              <label className="field-label">Park *</label>
              <select className="field-input" value={form.park_id}
                onChange={e => setForm(f => ({ ...f, park_id: e.target.value, counter_id: '' }))}>
                {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label">Counter (optional)</label>
            <select className="field-input" value={form.counter_id}
              onChange={e => setForm(f => ({ ...f, counter_id: e.target.value }))}>
              <option value="">— None —</option>
              {parkCounters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Opening Cash</label>
              <input className="field-input" type="number" min="0" step="0.01"
                value={form.opening_cash} onChange={e => setForm(f => ({ ...f, opening_cash: e.target.value }))}
                placeholder="e.g. 5000"/>
            </div>
            <div className="field">
              <label className="field-label">Expected Revenue</label>
              <input className="field-input" type="number" min="0" step="0.01"
                value={form.expected_rev} onChange={e => setForm(f => ({ ...f, expected_rev: e.target.value }))}
                placeholder="e.g. 50000"/>
            </div>
          </div>
        </form>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Opening…' : 'Open Shift'}</button>
        </div>
      </div>
    </div>
  );
}
