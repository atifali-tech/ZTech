'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar     from './Sidebar';
import Topbar      from './Topbar';
import Icon        from './Icon';
import { useAuth } from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function ActionBadge({ action }) {
  const [prefix, verb] = (action || '').split('.');
  const colorMap = {
    'refund.request':    { cls: 'amber',  label: 'Refund Requested'  },
    'refund.approve':    { cls: 'teal',   label: 'Refund Approved'   },
    'refund.reject':     { cls: 'red',    label: 'Refund Rejected'   },
    'refund.process':    { cls: 'green',  label: 'Refund Processed'  },
    'settlement.submit': { cls: 'amber',  label: 'Settlement Submitted' },
    'settlement.approve':{ cls: 'teal',   label: 'Settlement Approved'  },
    'settlement.dispute':{ cls: 'red',    label: 'Settlement Disputed'  },
  };
  const { cls, label } = colorMap[action] || { cls: '', label: action };
  return <span className={`tag ${cls}`}>{label || action}</span>;
}

const LIMIT = 50;
const ACTION_PREFIXES = [
  { value: '', label: 'All Finance' },
  { value: 'refund', label: 'Refunds only' },
  { value: 'settlement', label: 'Settlements only' },
];

export default function FinanceAuditClient() {
  const { can } = useAuth();

  const [data,    setData]    = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);
  const [page,    setPage]    = useState(1);
  const [prefix,  setPrefix]  = useState('');
  const [expanded, setExpanded] = useState(null); // row id with expanded meta

  const fetchRef = useRef(null);
  fetchRef.current = async ({ pg = page, pf = prefix } = {}) => {
    setLoading(true);
    setDenied(false);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (pf) params.set('action_prefix', pf);
      const result = await apiFetch(`/api/finance/audit?${params}`);
      setData(result);
    } catch (err) {
      if (err.message?.toLowerCase().includes('permission')) setDenied(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current(); }, []);

  const handlePrefixChange = (pf) => {
    setPrefix(pf);
    setPage(1);
    fetchRef.current({ pg: 1, pf });
  };

  const handlePage = (p) => {
    setPage(p);
    fetchRef.current({ pg: p });
  };

  const totalPages = Math.ceil(data.total / LIMIT);

  if (!can('finance.view') && !loading) {
    return (
      <div className="app">
        <Sidebar active="finance-audit"/>
        <div className="main">
          <Topbar current="Finance Audit Log" icon="file"/>
          <div className="canvas">
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <Icon name="lock" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 12 }}>Permission denied.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active="finance-audit"/>
      <div className="main">
        <Topbar current="Finance Audit Log" icon="file"/>
        <div className="canvas">

          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Finance Activity Log</div>
              <span className="tag">{data.total} entries</span>

              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                {ACTION_PREFIXES.map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    className={`btn btn-sm${prefix === value ? ' btn-primary' : ' btn-ghost'}`}
                    style={{ padding: '0 8px', height: 26 }}
                    onClick={() => handlePrefixChange(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="sec-actions">
                <button className="btn btn-sm icon-btn" onClick={() => fetchRef.current()} title="Refresh">
                  <Icon name="refresh" size={13}/>
                </button>
              </div>
            </div>

            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading audit log…</span></div>
              ) : denied ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>Permission denied.</div>
              ) : data.data.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Icon name="file" size={32} color="var(--ink-5)"/>
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>No audit entries found.</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map(entry => {
                        const meta = entry.meta || {};
                        const isExpanded = expanded === entry.id;
                        return (
                          <>
                            <tr key={entry.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : entry.id)}>
                              <td className="mono" style={{ fontSize: 11.5, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{fmt(entry.created_at)}</td>
                              <td><ActionBadge action={entry.action}/></td>
                              <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{entry.actor_email || `User #${entry.actor_id}` || '—'}</td>
                              <td className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                                {entry.target_type ? `${entry.target_type} #${entry.target_id}` : '—'}
                              </td>
                              <td style={{ fontSize: 11.5, color: 'var(--ink-4)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {Object.entries(meta).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                                {Object.keys(meta).length > 3 && ' …'}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${entry.id}-meta`} style={{ background: 'var(--surface-2)' }}>
                                <td colSpan={5} style={{ padding: '8px 16px' }}>
                                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {JSON.stringify(meta, null, 2)}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}>
                  <div className="pager">
                    <button className="page-btn" disabled={page <= 1} onClick={() => handlePage(page - 1)}>‹</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => handlePage(p)}>{p}</button>;
                    })}
                    <button className="page-btn" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>›</button>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                    {data.total} entries · page {page}/{totalPages}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
