'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const ACTION_MAP = {
  'refund.submitted':              { color: 'var(--red)',    icon: 'money',    label: 'Refund Submitted' },
  'refund.approved':               { color: 'var(--teal)',   icon: 'money',    label: 'Refund Approved' },
  'refund.rejected':               { color: 'var(--red)',    icon: 'money',    label: 'Refund Rejected' },
  'settlement.submitted':          { color: '#d97706',       icon: 'lock',     label: 'Settlement Submitted' },
  'settlement.approved':           { color: 'var(--teal)',   icon: 'lock',     label: 'Settlement Approved' },
  'reconciliation.exception.flag': { color: 'var(--red)',    icon: 'warning',  label: 'Exception Flagged' },
  'reconciliation.resolved':       { color: 'var(--teal)',   icon: 'chart',    label: 'Exception Resolved' },
};

function actionMeta(action) {
  if (ACTION_MAP[action]) return ACTION_MAP[action];
  if (action?.startsWith('refund.'))         return { color: 'var(--red)',    icon: 'money',    label: 'Refund' };
  if (action?.startsWith('settlement.'))     return { color: '#d97706',       icon: 'lock',     label: 'Settlement' };
  if (action?.startsWith('reconciliation.')) return { color: 'var(--teal)',   icon: 'chart',    label: 'Reconciliation' };
  if (action?.startsWith('user.'))           return { color: 'var(--ink-3)',  icon: 'users',    label: 'User' };
  return                                            { color: 'var(--ink-3)',  icon: 'activity', label: action || 'Event' };
}

function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RecentActivity() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    try {
      const res = await fetch(`${BASE}/api/finance/audit?limit=8&page=1`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setItems(json.data || []);
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current(); }, []);

  return (
    <div className="sec" style={{ height: '100%' }}>
      <div className="sec-head">
        <Icon name="activity" size={13} color="var(--ink-4)"/>
        <div className="sec-title" style={{ marginLeft: 4 }}>Recent Activity</div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>Finance audit</span>
      </div>
      <div className="sec-body" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '16px', color: 'var(--ink-4)', fontSize: 12 }}>Loading…</div>
        ) : !items.length ? (
          <div style={{ padding: '16px', color: 'var(--ink-4)', fontSize: 12 }}>No recent activity</div>
        ) : items.map((item, idx) => {
          const meta = actionMeta(item.action);
          return (
            <div key={item.id || idx} style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              gap: '0 10px',
              alignItems: 'center',
              padding: '9px 16px',
              borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={meta.icon} size={12} color={meta.color}/>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{meta.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.actor_email || 'System'}{item.target_type ? ` · ${item.target_type}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-5)', whiteSpace: 'nowrap' }}>
                {relTime(item.created_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
