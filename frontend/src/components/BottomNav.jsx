'use client';
import Link from 'next/link';
import Icon from './Icon';
import { useAuth } from '../lib/auth-context';

const ALL_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',     href: '/',                     perm: 'dashboard.view' },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket',   href: '/tickets',              perm: 'tickets.view'   },
  { id: 'analytics', label: 'Analytics', icon: 'chart',    href: '/analytics',            perm: 'analytics.view' },
  { id: 'finance',   label: 'Finance',   icon: 'money',    href: '/admin/finance/overview', perm: 'finance.view' },
  { id: 'reports',   label: 'Reports',   icon: 'download', href: '/admin/reports',        perm: 'reports.view'   },
];

export default function BottomNav({ active = 'dashboard' }) {
  const { can } = useAuth();
  const visible = ALL_NAV.filter(it => can(it.perm));

  return (
    <nav className="bottom-nav">
      {visible.map(it => (
        <Link key={it.id} href={it.href}
          className={'bottom-nav-item' + (active === it.id ? ' active' : '')}>
          <Icon name={it.icon} size={18}
            color={active === it.id ? 'var(--teal)' : 'var(--sidebar-ink-dim)'}/>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
