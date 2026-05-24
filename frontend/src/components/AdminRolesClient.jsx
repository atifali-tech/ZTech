'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const MODULE_ORDER = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'tickets',   label: 'Tickets' },
  { key: 'parks',     label: 'Parks' },
  { key: 'users',     label: 'Users' },
  { key: 'roles',     label: 'Roles' },
  { key: 'finance',   label: 'Finance' },
  { key: 'reports',   label: 'Reports' },
  { key: 'counters',  label: 'Counters' },
  { key: 'devices',   label: 'Devices' },
  { key: 'gates',     label: 'Gates' },
  { key: 'shifts',    label: 'Shifts' },
  { key: 'zones',     label: 'Zones' },
  { key: 'alerts',    label: 'Alerts' },
  { key: 'incidents', label: 'Incidents' },
];

const ROLE_COLORS = {
  'Super Admin': '#E24B4A', 'Corporate Admin': '#378ADD',
  'Finance Head': '#EF9F27', 'Park Manager': '#1D9E75',
  'Cashier': '#7F77DD', 'Authority User': '#8A92A3',
};

export default function AdminRolesClient() {
  const { can } = useAuth();
  const [roles,       setRoles]       = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [rolePerms,   setRolePerms]   = useState({}); // roleId → Set<permId>
  const [activeRole,  setActiveRole]  = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        apiFetch('/api/rbac/roles'),
        apiFetch('/api/rbac/permissions'),
      ]);
      setRoles(r);
      setPermissions(p);
      const map = {};
      for (const role of r) {
        map[role.id] = new Set((role.permissions || []).map(p => p.id));
      }
      setRolePerms(map);
      if (r.length > 0) setActiveRole(r[0].id);
    } catch { /* handled inline */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, []);

  const togglePerm = (permId) => {
    if (!can('roles.manage')) return;
    if (activeRole === 1) return; // Super Admin immutable
    setRolePerms(prev => {
      const updated = new Set(prev[activeRole] || []);
      if (updated.has(permId)) updated.delete(permId); else updated.add(permId);
      return { ...prev, [activeRole]: updated };
    });
  };

  const handleSave = async () => {
    if (!activeRole) return;
    setSaving(true);
    try {
      const permIds = [...(rolePerms[activeRole] || [])];
      await apiFetch(`/api/rbac/roles/${activeRole}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: permIds }),
      });
      showToast('Permissions saved');
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const grouped = MODULE_ORDER.map(mod => ({
    ...mod,
    perms: permissions.filter(p => p.name.startsWith(mod.key + '.')),
  })).filter(g => g.perms.length > 0);

  const active = roles.find(r => r.id === activeRole);
  const isSuperAdmin = activeRole === 1;
  const currentPerms = rolePerms[activeRole] || new Set();

  return (
    <div className="app">
      <Sidebar active="roles"/>
      <div className="main">
        <Topbar current="Roles & Permissions" icon="shield"/>
        <div className="canvas">
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* Role list */}
            <div className="sec" style={{ width: 220, flexShrink: 0 }}>
              <div className="sec-head">
                <div className="sec-title">Roles</div>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                {loading ? (
                  <div className="page-loading" style={{ padding: '16px 12px' }}><div className="page-loading-spinner"/></div>
                ) : (
                  roles.map(r => (
                    <button key={r.id} onClick={() => setActiveRole(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        background: activeRole === r.id ? 'var(--surface-2)' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', textAlign: 'left',
                        borderLeft: activeRole === r.id ? `3px solid ${ROLE_COLORS[r.name] || 'var(--teal)'}` : '3px solid transparent',
                      }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: ROLE_COLORS[r.name] || '#8A92A3',
                      }}/>
                      <span style={{ fontSize: 13, fontWeight: activeRole === r.id ? 600 : 400, color: 'var(--ink)' }}>
                        {r.name}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Permissions matrix */}
            <div className="sec" style={{ flex: 1, minWidth: 0 }}>
              <div className="sec-head">
                <div className="sec-title">
                  {active ? active.name : 'Select a role'}
                </div>
                {isSuperAdmin && (
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 400 }}>
                    Super Admin has all permissions and cannot be modified
                  </span>
                )}
                <div className="sec-actions">
                  {can('roles.manage') && !isSuperAdmin && active && (
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </div>
              <div className="sec-body">
                {loading ? (
                  <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading permissions…</span></div>
                ) : !active ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Select a role to manage permissions</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {grouped.map(group => (
                      <div key={group.key} className="perm-group">
                        <div className="perm-group-label">{group.label}</div>
                        {group.perms.map(perm => {
                          const checked = isSuperAdmin || currentPerms.has(perm.id);
                          return (
                            <label key={perm.id} className="perm-row" style={{
                              cursor: (can('roles.manage') && !isSuperAdmin) ? 'pointer' : 'default',
                              opacity: isSuperAdmin ? 0.6 : 1,
                            }}>
                              <input type="checkbox" checked={checked}
                                disabled={isSuperAdmin || !can('roles.manage')}
                                onChange={() => togglePerm(perm.id)}
                                style={{ accentColor: ROLE_COLORS[active?.name] || 'var(--teal)' }}/>
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{perm.label}</span>
                                <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-4)' }}>{perm.name}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
