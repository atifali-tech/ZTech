'use client';
import { useState, useEffect } from 'react';
import Sidebar       from './Sidebar';
import Topbar        from './Topbar';
import Icon          from './Icon';
import UserFormModal from './UserFormModal';
import { useAuth }   from '../lib/auth-context';

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
  const { can } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [roles,   setRoles]   = useState([]);
  const [parks,   setParks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [modal,   setModal]   = useState(null); // null | 'create' | user-object
  const [deleting, setDeleting] = useState(null);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchAll = async () => {
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
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSave = (saved) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.id === saved.id);
      return idx >= 0 ? prev.map(u => u.id === saved.id ? saved : u) : [...prev, saved];
    });
    setModal(null);
    showToast(modal === 'create' ? 'User created' : 'User updated');
  };

  const handleDelete = async (user) => {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await apiFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast('User deleted');
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeleting(null);
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
                    <Icon name="users" size={12} color="#fff"/> Add User
                  </button>
                )}
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading users…</span></div>
              ) : denied ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>
                  You do not have permission to view users.
                </div>
              ) : (
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
                          {can('users.edit') && (
                            <button className="btn btn-sm icon-btn" title="Edit" onClick={() => setModal(u)}>
                              <Icon name="cog" size={13}/>
                            </button>
                          )}
                          {can('users.delete') && (
                            <button className="btn btn-sm icon-btn" title="Delete"
                              disabled={deleting === u.id}
                              onClick={() => handleDelete(u)}
                              style={{ color: 'var(--red)' }}>
                              <Icon name="trash" size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '24px 0' }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
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

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--ink)', color: '#fff',
          padding: '10px 16px', borderRadius: 6, fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 200,
        }}>{toast}</div>
      )}
    </div>
  );
}
