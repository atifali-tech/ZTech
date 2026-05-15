'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid',   href: '/' },
  { id: 'tickets',   label: 'Tickets',   icon: 'ticket', href: '/tickets' },
  { id: 'analytics', label: 'Analytics', icon: 'chart',  href: '/analytics' },
];
const SOON = [
  { id: 'act',  label: 'Activities',        icon: 'activity' },
  { id: 'park', label: 'Parking',           icon: 'car'      },
  { id: 'fnb',  label: 'F&B',               icon: 'coffee'   },
  { id: 'rep',  label: 'Reports & Exports', icon: 'file'     },
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

  const handleLogout = async () => {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <ZTechLogoDark/>
        <div className="brand-sub-label">Operations Dashboard</div>
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
        <button className="logout-btn" onClick={handleLogout}>
          <Icon name="logout" size={14}/>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
