'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { PARK_COLORS_ORDERED } from '../lib/parkColors';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PRESET_COLORS = PARK_COLORS_ORDERED;

// ── Field-level error component ───────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 3, lineHeight: 1.4 }}>{msg}</div>;
}

// ── Fetch city/state from Indian pin code via postal API ──────
async function lookupPincode(pin) {
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  const json = await res.json();
  if (!json?.[0] || json[0].Status !== 'Success') return null;
  const post = json[0].PostOffice?.[0];
  if (!post) return null;
  return { city: post.District, state: post.State };
}

export default function ParkFormModal({ park: editPark, onSave, onClose }) {
  const isEdit = Boolean(editPark);

  // ── Field state ───────────────────────────────────────────
  const [id,       setId]       = useState(editPark?.id        || '');
  const [name,     setName]     = useState(editPark?.name      || '');
  const [capacity, setCapacity] = useState(editPark?.capacity  || '');
  const [pincode,  setPincode]  = useState(editPark?.pincode   || '');
  const [city,     setCity]     = useState(editPark?.city      || '');
  const [state,    setState]    = useState(editPark?.state     || '');
  const [color,    setColor]    = useState(editPark?.color_hex || '#1D9E75');

  // ── Validation errors ─────────────────────────────────────
  const [errs, setErrs] = useState({});

  // ── Async check state ─────────────────────────────────────
  const [codeStatus,    setCodeStatus]    = useState(null); // null | 'checking' | 'ok' | 'taken'
  const [pinStatus,     setPinStatus]     = useState(null); // null | 'loading' | 'ok' | 'fail'
  const [locationLocked, setLocationLocked] = useState(false); // city/state auto-filled

  // ── Submission state ──────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const codeCheckTimer = useRef(null);

  // ── Park code uniqueness check ────────────────────────────
  const checkCode = (val) => {
    clearTimeout(codeCheckTimer.current);
    if (!val || isEdit) return;
    setCodeStatus('checking');
    codeCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/parks/${encodeURIComponent(val)}`, { credentials: 'include' });
        setCodeStatus(res.status === 404 ? 'ok' : 'taken');
        setErrs(e => ({
          ...e,
          id: res.status === 404 ? '' : 'Park code already exists. Please use a different code.',
        }));
      } catch {
        setCodeStatus(null);
      }
    }, 500);
  };

  // ── Pin code auto-lookup ──────────────────────────────────
  useEffect(() => {
    if (pincode.length !== 6) return;
    setPinStatus('loading');
    setLocationLocked(false);
    lookupPincode(pincode).then(result => {
      if (result) {
        setCity(result.city);
        setState(result.state);
        setLocationLocked(true);
        setPinStatus('ok');
        setErrs(e => ({ ...e, pincode: '', city: '', state: '' }));
      } else {
        setCity('');
        setState('');
        setPinStatus('fail');
        setErrs(e => ({ ...e, pincode: 'Location could not be identified from this pin code. Please enter city and state manually.' }));
      }
    }).catch(() => {
      setPinStatus('fail');
      setErrs(e => ({ ...e, pincode: 'Unable to identify city/state from pin code.' }));
    });
  }, [pincode]);

  // ── Per-field validators ──────────────────────────────────
  const validate = () => {
    const e = {};
    if (!isEdit) {
      if (!id.trim())          e.id = 'Park code is required.';
      else if (id.length > 10) e.id = 'Park code must be 10 characters or fewer.';
      else if (codeStatus === 'taken') e.id = 'Park code already exists. Please use a different code.';
    }
    if (!name.trim())          e.name     = 'Park name is required.';
    if (!capacity)             e.capacity = 'Capacity is required.';
    else if (isNaN(Number(capacity)) || !Number.isInteger(Number(capacity))) e.capacity = 'Only numeric values are allowed.';
    else if (Number(capacity) <= 0)  e.capacity = 'Capacity must be greater than 0.';
    if (!pincode)              e.pincode  = 'Pin code is required.';
    else if (!/^\d{6}$/.test(pincode)) e.pincode = 'Enter a valid 6-digit pin code.';
    if (!city.trim())          e.city     = 'City is required.';
    if (!state.trim())         e.state    = 'State is required.';
    return e;
  };

  const isValid = (() => {
    if (saving) return false;
    if (!isEdit && (!id || codeStatus === 'taken' || codeStatus === 'checking')) return false;
    if (!name.trim() || !city.trim() || !state.trim()) return false;
    if (!pincode || !/^\d{6}$/.test(pincode)) return false;
    const cap = Number(capacity);
    if (!capacity || isNaN(cap) || cap <= 0 || !Number.isInteger(cap)) return false;
    return true;
  })();

  const blurField = (field) => (e) => {
    const val = e.target.value;
    const next = {};
    if (field === 'id') {
      if (!val.trim()) next.id = 'Park code is required.';
      else if (val.length > 10) next.id = 'Park code must be 10 characters or fewer.';
    }
    if (field === 'name'     && !val.trim()) next.name     = 'Park name is required.';
    if (field === 'capacity') {
      if (!val) next.capacity = 'Capacity is required.';
      else if (isNaN(Number(val)) || !Number.isInteger(Number(val))) next.capacity = 'Only numeric values are allowed.';
      else if (Number(val) <= 0)  next.capacity = 'Capacity must be greater than 0.';
    }
    if (field === 'pincode') {
      if (!val) next.pincode = 'Pin code is required.';
      else if (!/^\d{6}$/.test(val)) next.pincode = 'Enter a valid 6-digit pin code.';
    }
    if (field === 'city'  && !val.trim()) next.city  = 'City is required.';
    if (field === 'state' && !val.trim()) next.state = 'State is required.';
    setErrs(e => ({ ...e, ...next }));
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) { setErrs(errors); return; }
    setSaving(true);
    setSubmitErr('');
    try {
      const body = {
        name: name.trim(), city: city.trim(), state: state.trim(),
        color_hex: color,
        capacity: parseInt(capacity),
        pincode: pincode,
      };
      if (!isEdit) body.id = id.toUpperCase();

      const url    = isEdit ? `/api/parks/${editPark.id}` : '/api/parks';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(`${BASE}${url}`, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setErrs(ex => ({ ...ex, id: 'Park code already exists. Please use a different code.' }));
          return;
        }
        throw new Error('Unable to create park. Please try again.');
      }
      onSave(data);
    } catch (err) {
      setSubmitErr(err.message || 'Unable to create park. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────
  const inputStyle = (field) => ({
    borderColor: errs[field] ? 'var(--red)' : (field === 'id' && codeStatus === 'ok') ? 'var(--good)' : undefined,
  });

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <Icon name="map" size={15} color="var(--teal)"/>
          <span className="modal-title">{isEdit ? `Edit — ${editPark.name}` : 'Add Park'}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="chevron" size={13}/></button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">

            {/* Park Code */}
            {!isEdit && (
              <div className="field">
                <label className="field-label">
                  Park Code <span style={{ color: 'var(--ink-4)', fontWeight: 400, textTransform: 'none' }}>(max 10 chars, unique ID)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="field-input"
                    maxLength={10}
                    value={id}
                    style={inputStyle('id')}
                    placeholder="e.g. ZP008"
                    onChange={e => {
                      const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      setId(v);
                      setCodeStatus(null);
                      setErrs(ex => ({ ...ex, id: '' }));
                      checkCode(v);
                    }}
                    onBlur={blurField('id')}
                  />
                  {codeStatus === 'checking' && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--ink-4)' }}>
                      Checking…
                    </span>
                  )}
                  {codeStatus === 'ok' && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>
                      ✓ Available
                    </span>
                  )}
                </div>
                <FieldError msg={errs.id}/>
              </div>
            )}

            {/* Park Name */}
            <div className="field">
              <label className="field-label">Park Name</label>
              <input
                className="field-input"
                value={name}
                style={inputStyle('name')}
                placeholder="e.g. ZingParks Gurgaon"
                onChange={e => { setName(e.target.value); setErrs(ex => ({ ...ex, name: '' })); }}
                onBlur={blurField('name')}
              />
              <FieldError msg={errs.name}/>
            </div>

            {/* Capacity */}
            <div className="field">
              <label className="field-label">Capacity</label>
              <input
                className="field-input"
                inputMode="numeric"
                value={capacity}
                style={inputStyle('capacity')}
                placeholder="Maximum visitors per day"
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setCapacity(v);
                  setErrs(ex => ({ ...ex, capacity: '' }));
                }}
                onBlur={blurField('capacity')}
              />
              <FieldError msg={errs.capacity}/>
            </div>

            {/* Pin Code */}
            <div className="field">
              <label className="field-label">
                Pin Code
                {pinStatus === 'loading' && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-4)', fontWeight: 400, textTransform: 'none' }}>
                    Looking up location…
                  </span>
                )}
                {pinStatus === 'ok' && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--good)', fontWeight: 600, textTransform: 'none' }}>
                    ✓ Location found
                  </span>
                )}
              </label>
              <input
                className="field-input"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                style={inputStyle('pincode')}
                placeholder="e.g. 122001"
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setPincode(v);
                  setPinStatus(null);
                  setLocationLocked(false);
                  setErrs(ex => ({ ...ex, pincode: '' }));
                  if (v.length < 6) { setCity(''); setState(''); }
                }}
                onBlur={blurField('pincode')}
              />
              <FieldError msg={errs.pincode}/>
            </div>

            {/* City + State */}
            <div className="field-row">
              <div className="field">
                <label className="field-label">City</label>
                <input
                  className="field-input"
                  value={city}
                  readOnly={locationLocked}
                  style={{
                    ...inputStyle('city'),
                    background: locationLocked ? 'var(--surface-2)' : undefined,
                    color: locationLocked ? 'var(--ink-2)' : undefined,
                  }}
                  placeholder={locationLocked ? '' : 'Auto-populated from pin code'}
                  onChange={e => { if (!locationLocked) { setCity(e.target.value); setErrs(ex => ({ ...ex, city: '' })); } }}
                  onBlur={blurField('city')}
                />
                <FieldError msg={errs.city}/>
              </div>
              <div className="field">
                <label className="field-label">State</label>
                <input
                  className="field-input"
                  value={state}
                  readOnly={locationLocked}
                  style={{
                    ...inputStyle('state'),
                    background: locationLocked ? 'var(--surface-2)' : undefined,
                    color: locationLocked ? 'var(--ink-2)' : undefined,
                  }}
                  placeholder={locationLocked ? '' : 'Auto-populated from pin code'}
                  onChange={e => { if (!locationLocked) { setState(e.target.value); setErrs(ex => ({ ...ex, state: '' })); } }}
                  onBlur={blurField('state')}
                />
                <FieldError msg={errs.state}/>
              </div>
            </div>

            {/* Color */}
            <div className="field">
              <label className="field-label">Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', flexShrink: 0,
                    outline: color === c ? '3px solid var(--ink)' : '3px solid transparent',
                    outlineOffset: 2,
                  }}/>
                ))}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  style={{ width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}/>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{color}</span>
              </div>
            </div>

            {submitErr && (
              <div style={{ padding: '8px 12px', borderRadius: 5, background: 'var(--red-50)', color: 'var(--red)', fontSize: 12.5, border: '1px solid var(--red-100)' }}>
                {submitErr}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!isValid || saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Park'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
