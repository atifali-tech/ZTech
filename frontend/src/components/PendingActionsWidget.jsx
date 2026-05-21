'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ITEMS = [
  {
    key:   'pending_refunds',
    label: 'Pending Refunds',
    icon:  'arrowDown',
    href:  '/admin/finance/refunds',
    color: 'var(--red)',
  },
  {
    key:   'submitted_settlements',
    label: 'Awaiting Settlement Approval',
    icon:  'lock',
    href:  '/admin/finance/settlements',
    color: '#d97706',
  },
  {
    key:   'unresolved_exceptions',
    label: 'Unresolved Exceptions',
    icon:  'warning',
    href:  '/admin/finance/reconciliation',
    color: 'var(--red)',
  },
];

export default function PendingActionsWidget() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    try {
      const res = await fetch(`${BASE}/api/notifications/pending-actions`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current(); }, []);

  if (loading || !data) return null;

  const active = ITEMS.filter(it => (data[it.key] || 0) > 0);
  if (active.length === 0) return null;

  return (
    <div className="sec" style={{ marginBottom: 16 }}>
      <div className="sec-head">
        <Icon name="bell" size={14} color="var(--red)"/>
        <div className="sec-title" style={{ marginLeft: 4 }}>Pending Actions</div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
          {active.length} item{active.length !== 1 ? 's' : ''} need attention
        </span>
      </div>
      <div className="sec-body" style={{ padding: '8px 16px 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {active.map(it => (
            <Link
              key={it.key}
              href={it.href}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                textDecoration: 'none', color: 'inherit',
                fontSize: 12, fontWeight: 500,
                transition: 'border-color 0.15s',
              }}
            >
              <Icon name={it.icon} size={12} color={it.color}/>
              <span style={{ color: it.color, fontWeight: 700, minWidth: 18, textAlign: 'right' }}>
                {data[it.key]}
              </span>
              <span style={{ color: 'var(--ink-3)' }}>{it.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
