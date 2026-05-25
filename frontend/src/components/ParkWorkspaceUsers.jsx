'use client';
import { useState, useEffect, useRef } from 'react';
import Icon         from './Icon';
import Toast        from './Toast';
import ConfirmDialog from './ConfirmDialog';
import UserFormModal from './UserFormModal';
import { useAuth }  from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const ROLE_COLORS = {
  'Super Admin': '#E24B4A', 'Corporate Admin': '#378ADD',
  'Finance Head': '#EF9F27', 'Park Manager': '#1D9E75',
  'Cashier': '#7F77DD', 'Authority User': '#8A92A3',
};

export default function ParkWorkspaceUsers({ parkId }) {
  const { can } = useAuth();

  const [parkUsers, setParkUsers] = useState([]);
  const [allUsers,  setAllUsers]  = useState([]);
  const [roles,     setRoles]     = useState([]);
  const [parks,     setParks]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | 'create' | user
  const [removing,  setRemoving]  = useState(null);
  const [toast, setToast] = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [u, r, p] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/rbac/roles'),
        apiFetch('/api/parks'),
      ]);
      const all = Array.isArray(u) ? u : (u.users || []);
      setAllUsers(all);
      setRoles(r);
      setParks(p);
      // Filter to users assigned to this park
      setParkUsers(all.filter(user => (user.parkIds || []).includes(parkId)));
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId]);

  const handleSave = (saved) => {
    setAllUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      return idx >= 0 ? prev.map(u => u.id === saved.id ? saved : u) : [...prev, saved];
    });
    // Refresh park-scoped list
    setAllUsers(prev => {
      const updated = prev.map(u => u.id === saved.id ? saved : u);
      setParkUsers(updated.filter(user => (user.parkIds || []).includes(parkId)));
      return updated;
    });
    setModal(null);
    showToast(modal === 'create' ? 'User created and assigned' : 'User updated');
  };

  const handleRemove = async () => {
    const user = removing;
    setRemoving(null);
    try {
      // Update user to remove this park from their park_ids
      const newParkIds = (user.parkIds || []).filter(id => id !== parkId);
      const saved = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ park_ids: newParkIds }),
      });
      setAllUsers(prev => prev.map(u => u.id === saved.id ? saved : u));
      setParkUsers(prev => prev.filter(u => u.id !== user.id));
      showToast(`${user.name} removed from this park`);
    } catch (err) { showToast(err.message, 'error'); }
  };

  if (loading) return <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>;

  const countByRole = (role) => parkUsers.filter(u => u.role === role).length;

  return (
    <>
      {/* Role summary cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Users',    value: parkUsers.length },
          { label: 'Park Managers',  value: countByRole('Park Manager') },
          { label: 'Cashiers',       value: countByRole('Cashier') },
          { label: 'Supervisors',    value: countByRole('Supervisor') },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-4)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.value === 0 ? 'var(--ink-5)' : 'var(--ink)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Assigned Users</div>
          <span className="tag">{parkUsers.length} assigned</span>
          <div className="sec-actions">
            {can('users.create') && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> Add User
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {parkUsers.length === 0 ? (
            <div>
              {/* Onboarding header */}
              <div style={{
                padding: '20px 24px 16px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Icon name="users" size={20} color="var(--ink-4)"/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Assign a Park Manager to get started</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>
                    Users assigned here gain access to this park&apos;s workspace, operations, and data.
                  </div>
                </div>
                {can('users.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    <Icon name="plus" size={12} color="#fff"/> Assign User
                  </button>
                )}
              </div>
              {/* Empty table shell */}
              <table className="data-table" style={{ opacity: 0.45 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    {can('users.edit') && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {['Park Manager', 'Cashier', 'Cashier'].map((role, i) => (
                    <tr key={i}>
                      <td><div style={{ width: 120, height: 12, background: 'var(--border)', borderRadius: 4 }}/></td>
                      <td><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--border)', color: 'var(--ink-5)' }}>{role}</span></td>
                      <td><div style={{ width: 160, height: 12, background: 'var(--border)', borderRadius: 4 }}/></td>
                      <td><div style={{ width: 90, height: 12, background: 'var(--border)', borderRadius: 4 }}/></td>
                      <td><span className="tag gray" style={{ fontSize: 10 }}>—</span></td>
                      <td><div style={{ width: 80, height: 12, background: 'var(--border)', borderRadius: 4 }}/></td>
                      {can('users.edit') && <td/>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Other Parks</th>
                  {can('users.edit') && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {parkUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                        background: (ROLE_COLORS[u.role] || '#8A92A3') + '22',
                        color: ROLE_COLORS[u.role] || '#8A92A3',
                      }}>{u.role}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.email}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                      {(u.parkIds || []).filter(id => id !== parkId).length > 0
                        ? `+${(u.parkIds || []).filter(id => id !== parkId).length} more`
                        : <span style={{ color: 'var(--ink-5)' }}>—</span>
                      }
                    </td>
                    {can('users.edit') && (
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(u)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => setRemoving(u)}>Remove</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <UserFormModal
          user={modal === 'create' ? null : modal}
          roles={roles}
          parks={parks}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove User from Park"
        message={`Remove ${removing?.name} from this park? They will no longer have access to this park's data.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
