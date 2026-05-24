'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Nav definitions ────────────────────────────────────────────────────────────
// Items gated by perm; sections only render if at least one item is visible.

const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',   href: '/',          perm: 'dashboard.view' },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket', href: '/tickets',   perm: 'tickets.view'   },
  { id: 'analytics', label: 'Analytics', icon: 'chart',  href: '/analytics', perm: 'analytics.view' },
];

const ADMIN_NAV = [
  { id: 'parks', label: 'Parks', icon: 'map',    href: '/admin/parks', perm: 'parks.view'  },
  { id: 'users', label: 'Users', icon: 'users',  href: '/admin/users', perm: 'users.view'  },
  { id: 'roles', label: 'Roles', icon: 'shield', href: '/admin/roles', perm: 'roles.view'  },
];

const FINANCE_NAV = [
  { id: 'finance-overview', label: 'Overview',       icon: 'chart',    href: '/admin/finance/overview',       perm: 'finance.view'      },
  { id: 'refunds',          label: 'Refunds',        icon: 'money',    href: '/admin/finance/refunds',        perm: 'finance.refund'    },
  { id: 'settlements',      label: 'Settlements',    icon: 'lock',     href: '/admin/finance/settlements',    perm: 'finance.view'      },
  { id: 'reconciliation',   label: 'Reconciliation', icon: 'chart',    href: '/admin/finance/reconciliation', perm: 'finance.reconcile' },
  { id: 'finance-audit',    label: 'Finance Audit',  icon: 'file',     href: '/admin/finance/audit',          perm: 'finance.view'      },
];

const REPORTS_NAV = [
  { id: 'reports', label: 'Reports & Exports', icon: 'download', href: '/admin/reports', perm: 'reports.view' },
];

// ── Cross-park ops (visible to Super Admin and Corporate Admin only) ──────────
// Zones, Gates, Counters, Devices, Shifts are Park Workspace items — not global.
// Only the cross-park monitoring items remain here.
const OPS_NAV = [
  { id: 'op-dashboard', label: 'Ops Dashboard', icon: 'activity', href: '/admin/operations',            perm: 'counters.view'  },
  { id: 'op-alerts',    label: 'Alerts',         icon: 'warning',  href: '/admin/operations/alerts',    perm: 'alerts.view'    },
  { id: 'op-incidents', label: 'Incidents',       icon: 'xCircle', href: '/admin/operations/incidents', perm: 'incidents.view' },
];

// ── Cashier-only: shift access when using the Admin Portal ────────────────────
const CASHIER_NAV = [
  { id: 'op-shifts', label: 'My Shifts', icon: 'lock', href: '/admin/operations/shifts', perm: 'shifts.view' },
];

// Roles that operate entirely inside the Park Workspace.
// For these roles: global ops section is hidden; only the workspace entry point matters.
const PARK_SCOPED_ROLES = ['Park Manager', 'Cashier'];

// Roles that should see cross-park ops (Ops Dashboard, Alerts, Incidents).
const CROSS_PARK_OPS_ROLES = ['Super Admin', 'Corporate Admin'];

// Roles whose nav is Finance+Reports focused — Tickets and Analytics are excluded
// from the sidebar even though those permissions exist on the role.
// (Spec: Finance Head nav = Dashboard, Finance, Reports only.)
const FINANCE_FOCUSED_ROLES = ['Finance Head'];

// Roles whose nav is read-only park access — Analytics excluded from top nav
// even though the permission exists. Access path: Parks → Workspace → Analytics.
const AUTHORITY_ROLES = ['Authority User'];

function ZTechLogoDark() {
  return (
    <svg width="100" height="40" viewBox="0 0 100 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="97" height="37" rx="3" stroke="#C0202A" strokeWidth="2.5"/>
      <text x="9" y="30" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="26" fill="#ffffff">z</text>
      <text x="34" y="29" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="20" fill="#C0202A">TECH</text>
    </svg>
  );
}

export default function Sidebar({ active = 'dashboard' }) {
  const router = useRouter();
  const { can, user: me } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1199px)');
    const sync = () => {
      if (mq.matches) {
        setCollapsed(true);
        document.body.classList.add('sb-collapsed');
      } else {
        const saved = localStorage.getItem('sb-collapsed') === 'true';
        setCollapsed(saved);
        document.body.classList.toggle('sb-collapsed', saved);
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sb-collapsed', String(next));
      document.body.classList.toggle('sb-collapsed', next);
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/login');
  };

  const role              = me?.role;
  const isParkScoped      = PARK_SCOPED_ROLES.includes(role);
  const isCrossOpsRole    = CROSS_PARK_OPS_ROLES.includes(role);
  const isCashier         = role === 'Cashier';
  const isFinanceFocused  = FINANCE_FOCUSED_ROLES.includes(role);
  const isAuthorityUser   = AUTHORITY_ROLES.includes(role);

  // Primary nav:
  // - Park-scoped roles (PM, Cashier): Dashboard only
  // - Finance Head: Dashboard only (Finance+Reports are in their own sections)
  // - Authority User: Dashboard only (Analytics lives in Park Workspace for them)
  // - Everyone else: all permitted primary items
  const visiblePrimary = (isParkScoped || isFinanceFocused || isAuthorityUser)
    ? PRIMARY_NAV.filter(it => it.id === 'dashboard' && can(it.perm))
    : PRIMARY_NAV.filter(it => can(it.perm));

  // Admin: Parks, Users, Roles — each gated by permission
  const visibleAdmin = ADMIN_NAV.filter(it => can(it.perm));

  // Finance: all items — permission-gated per item so Finance Head sees full list
  const visibleFinance = FINANCE_NAV.filter(it => can(it.perm));

  // Reports: show to everyone with reports.view (not Cashier — no perm)
  const visibleReports = REPORTS_NAV.filter(it => can(it.perm));

  // Cross-park Ops: only for Super Admin and Corporate Admin
  // Finance Head / Park Manager / Authority User do not get global ops
  const visibleOps = isCrossOpsRole
    ? OPS_NAV.filter(it => can(it.perm))
    : [];

  // Cashier shift access (only when Cashier is in Admin Portal)
  const visibleCashierNav = isCashier
    ? CASHIER_NAV.filter(it => can(it.perm))
    : [];

  const renderNav = (items) => items.map(it => (
    <Link key={it.id} href={it.href}
      className={'nav-item' + (active === it.id ? ' active' : '')}
      data-label={it.label}>
      <Icon name={it.icon} size={15}/>
      <span>{it.label}</span>
    </Link>
  ));

  return (
    <aside className="sidebar">

      {/* Brand */}
      <div className="sidebar-brand">
        {collapsed ? (
          <button className="sb-expand-btn" onClick={toggle} title="Expand sidebar">
            <Icon name="chevronR" size={14}/>
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
              <ZTechLogoDark/>
              <button className="sb-toggle" onClick={toggle} title="Collapse sidebar">
                <Icon name="chevronL" size={12}/>
              </button>
            </div>
            <div className="brand-sub-label">Operations Dashboard</div>
          </>
        )}
      </div>

      {/* Primary nav — Dashboard (+ Tickets, Analytics for non-park-scoped) */}
      {visiblePrimary.length > 0 && (
        <div className="sidebar-nav">
          {renderNav(visiblePrimary)}
        </div>
      )}

      {/* Admin section — Parks, Users, Roles */}
      {visibleAdmin.length > 0 && (
        <>
          <div className="sidebar-section">Admin</div>
          <div className="sidebar-nav">
            {renderNav(visibleAdmin)}
          </div>
        </>
      )}

      {/* Finance section */}
      {visibleFinance.length > 0 && (
        <>
          <div className="sidebar-section">Finance</div>
          <div className="sidebar-nav">
            {renderNav(visibleFinance)}
          </div>
        </>
      )}

      {/* Reports section */}
      {visibleReports.length > 0 && (
        <>
          <div className="sidebar-section">Reports</div>
          <div className="sidebar-nav">
            {renderNav(visibleReports)}
          </div>
        </>
      )}

      {/* Cross-park Operations — Super Admin and Corporate Admin only */}
      {visibleOps.length > 0 && (
        <>
          <div className="sidebar-section">Operations</div>
          <div className="sidebar-nav">
            {renderNav(visibleOps)}
          </div>
        </>
      )}

      {/* Cashier shift nav */}
      {visibleCashierNav.length > 0 && (
        <>
          <div className="sidebar-section">Shifts</div>
          <div className="sidebar-nav">
            {renderNav(visibleCashierNav)}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="sidebar-foot">
        <button className="logout-btn" onClick={handleLogout} data-label="Logout">
          <Icon name="logout" size={14}/>
          <span>Logout</span>
        </button>
      </div>

    </aside>
  );
}
