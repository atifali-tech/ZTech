'use client';
import { useState, useEffect, useRef } from 'react';
import Icon    from './Icon';
import Toast   from './Toast';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PRESET_COLORS = ['#1D9E75','#378ADD','#E24B4A','#EF9F27','#7F77DD','#E8B84B','#5DCAA5','#62ADE8'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.06em', color: 'var(--ink-4)', display: 'block', marginBottom: 5,
    }}>
      {children}
    </label>
  );
}

function CheckboxRow({ checked, onChange, label, sub }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        style={{ marginTop: 2, flexShrink: 0 }}
      />
      <div>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{sub}</div>}
      </div>
    </label>
  );
}

export default function ParkWorkspaceSettings({ parkId, park, settings: initialSettings, onParkSaved, onSettingsSaved }) {
  const { can } = useAuth();

  // Park details form
  const [parkForm,    setParkForm]    = useState(null);
  const [parkSaving,  setParkSaving]  = useState(false);
  const [parkError,   setParkError]   = useState('');

  // Operational settings form
  const [opsForm,     setOpsForm]     = useState(null);
  const [opsLoading,  setOpsLoading]  = useState(true);
  const [opsSaving,   setOpsSaving]   = useState(false);
  const [opsError,    setOpsError]    = useState('');

  const [toast, setToast] = useState({ msg: null, type: 'ok' });
  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  // Seed park form from prop
  useEffect(() => {
    if (!park) return;
    setParkForm({
      name:      park.name      || '',
      city:      park.city      || '',
      state:     park.state     || '',
      color_hex: park.color_hex || '#1D9E75',
      capacity:  park.capacity  || '',
    });
  }, [park?.id]);

  // Load operational settings fresh (may differ from summary snapshot)
  const opsRef = useRef(null);
  opsRef.current = async () => {
    setOpsLoading(true);
    try {
      const s = await apiFetch(`/api/parks/${parkId}/operational-settings`);
      setOpsForm({
        supports_entry_tracking:  s.supports_entry_tracking  ?? false,
        supports_devices:         s.supports_devices          ?? false,
        supports_zones:           s.supports_zones            ?? false,
        supports_gates:           s.supports_gates            ?? false,
        supports_shifts:          s.supports_shifts           ?? false,
        auto_close_shifts:        s.auto_close_shifts         ?? false,
        max_daily_capacity:       s.max_daily_capacity        ?? '',
        alert_threshold_pct:      s.alert_threshold_pct       ?? 80,
        occupancy_warning_pct:    s.occupancy_warning_pct     ?? 90,
        occupancy_critical_pct:   s.occupancy_critical_pct    ?? 95,
        shift_variance_threshold: s.shift_variance_threshold  ?? 500,
        gst_enabled:              s.gst_enabled               ?? false,
        gst_rate:                 s.gst_rate                  ?? 18,
        gst_number:               s.gst_number                ?? '',
      });
    } catch (e) { setOpsError(e.message); }
    finally { setOpsLoading(false); }
  };

  useEffect(() => { opsRef.current?.(); }, [parkId]);

  const handleParkSave = async () => {
    if (!parkForm) return;
    setParkSaving(true); setParkError('');
    try {
      const saved = await apiFetch(`/api/parks/${parkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      parkForm.name,
          city:      parkForm.city,
          state:     parkForm.state,
          color_hex: parkForm.color_hex,
          capacity:  parkForm.capacity !== '' ? parseInt(parkForm.capacity) : null,
        }),
      });
      onParkSaved?.(saved);
      showToast('Park details saved');
    } catch (e) { setParkError(e.message); }
    finally { setParkSaving(false); }
  };

  const handleOpsSave = async () => {
    if (!opsForm) return;
    setOpsSaving(true); setOpsError('');
    try {
      const body = {
        ...opsForm,
        max_daily_capacity:       opsForm.max_daily_capacity !== '' ? Number(opsForm.max_daily_capacity) : null,
        alert_threshold_pct:      Number(opsForm.alert_threshold_pct),
        occupancy_warning_pct:    Number(opsForm.occupancy_warning_pct),
        occupancy_critical_pct:   Number(opsForm.occupancy_critical_pct),
        shift_variance_threshold: Number(opsForm.shift_variance_threshold),
        gst_rate:                 Number(opsForm.gst_rate),
      };
      const saved = await apiFetch(`/api/parks/${parkId}/operational-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSettingsSaved?.(saved);
      showToast('Settings saved');
    } catch (e) { setOpsError(e.message); }
    finally { setOpsSaving(false); }
  };

  const setP = (k, v) => setParkForm(f => ({ ...f, [k]: v }));
  const setO = (k, v) => setOpsForm(f => ({ ...f, [k]: v }));

  const canEdit = can('parks.edit');

  return (
    <>
      {/* ── Park Details ── */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Park Details</div>
        </div>
        <div className="sec-body">
          {!parkForm ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <FieldLabel>Park Name</FieldLabel>
                  <input className="field-input" value={parkForm.name}
                    onChange={e => setP('name', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <FieldLabel>Capacity</FieldLabel>
                  <input className="field-input" type="number" min="0"
                    value={parkForm.capacity}
                    onChange={e => setP('capacity', e.target.value)}
                    disabled={!canEdit}
                    placeholder="Unlimited"
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <FieldLabel>City</FieldLabel>
                  <input className="field-input" value={parkForm.city}
                    onChange={e => setP('city', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <FieldLabel>State</FieldLabel>
                  <input className="field-input" value={parkForm.state}
                    onChange={e => setP('state', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <FieldLabel>Colour</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" disabled={!canEdit}
                      onClick={() => setP('color_hex', c)}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', background: c, border: 'none',
                        cursor: canEdit ? 'pointer' : 'default', flexShrink: 0,
                        outline: parkForm.color_hex === c ? '3px solid var(--ink)' : '3px solid transparent',
                        outlineOffset: 2,
                      }}/>
                  ))}
                  <input type="color" value={parkForm.color_hex}
                    onChange={e => setP('color_hex', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: 32, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}/>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{parkForm.color_hex}</span>
                </div>
              </div>

              {parkError && (
                <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
                  {parkError}
                </div>
              )}

              {canEdit && (
                <button className="btn btn-primary btn-sm" onClick={handleParkSave} disabled={parkSaving}>
                  {parkSaving ? 'Saving…' : 'Save Park Details'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Operational Settings ── */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Capabilities</div>
        </div>
        <div className="sec-body">
          {opsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Loading…</div>
          ) : !opsForm ? (
            <div style={{ fontSize: 13, color: 'var(--red)' }}>{opsError || 'Failed to load settings'}</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                <CheckboxRow
                  checked={opsForm.supports_entry_tracking}
                  onChange={v => setO('supports_entry_tracking', v)}
                  label="Entry / Occupancy Tracking"
                  sub="Track visitor entry count and gate throughput"
                />
                <CheckboxRow
                  checked={opsForm.supports_devices}
                  onChange={v => setO('supports_devices', v)}
                  label="Device Management"
                  sub="Register and monitor scanning devices"
                />
                <CheckboxRow
                  checked={opsForm.supports_zones}
                  onChange={v => setO('supports_zones', v)}
                  label="Zone Management"
                  sub="Divide park into named operational zones"
                />
                <CheckboxRow
                  checked={opsForm.supports_gates}
                  onChange={v => setO('supports_gates', v)}
                  label="Gate Management"
                  sub="Configure entry, exit and mixed gates"
                />
                <CheckboxRow
                  checked={opsForm.supports_shifts}
                  onChange={v => setO('supports_shifts', v)}
                  label="Shift Tracking"
                  sub="Cashier shift open / close / reconcile"
                />
                <CheckboxRow
                  checked={opsForm.auto_close_shifts}
                  onChange={v => setO('auto_close_shifts', v)}
                  label="Auto-close Shifts at Midnight"
                  sub="Open shifts are closed automatically at 00:00"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Capacity & Thresholds ── */}
      {opsForm && (
        <div className="sec">
          <div className="sec-head">
            <div className="sec-title">Capacity & Thresholds</div>
          </div>
          <div className="sec-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <FieldLabel>Max Daily Capacity</FieldLabel>
                <input className="field-input" type="number" min="0"
                  value={opsForm.max_daily_capacity}
                  onChange={e => setO('max_daily_capacity', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Unlimited"
                  style={{ width: '100%' }}/>
              </div>
              <div>
                <FieldLabel>Shift Variance Alert (₹)</FieldLabel>
                <input className="field-input" type="number" min="0"
                  value={opsForm.shift_variance_threshold}
                  onChange={e => setO('shift_variance_threshold', e.target.value)}
                  disabled={!canEdit}
                  style={{ width: '100%' }}/>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <FieldLabel>Occupancy Alert Levels (%)</FieldLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>Alert at</div>
                  <input className="field-input" type="number" min="1" max="100"
                    value={opsForm.alert_threshold_pct}
                    onChange={e => setO('alert_threshold_pct', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>Warning at</div>
                  <input className="field-input" type="number" min="1" max="100"
                    value={opsForm.occupancy_warning_pct}
                    onChange={e => setO('occupancy_warning_pct', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4 }}>Critical at</div>
                  <input className="field-input" type="number" min="1" max="100"
                    value={opsForm.occupancy_critical_pct}
                    onChange={e => setO('occupancy_critical_pct', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GST Settings ── */}
      {opsForm && (
        <div className="sec">
          <div className="sec-head">
            <div className="sec-title">GST Settings</div>
          </div>
          <div className="sec-body">
            <CheckboxRow
              checked={opsForm.gst_enabled}
              onChange={v => setO('gst_enabled', v)}
              label="GST Enabled"
              sub="Apply GST to ticket sales for this park"
            />
            {opsForm.gst_enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
                <div>
                  <FieldLabel>GST Rate (%)</FieldLabel>
                  <input className="field-input" type="number" min="0" max="100" step="0.5"
                    value={opsForm.gst_rate}
                    onChange={e => setO('gst_rate', e.target.value)}
                    disabled={!canEdit}
                    style={{ width: '100%' }}/>
                </div>
                <div>
                  <FieldLabel>GST Registration Number</FieldLabel>
                  <input className="field-input"
                    value={opsForm.gst_number}
                    onChange={e => setO('gst_number', e.target.value)}
                    disabled={!canEdit}
                    placeholder="e.g. 27AAPFU0939F1ZV"
                    style={{ width: '100%' }}/>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Save operational settings ── */}
      {opsForm && canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleOpsSave} disabled={opsSaving}>
            {opsSaving ? 'Saving…' : 'Save Operational Settings'}
          </button>
          {opsError && (
            <span style={{ fontSize: 12, color: 'var(--red)' }}>{opsError}</span>
          )}
        </div>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
