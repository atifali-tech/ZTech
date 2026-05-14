'use client';
import Link from 'next/link';
import Icon from './Icon';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',   href: '/'          },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket', href: '/tickets'   },
  { id: 'analytics', label: 'Analytics', icon: 'chart',  href: '/analytics' },
];

export default function BottomNav({ active = 'dashboard' }) {
  return (
    <nav className="bottom-nav">
      {NAV.map(it => (
        <Link key={it.id} href={it.href} className={'bottom-nav-item' + (active === it.id ? ' active' : '')}>
          <Icon name={it.icon} size={18} color={active === it.id ? 'var(--teal)' : 'var(--sidebar-ink-dim)'}/>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
