'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const CHIPS = [
  { key: 'pending_refunds',       label: 'Pending Refunds',       href: '/admin/finance/refunds',        urgent: true  },
  { key: 'submitted_settlements', label: 'Awaiting Settlement',    href: '/admin/finance/settlements',    urgent: false },
  { key: 'unresolved_exceptions', label: 'Reconciliation Issues',  href: '/admin/finance/reconciliation', urgent: true  },
];

export default function OpsBar() {
  const [actions,    setActions]    = useState(null);
  const [notifCount, setNotifCount] = useState(0);

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    try {
      const [r1, r2] = await Promise.allSettled([
        fetch(`${BASE}/api/notifications/pending-actions`, { credentials: 'include' }),
        fetch(`${BASE}/api/notifications/unread-count`,    { credentials: 'include' }),
      ]);
      if (r1.status === 'fulfilled' && r1.value.ok) setActions(await r1.value.json());
      if (r2.status === 'fulfilled' && r2.value.ok) { const d = await r2.value.json(); setNotifCount(d.count || 0); }
    } catch (_) {}
  };

  useEffect(() => { fetchRef.current(); }, []);

  if (!actions) return null;

  const active = CHIPS.filter(c => (actions[c.key] || 0) > 0);
  const allClear = active.length === 0 && notifCount === 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '7px 12px',
      background: allClear ? 'var(--surface-2)' : 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 5,
    }}>
      <span style={{ fontSize: 10.5, color: 'var(--ink-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, marginRight: 2 }}>
        Ops Status
      </span>

      {allClear ? (
        <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="check" size={12} color="var(--good)"/>
          All clear — no pending actions
        </span>
      ) : (
        <>
          {active.map(c => (
            <Link key={c.key} href={c.href} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 4,
              background: c.urgent ? '#FBE7E4' : '#FCF5E4',
              border: `1px solid ${c.urgent ? '#F9CECA' : '#F5DFA8'}`,
              color: c.urgent ? 'var(--bad)' : '#8A5E0B',
              fontSize: 11.5, fontWeight: 500, textDecoration: 'none',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{actions[c.key]}</span>
              {c.label}
            </Link>
          ))}
          {notifCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 4,
              background: 'var(--teal-50)', border: '1px solid var(--teal-100)',
              color: 'var(--teal-700)', fontSize: 11.5, fontWeight: 500,
            }}>
              <Icon name="bell" size={11}/> {notifCount} unread
            </span>
          )}
        </>
      )}

      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-5)', flexShrink: 0 }}>
        {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}
