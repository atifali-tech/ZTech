'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import { num, inr } from '../lib/format';

const BASE        = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const POLL_MS     = 60_000;
const STALE_AFTER = 2;

export default function Topbar({ current = 'Dashboard', icon = 'grid' }) {
  const [stats, setStats] = useState(null);
  const [stale, setStale] = useState(false);
  const [user,  setUser]  = useState(null);
  const failCount = useRef(0);
  const inFlight  = useRef(false);
  const fetchRef  = useRef(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const r = await fetch(`${BASE}/api/dashboard/today-stats`, { credentials: 'include' });
        if (r.status === 401) { window.location.href = '/login'; return; }
        if (!r.ok) throw new Error('non-ok');
        const data = await r.json();
        setStats(data);
        setStale(false);
        failCount.current = 0;
      } catch {
        failCount.current += 1;
        if (failCount.current >= STALE_AFTER) setStale(true);
      } finally {
        inFlight.current = false;
      }
    };

    fetchRef.current = fetchStats;
    fetchStats();
    const t = setInterval(fetchStats, POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.user && setUser(d.user))
      .catch(() => {});
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const dotClass = stale
    ? 'live-dot stale'
    : stats?.visitors === 0
      ? 'live-dot no-pulse'
      : 'live-dot';

  const fmt = (val, fn) => stats === null ? '--' : fn(val);

  return (
    <div className="topbar">
      <div className="crumbs">
        <Icon name={icon} size={13} color="var(--ink-3)"/>
        <strong>{current}</strong>
      </div>

      <div className="topbar-right">
        <div className="live-pill">
          <span className={dotClass}/>
          <span className="live-label">Live Today</span>
          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>·</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>All Parks</span>
          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>·</span>
          <span>
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(stats?.visitors, num)}</span>
            {' '}visitors
          </span>
          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>·</span>
          <span>
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(stats?.revenue, inr)}</span>
            {' '}revenue
          </span>
          <span style={{ color: 'var(--border-strong)', margin: '0 2px' }}>·</span>
          <span>
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{fmt(stats?.tickets, num)}</span>
            {' '}tickets
          </span>
        </div>

        <button className="icon-btn" title="Refresh" onClick={() => fetchRef.current?.()}>
          <Icon name="refresh" size={14}/>
        </button>
        <button className="icon-btn" title="Notifications"><Icon name="bell" size={14}/></button>

        {user && (
          <div className="topbar-user">
            <div className="topbar-user-info">
              <span className="topbar-user-name">{user.name}</span>
              <span className="topbar-user-role">{user.role.toUpperCase().replace(' ', '_')}</span>
            </div>
            <div className="topbar-avatar">{initials}</div>
          </div>
        )}
      </div>
    </div>
  );
}
