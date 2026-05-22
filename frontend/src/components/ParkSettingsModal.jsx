'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function ParkSettingsModal({ park, onClose, onSaved }) {
  const [form,   setForm]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  useEffect(() => {
    apiFetch(`/api/parks/${park.id}/operational-settings`)
      .then(s => setForm({
        supports_entry_tracking:  s.supports_entry_tracking  ?? false,
        supports_devices:         s.supports_devices          ?? false,
        supports_zones:           s.supports_zones            ?? false,
        max_daily_capacity:       s.max_daily_capacity        ?? '',
        alert_threshold_pct:      s.alert_threshold_pct       ?? 80,
        occupancy_warning_pct:    s.occupancy_warning_pct     ?? 90,
        occupancy_critical_pct:   s.occupancy_critical_pct    ?? 95,
        shift_variance_threshold: s.shift_variance_threshold  ?? 500,
        auto_close_shifts:        s.auto_close_shifts         ?? false,
      }))
      .catch(e => setErr(e.message));
  }, [park.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const body = {
        ...form,
        max_daily_capacity:       form.max_daily_capacity !== '' ? Number(form.max_daily_capacity) : null,
        alert_threshold_pct:      Number(form.alert_threshold_pct),
        occupancy_warning_pct:    Number(form.occupancy_warning_pct),
        occupancy_critical_pct:   Number(form.occupancy_critical_pct),
        shift_variance_threshold: Number(form.shift_variance_threshold),
      };
      const saved = await apiFetch(`/api/parks/${park.id}/operational-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSaved(saved);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <span>Operational Settings — {park.name}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        {!form ? (
          <div className="modal-body">
            {err ? <div className="form-error">{err}</div> : <div style={{ padding: 8, color: 'var(--ink-4)', fontSize: 13 }}>Loading…</div>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            {err && <div className="form-error">{err}</div>}

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-4)', letterSpacing: '.06em', marginBottom: 10 }}>
              Capabilities
            </div>
            <div className="form-row" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                ['supports_entry_tracking', 'Entry / Occupancy Tracking'],
                ['supports_devices',        'Device Management'],
                ['supports_zones',          'Zone Management'],
                ['auto_close_shifts',       'Auto-close Shifts at Midnight'],
              ].map(([field, label]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.checked }))}/>
                  {label}
                </label>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-4)', letterSpacing: '.06em', margin: '16px 0 10px' }}>
              Capacity & Thresholds
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Max Daily Capacity</label>
                <input className="form-control" type="number" min="0" value={form.max_daily_capacity}
                  onChange={e => setForm(f => ({ ...f, max_daily_capacity: e.target.value }))}
                  placeholder="Unlimited"/>
              </div>
              <div>
                <label className="form-label">Shift Variance Alert (₹)</label>
                <input className="form-control" type="number" min="0" value={form.shift_variance_threshold}
                  onChange={e => setForm(f => ({ ...f, shift_variance_threshold: e.target.value }))}/>
              </div>
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">Alert Threshold (%)</label>
                <input className="form-control" type="number" min="1" max="100" value={form.alert_threshold_pct}
                  onChange={e => setForm(f => ({ ...f, alert_threshold_pct: e.target.value }))}/>
              </div>
              <div>
                <label className="form-label">Occupancy Warning (%)</label>
                <input className="form-control" type="number" min="1" max="100" value={form.occupancy_warning_pct}
                  onChange={e => setForm(f => ({ ...f, occupancy_warning_pct: e.target.value }))}/>
              </div>
              <div>
                <label className="form-label">Occupancy Critical (%)</label>
                <input className="form-control" type="number" min="1" max="100" value={form.occupancy_critical_pct}
                  onChange={e => setForm(f => ({ ...f, occupancy_critical_pct: e.target.value }))}/>
              </div>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
