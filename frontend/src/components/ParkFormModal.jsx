'use client';
import { useState } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PRESET_COLORS = ['#1D9E75','#378ADD','#E24B4A','#EF9F27','#7F77DD','#E8B84B','#5DCAA5','#62ADE8'];

export default function ParkFormModal({ park: editPark, onSave, onClose }) {
  const isEdit = Boolean(editPark);
  const [id,       setId]       = useState(editPark?.id        || '');
  const [name,     setName]     = useState(editPark?.name      || '');
  const [city,     setCity]     = useState(editPark?.city      || '');
  const [state,    setState]    = useState(editPark?.state     || '');
  const [color,    setColor]    = useState(editPark?.color_hex || '#1D9E75');
  const [capacity, setCapacity] = useState(editPark?.capacity  || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit && (!id || id.length > 10)) {
      setError('Park code is required and must be max 10 characters');
      return;
    }
    setSaving(true);
    try {
      const body = { name, city, state, color_hex: color, capacity: capacity ? parseInt(capacity) : null };
      if (!isEdit) body.id = id.toUpperCase();

      const url    = isEdit ? `/api/parks/${editPark.id}` : '/api/parks';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(`${BASE}${url}`, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <Icon name="map" size={15} color="var(--teal)"/>
          <span className="modal-title">{isEdit ? `Edit — ${editPark.name}` : 'Add Park'}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="chevron" size={13}/></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!isEdit && (
              <div className="field">
                <label className="field-label">Park Code <span style={{color:'var(--ink-4)',fontWeight:400,textTransform:'none'}}>(max 10 chars, unique ID)</span></label>
                <input className="field-input" required maxLength={10} value={id}
                  onChange={e=>setId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                  placeholder="e.g. ZP008"/>
              </div>
            )}

            <div className="field-row">
              <div className="field">
                <label className="field-label">Park Name</label>
                <input className="field-input" required value={name} onChange={e=>setName(e.target.value)} placeholder="ZingParks Gurgaon"/>
              </div>
              <div className="field">
                <label className="field-label">Capacity</label>
                <input className="field-input" type="number" min="0" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="5000"/>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">City</label>
                <input className="field-input" required value={city} onChange={e=>setCity(e.target.value)} placeholder="Gurgaon"/>
              </div>
              <div className="field">
                <label className="field-label">State</label>
                <input className="field-input" required value={state} onChange={e=>setState(e.target.value)} placeholder="Haryana"/>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', flexShrink: 0,
                    outline: color === c ? `3px solid var(--ink)` : '3px solid transparent',
                    outlineOffset: 2,
                  }}/>
                ))}
                <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                  style={{ width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}/>
                <span className="mono" style={{fontSize:12,color:'var(--ink-3)'}}>{color}</span>
              </div>
            </div>

            {error && (
              <div style={{padding:'8px 12px',borderRadius:5,background:'var(--red-50)',color:'var(--red)',fontSize:12.5,border:'1px solid var(--red-100)'}}>
                {error}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Park'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
