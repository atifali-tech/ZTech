'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

const CATEGORIES = ['Adult', 'Child', 'Senior Citizen', 'Toddler'];
const DAY_TYPES  = ['Weekday', 'Weekend', 'Holiday'];

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function PricingRuleModal({ parkId, rule, onSave, onClose }) {
  const isEdit = !!rule;

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    category:       rule?.category       ?? 'Adult',
    day_type:       rule?.day_type       ?? 'Weekday',
    base_price:     rule?.base_price     ?? '',
    gst_rate_id:    rule?.gst_rate_id    ?? '',
    effective_from: rule?.effective_from ? rule.effective_from.slice(0, 10) : today,
    effective_to:   rule?.effective_to   ? rule.effective_to.slice(0, 10)   : '',
    is_active:      rule?.is_active      ?? true,
  });
  const [gstRates, setGstRates] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    apiFetch(`/api/parks/${parkId}/pricing/gst-rates`)
      .then(setGstRates)
      .catch(() => {});
  }, [parkId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const price = parseFloat(form.base_price);
    if (isNaN(price) || price < 0) { setError('Base price must be a non-negative number'); return; }
    if (form.effective_to && form.effective_to < form.effective_from) {
      setError('Effective To must be on or after Effective From');
      return;
    }

    setSaving(true);
    try {
      const body = {
        ...form,
        base_price:  price,
        gst_rate_id: form.gst_rate_id ? Number(form.gst_rate_id) : null,
        effective_to: form.effective_to || null,
      };
      const saved = isEdit
        ? await apiFetch(`/api/parks/${parkId}/pricing/${rule.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await apiFetch(`/api/parks/${parkId}/pricing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedGst = gstRates.find(g => g.id === Number(form.gst_rate_id));
  const totalGst    = selectedGst ? (parseFloat(selectedGst.cgst_pct) + parseFloat(selectedGst.sgst_pct)) : null;
  const basePrice   = parseFloat(form.base_price);
  const taxAmount   = totalGst && !isNaN(basePrice) ? (basePrice * totalGst / 100) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{isEdit ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</div>
          <button className="modal-close" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {error && (
              <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '9px 12px', fontSize: 12.5, color: 'var(--red)', display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="warning" size={13} color="var(--red)"/> {error}
              </div>
            )}

            {/* Category + Day Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="filter">
                <label className="filter-label">Ticket Category *</label>
                <select className="filter-input" value={form.category} onChange={e => set('category', e.target.value)} required>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter">
                <label className="filter-label">Day Type *</label>
                <select className="filter-input" value={form.day_type} onChange={e => set('day_type', e.target.value)} required>
                  {DAY_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            {/* Base Price + GST */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="filter">
                <label className="filter-label">Base Price (₹) *</label>
                <input
                  type="number" min="0" step="0.01" className="filter-input"
                  value={form.base_price}
                  onChange={e => set('base_price', e.target.value)}
                  placeholder="e.g. 200"
                  required
                />
              </div>
              <div className="filter">
                <label className="filter-label">GST Rate</label>
                <select className="filter-input" value={form.gst_rate_id} onChange={e => set('gst_rate_id', e.target.value)}>
                  <option value="">— No GST —</option>
                  {gstRates.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.category} · {g.cgst_pct}% + {g.sgst_pct}% = {(parseFloat(g.cgst_pct) + parseFloat(g.sgst_pct))}%
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live price preview */}
            {!isNaN(basePrice) && basePrice >= 0 && (
              <div style={{
                background: 'var(--surface-2)', borderRadius: 6,
                padding: '10px 14px', fontSize: 12, color: 'var(--ink-3)',
                display: 'flex', gap: 20,
              }}>
                <span>Base: <strong style={{ color: 'var(--ink)' }}>₹{basePrice.toFixed(2)}</strong></span>
                {taxAmount !== null && (
                  <span>GST ({totalGst}%): <strong style={{ color: 'var(--ink)' }}>₹{taxAmount.toFixed(2)}</strong></span>
                )}
                {taxAmount !== null && (
                  <span>Total: <strong style={{ color: 'var(--teal)', fontSize: 13 }}>₹{(basePrice + taxAmount).toFixed(2)}</strong></span>
                )}
                {taxAmount === null && <span style={{ color: 'var(--ink-4)' }}>No GST applied</span>}
              </div>
            )}

            {/* Effective dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="filter">
                <label className="filter-label">Effective From *</label>
                <input
                  type="date" className="filter-input"
                  value={form.effective_from}
                  onChange={e => set('effective_from', e.target.value)}
                  required
                />
              </div>
              <div className="filter">
                <label className="filter-label">Effective To <span style={{ color: 'var(--ink-5)', fontWeight: 400 }}>(leave blank = open-ended)</span></label>
                <input
                  type="date" className="filter-input"
                  value={form.effective_to}
                  min={form.effective_from}
                  onChange={e => set('effective_to', e.target.value)}
                />
              </div>
            </div>

            {/* Active toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Active</span>
              <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>— inactive rules are saved but not applied</span>
            </label>

          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
