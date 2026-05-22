'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',   href: '/',          perm: 'dashboard.view' },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket', href: '/tickets',   perm: 'tickets.view'   },
  { id: 'analytics', label: 'Analytics', icon: 'chart',  href: '/analytics', perm: 'analytics.view' },
];

const ADMIN_NAV = [
  { id: 'parks', label: 'Parks',       icon: 'map',    href: '/admin/parks', perm: 'parks.view'  },
  { id: 'users', label: 'Users',       icon: 'users',  href: '/admin/users', perm: 'users.view'  },
  { id: 'roles', label: 'Roles',       icon: 'shield', href: '/admin/roles', perm: 'roles.view'  },
];

const FINANCE_NAV = [
  { id: 'finance-overview', label: 'Overview',        icon: 'chart',   href: '/admin/finance/overview',       perm: 'finance.view' },
  { id: 'refunds',          label: 'Refunds',         icon: 'money',   href: '/admin/finance/refunds',        perm: 'finance.view' },
  { id: 'settlements',      label: 'Settlements',     icon: 'lock',    href: '/admin/finance/settlements',    perm: 'finance.view' },
  { id: 'reconciliation',   label: 'Reconciliation',  icon: 'chart',   href: '/admin/finance/reconciliation', perm: 'finance.reconcile' },
  { id: 'finance-audit',    label: 'Finance Audit',   icon: 'file',    href: '/admin/finance/audit',          perm: 'finance.view' },
];

const REPORTS_NAV = [
  { id: 'reports', label: 'Reports & Exports', icon: 'download', href: '/admin/reports', perm: 'reports.view' },
];

const OPERATIONS_NAV = [
  { id: 'op-dashboard', label: 'Ops Dashboard', icon: 'activity', href: '/admin/operations',           perm: 'counters.view'  },
  { id: 'op-alerts',    label: 'Alerts',         icon: 'warning',  href: '/admin/operations/alerts',   perm: 'alerts.view'    },
  { id: 'op-incidents', label: 'Incidents',      icon: 'xCircle',  href: '/admin/operations/incidents',perm: 'incidents.view' },
  { id: 'op-zones',     label: 'Zones',          icon: 'map',      href: '/admin/operations/zones',    perm: 'zones.view'     },
  { id: 'op-counters',  label: 'Counters',       icon: 'grid',     href: '/admin/operations/counters', perm: 'counters.view'  },
  { id: 'op-devices',   label: 'Devices',        icon: 'shield',   href: '/admin/operations/devices',  perm: 'devices.view'   },
  { id: 'op-gates',     label: 'Gates',          icon: 'ticket',   href: '/admin/operations/gates',    perm: 'gates.view'     },
  { id: 'op-shifts',    label: 'Shifts',         icon: 'lock',     href: '/admin/operations/shifts',   perm: 'shifts.view'    },
];


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
  const { can } = useAuth();
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

  const visiblePrimary    = PRIMARY_NAV.filter(it => can(it.perm));
  const visibleAdmin      = ADMIN_NAV.filter(it => can(it.perm));
  const visibleFinance    = FINANCE_NAV.filter(it => can(it.perm));
  const visibleReports    = REPORTS_NAV.filter(it => can(it.perm));
  const visibleOperations = OPERATIONS_NAV.filter(it => can(it.perm));

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

      {/* Primary nav */}
      <div className="sidebar-nav">
        {visiblePrimary.map(it => (
          <Link key={it.id} href={it.href}
            className={'nav-item' + (active === it.id ? ' active' : '')}
            data-label={it.label}>
            <Icon name={it.icon} size={15}/>
            <span>{it.label}</span>
          </Link>
        ))}
      </div>

      {/* Admin section */}
      {visibleAdmin.length > 0 && (
        <>
          <div className="sidebar-section">Admin</div>
          <div className="sidebar-nav">
            {visibleAdmin.map(it => (
              <Link key={it.id} href={it.href}
                className={'nav-item' + (active === it.id ? ' active' : '')}
                data-label={it.label}>
                <Icon name={it.icon} size={15}/>
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Finance section */}
      {visibleFinance.length > 0 && (
        <>
          <div className="sidebar-section">Finance</div>
          <div className="sidebar-nav">
            {visibleFinance.map(it => (
              <Link key={it.id} href={it.href}
                className={'nav-item' + (active === it.id ? ' active' : '')}
                data-label={it.label}>
                <Icon name={it.icon} size={15}/>
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Reports section */}
      {visibleReports.length > 0 && (
        <>
          <div className="sidebar-section">Reports</div>
          <div className="sidebar-nav">
            {visibleReports.map(it => (
              <Link key={it.id} href={it.href}
                className={'nav-item' + (active === it.id ? ' active' : '')}
                data-label={it.label}>
                <Icon name={it.icon} size={15}/>
                <span>{it.label}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Operations section */}
      {visibleOperations.length > 0 && (
        <>
          <div className="sidebar-section">Operations</div>
          <div className="sidebar-nav">
            {visibleOperations.map(it => (
              <Link key={it.id} href={it.href}
                className={'nav-item' + (active === it.id ? ' active' : '')}
                data-label={it.label}>
                <Icon name={it.icon} size={15}/>
                <span>{it.label}</span>
              </Link>
            ))}
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
