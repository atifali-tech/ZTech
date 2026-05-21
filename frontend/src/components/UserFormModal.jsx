'use client';
import { useState, useEffect } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function UserFormModal({ user: editUser, roles, parks, onSave, onClose }) {
  const isEdit = Boolean(editUser);
  const [name,     setName]     = useState(editUser?.name     || '');
  const [email,    setEmail]    = useState(editUser?.email    || '');
  const [password, setPassword] = useState('');
  const [roleId,   setRoleId]   = useState(editUser?.roleId   || (roles[0]?.id ?? ''));
  const [parkIds,  setParkIds]  = useState(editUser?.parkIds  || []);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const selectedRole = roles.find(r => String(r.id) === String(roleId));
  const isGlobalRole = selectedRole && ['Super Admin', 'Corporate Admin'].includes(selectedRole.name);

  const togglePark = (id) => {
    setParkIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { name, email, role_id: parseInt(roleId), park_ids: isGlobalRole ? [] : parkIds };
      if (!isEdit || password) body.password = password;

      const url    = isEdit ? `/api/users/${editUser.id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';

      if (!isEdit) {
        if (!password) { setError('Password is required'); setSaving(false); return; }
        body.password = password;
      }

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
          <Icon name="users" size={15} color="var(--teal)"/>
          <span className="modal-title">{isEdit ? 'Edit User' : 'Add User'}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="chevron" size={13}/></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field-row">
              <div className="field">
                <label className="field-label">Full Name</label>
                <input className="field-input" required value={name} onChange={e=>setName(e.target.value)} placeholder="John Doe"/>
              </div>
              <div className="field">
                <label className="field-label">Email</label>
                <input className="field-input" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="john@example.com"/>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Password {isEdit && <span style={{color:'var(--ink-4)',fontWeight:400,textTransform:'none'}}>(leave blank to keep)</span>}</label>
                <input className="field-input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
                  required={!isEdit} minLength={8} placeholder="Min 8 characters"/>
              </div>
              <div className="field">
                <label className="field-label">Role</label>
                <select className="field-input" value={roleId} onChange={e=>setRoleId(e.target.value)} required>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Park Access</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0', opacity: isGlobalRole ? 0.55 : 1 }}>
                {parks.map(p => {
                  const selected = parkIds.includes(p.id);
                  return (
                    <button key={p.id} type="button"
                      disabled={isGlobalRole}
                      onClick={() => togglePark(p.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        border: `1.5px solid ${selected ? p.color_hex : 'var(--border-strong)'}`,
                        background: selected ? p.color_hex + '22' : 'transparent',
                        color: selected ? p.color_hex : 'var(--ink-3)',
                        cursor: isGlobalRole ? 'not-allowed' : 'pointer', transition: 'all .15s',
                      }}>
                      {p.name}
                    </button>
                  );
                })}
                {parks.length === 0 && <span style={{fontSize:12,color:'var(--ink-4)'}}>No parks available</span>}
              </div>
              <div style={{fontSize:11,color:'var(--ink-4)'}}>
                {isGlobalRole
                  ? `${selectedRole.name} sees all parks. Park chips are ignored for this role.`
                  : 'Select the parks this user can access.'}
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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
