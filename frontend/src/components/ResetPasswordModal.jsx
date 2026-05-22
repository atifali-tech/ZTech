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

export default function ResetPasswordModal({ user, onClose, onDone }) {
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw.length < 8)  { setErr('Password must be at least 8 characters'); return; }
    if (pw !== confirm) { setErr('Passwords do not match'); return; }
    setSaving(true); setErr('');
    try {
      await apiFetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, new_password: pw }),
      });
      onDone();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <span>Reset Password — {user.name}</span>
          <button className="btn-ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {err && <div className="form-error">{err}</div>}
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
            Set a temporary password for <strong>{user.email}</strong>. The user will be required to change it on next login.
          </p>
          <div className="form-row">
            <label className="form-label">New Password *</label>
            <input className="form-control" type="password" value={pw}
              onChange={e => setPw(e.target.value)} placeholder="Min. 8 characters" required/>
          </div>
          <div className="form-row">
            <label className="form-label">Confirm Password *</label>
            <input className="form-control" type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required/>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? 'Resetting…' : 'Reset Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
