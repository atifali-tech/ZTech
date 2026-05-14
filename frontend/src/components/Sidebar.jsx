'use client';
import Link from 'next/link';
import Icon from './Icon';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',   href: '/' },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket', href: '/tickets' },
  { id: 'analytics', label: 'Analytics', icon: 'chart',  href: '/analytics' },
];
const SOON = [
  { id: 'act',  label: 'Activities',         icon: 'activity' },
  { id: 'park', label: 'Parking',            icon: 'car'      },
  { id: 'fnb',  label: 'F&B',                icon: 'coffee'   },
  { id: 'rep',  label: 'Reports & Exports',  icon: 'file'     },
];

export default function Sidebar({ active = 'dashboard' }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">Z</div>
        <div>
          <div className="brand-name">ZingParks</div>
          <div className="brand-sub">Ops Console</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {NAV.map(it => (
          <Link key={it.id} href={it.href} className={'nav-item' + (active === it.id ? ' active' : '')}>
            <Icon name={it.icon} size={15}/>
            <span>{it.label}</span>
          </Link>
        ))}
      </div>

      <div className="sidebar-section">Roadmap · Q3 · Q4</div>
      <div className="sidebar-nav">
        {SOON.map(it => (
          <div key={it.id} className="nav-item disabled">
            <Icon name={it.icon} size={15}/>
            <span>{it.label}</span>
            <span className="nav-soon">Soon</span>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="avatar">RS</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 12, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Rohan Sahay
          </div>
          <div style={{ color: 'var(--sidebar-ink-dim)', fontSize: 10 }}>Super Admin · 5 parks</div>
        </div>
        <Icon name="logout" size={14} color="var(--sidebar-ink-dim)"/>
      </div>
    </aside>
  );
}
