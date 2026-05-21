'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TYPE_META = {
  'refund.requested':    { icon: 'arrowDown',   color: 'var(--red)'    },
  'refund.approved':     { icon: 'checkCircle',  color: 'var(--green)'  },
  'refund.rejected':     { icon: 'xCircle',      color: 'var(--red)'    },
  'settlement.submitted':{ icon: 'lock',         color: 'var(--amber)'  },
  'settlement.approved': { icon: 'checkCircle',  color: 'var(--green)'  },
  'settlement.disputed': { icon: 'warning',      color: 'var(--red)'    },
  'reconciliation.exception': { icon: 'warning', color: 'var(--amber)'  },
  'report.generated':    { icon: 'download',     color: 'var(--indigo)' },
};

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000)  return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationDrawer({ onClose, onRead }) {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  // Close on Escape
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const fetchRef = useRef(null);
  fetchRef.current = async (pg = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BASE}/api/notifications?page=${pg}&limit=20`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const d = await res.json();
        setItems(d.data || []);
        setTotal(d.total || 0);
        setPage(pg);
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current(1); }, []);

  const markOne = async (id) => {
    try {
      await fetch(`${BASE}/api/notifications/${id}/read`,
        { method: 'POST', credentials: 'include' });
      setItems(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
      onRead?.();
    } catch (_) {}
  };

  const markAll = async () => {
    try {
      await fetch(`${BASE}/api/notifications/read-all`,
        { method: 'POST', credentials: 'include' });
      setItems(ns => ns.map(n => ({ ...n, is_read: true })));
      onRead?.();
    } catch (_) {}
  };

  const pages = Math.ceil(total / 20);
  const unreadCount = items.filter(n => !n.is_read).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)', zIndex: 900,
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 360, maxWidth: '100vw',
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          zIndex: 901, display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.18s ease',
        }}
      >

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <Icon name="bell" size={15} color="var(--ink-3)"/>
          <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>Notifications</span>
          {unreadCount > 0 && (
            <button
              className="btn btn-sm"
              onClick={markAll}
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              Mark all read
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close">
            <Icon name="xCircle" size={15}/>
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 12 }}>
              Loading…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Icon name="bell" size={28} color="var(--ink-5)"/>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-4)' }}>
                No notifications yet.
              </div>
            </div>
          )}

          {!loading && items.map(n => {
            const m = TYPE_META[n.type] || { icon: 'info', color: 'var(--ink-3)' };
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markOne(n.id)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: n.is_read ? undefined : 'var(--surface-2)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}>
                  <Icon name={m.icon} size={13} color={m.color}/>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: n.is_read ? 400 : 600,
                    color: 'var(--ink)', lineHeight: 1.4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: 11.5, color: 'var(--ink-4)', marginTop: 2,
                      lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: 'var(--ink-5)', marginTop: 3 }}>
                    {fmtTime(n.created_at)}
                    {n.park_id && <span style={{ marginLeft: 6 }}>· {n.park_id}</span>}
                  </div>
                </div>

                {!n.is_read && (
                  <div style={{
                    flexShrink: 0, width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--red)', marginTop: 5,
                  }}/>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div className="pager">
              <button className="page-btn" disabled={page <= 1}
                onClick={() => fetchRef.current(page - 1)}>‹</button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p}
                    className={`page-btn${page === p ? ' active' : ''}`}
                    onClick={() => fetchRef.current(p)}>{p}</button>
                );
              })}
              <button className="page-btn" disabled={page >= pages}
                onClick={() => fetchRef.current(page + 1)}>›</button>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-4)' }}>
              {total} total
            </span>
          </div>
        )}
      </div>
    </>
  );
}
