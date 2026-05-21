'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import NotificationDrawer from './NotificationDrawer';

const BASE    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const POLL_MS = 30_000;

export default function NotificationBell() {
  const [open,   setOpen]   = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshRef = useRef(null);
  refreshRef.current = async () => {
    try {
      const res = await fetch(`${BASE}/api/notifications/unread-count`, { credentials: 'include' });
      if (res.ok) { const d = await res.json(); setUnread(d.count || 0); }
    } catch (_) {}
  };

  useEffect(() => {
    refreshRef.current();
    const t = setInterval(() => refreshRef.current(), POLL_MS);
    return () => clearInterval(t);
  }, []);

  const handleRead = () => {
    // Refresh count from server after any read action
    refreshRef.current();
  };

  return (
    <div className="notif-bell-wrap">
      <button
        className="icon-btn"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
      >
        <Icon name="bell" size={15}/>
      </button>

      {unread > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: -3, right: -3,
            background: 'var(--red)', color: '#fff',
            fontSize: 9, fontWeight: 700, lineHeight: 1,
            padding: '2px 4px', borderRadius: 10,
            minWidth: 15, textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}

      {open && (
        <NotificationDrawer
          onClose={() => setOpen(false)}
          onRead={handleRead}
        />
      )}
    </div>
  );
}
