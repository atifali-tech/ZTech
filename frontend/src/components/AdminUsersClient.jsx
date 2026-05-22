'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar            from './Sidebar';
import Topbar             from './Topbar';
import Icon               from './Icon';
import Toast              from './Toast';
import ConfirmDialog      from './ConfirmDialog';
import UserFormModal      from './UserFormModal';
import ResetPasswordModal from './ResetPasswordModal';
import { useAuth }        from '../lib/auth-context';

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

export default function AdminUsersClient() {
  const { can, user: me } = useAuth();
  const [users,        setUsers]        = useState([]);
  const [roles,        setRoles]        = useState([]);
  const [parks,        setParks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [denied,       setDenied]       = useState(false);
  const [modal,        setModal]        = useState(null); // null | 'create' | user-object
  const [resetTarget,  setResetTarget]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast,        setToast]        = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const canResetPassword = me?.role === 'Super Admin' || me?.role === 'Corporate Admin';

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    setDenied(false);
    try {
      const [u, r, p] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/rbac/roles'),
        apiFetch('/api/parks'),
      ]);
      setUsers(u); setRoles(r); setParks(p);
    } catch (err) {
      if (err.message?.includes('Permission denied') || err.message?.includes('denied')) setDenied(true);
      else showToast(err.message, 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, []);

  const handleSave = (saved) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      return idx >= 0 ? prev.map(u => u.id === saved.id ? saved : u) : [...prev, saved];
    });
    const isEdit = modal !== 'create';
    setModal(null);
    showToast(isEdit ? 'User updated' : 'User created');
  };

  const doDelete = async () => {
    const user = deleteTarget;
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast('User deleted');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="app">
      <Sidebar active="users"/>
      <div className="main">
        <Topbar current="User Management" icon="users"/>
        <div className="canvas">
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Users</div>
              <span className="tag">{users.length} total</span>
              <div className="sec-actions">
                {can('users.create') && (
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                    + Add User
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: 24 }}>
                  {[...Array(5)].map((_, i) => <div key={i} className="skeleton-row"/>)}
                </div>
              ) : denied ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                  You do not have permission to view users.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Parks</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{u.name}</td>
                          <td className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.email}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                              background: (ROLE_COLORS[u.roleName] || '#8A92A3') + '22',
                              color: ROLE_COLORS[u.roleName] || '#8A92A3',
                            }}>{u.roleName || u.role}</span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                            {u.parkNames?.length > 0
                              ? u.parkNames.slice(0, 2).join(', ') + (u.parkNames.length > 2 ? ` +${u.parkNames.length - 2}` : '')
                              : <span style={{ color: 'var(--ink-5)' }}>All parks</span>
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              {canResetPassword && (
                                <button className="btn btn-ghost btn-sm" title="Reset Password"
                                  onClick={() => setResetTarget(u)}>
                                  Reset PW
                                </button>
                              )}
                              {can('users.edit') && (
                                <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setModal(u)}>
                                  Edit
                                </button>
                              )}
                              {can('users.delete') && (
                                <button className="btn btn-ghost btn-sm" title="Delete"
                                  onClick={() => setDeleteTarget(u)}
                                  style={{ color: 'var(--red)' }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && !loading && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '24px 0' }}>No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => { setResetTarget(null); showToast(`Password reset for ${resetTarget.name}`); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Delete ${deleteTarget?.name} (${deleteTarget?.email})? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </div>
  );
}
