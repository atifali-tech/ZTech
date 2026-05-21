'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar             from './Sidebar';
import Topbar              from './Topbar';
import Icon                from './Icon';
import RefundDetailDrawer  from './RefundDetailDrawer';
import { useAuth }         from '../lib/auth-context';
import { inr }             from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function StatusBadge({ status }) {
  const MAP = {
    pending:   { cls: 'amber', label: 'Pending' },
    approved:  { cls: 'teal',  label: 'Approved' },
    rejected:  { cls: 'red',   label: 'Rejected' },
    processed: { cls: '',      label: 'Processed' },
  };
  const { cls, label } = MAP[status] || { cls: '', label: status };
  return <span className={`tag ${cls}`}>{label}</span>;
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUSES = ['', 'pending', 'approved', 'rejected', 'processed'];
const LIMIT = 20;

export default function FinanceRefundsClient() {
  const { can } = useAuth();

  const [data,     setData]     = useState({ data: [], total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [denied,   setDenied]   = useState(false);
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [selected, setSelected] = useState(null);
  const [toast,    setToast]    = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const fetchRef = useRef(null);
  fetchRef.current = async ({ pg = page, st = status } = {}) => {
    setLoading(true);
    setDenied(false);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (st) params.set('status', st);
      const result = await apiFetch(`/api/refunds?${params}`);
      setData(result);
    } catch (err) {
      if (err.message?.toLowerCase().includes('permission') || err.message?.includes('denied')) setDenied(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current(); }, []);

  const handleStatusChange = (s) => {
    setStatus(s);
    setPage(1);
    fetchRef.current({ pg: 1, st: s });
  };

  const handlePage = (p) => {
    setPage(p);
    fetchRef.current({ pg: p });
  };

  const handleRefresh = () => {
    showToast('Refund updated');
    fetchRef.current();
  };

  const totalPages = Math.ceil(data.total / LIMIT);

  if (!can('finance.view') && !loading) {
    return (
      <div className="app">
        <Sidebar active="refunds"/>
        <div className="main">
          <Topbar current="Refund Management" icon="money"/>
          <div className="canvas">
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <Icon name="lock" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 12 }}>You do not have permission to view refunds.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active="refunds"/>
      <div className="main">
        <Topbar current="Refund Management" icon="money"/>
        <div className="canvas">

          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Refund Requests</div>
              <span className="tag">{data.total} total</span>

              {/* Status filter */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                {STATUSES.map(s => (
                  <button
                    key={s || 'all'}
                    className={`btn btn-sm${status === s ? ' btn-primary' : ' btn-ghost'}`}
                    style={{ padding: '0 8px', height: 26 }}
                    onClick={() => handleStatusChange(s)}
                  >
                    {s || 'All'}
                  </button>
                ))}
              </div>

              <div className="sec-actions">
                <button className="btn btn-sm icon-btn" title="Refresh" onClick={() => fetchRef.current()}>
                  <Icon name="refresh" size={13}/>
                </button>
              </div>
            </div>

            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead><tr><th>ID</th><th>Ticket</th><th>Park</th><th>Amount</th><th>Requested by</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="skeleton-row">
                          {Array.from({ length: 8 }).map((__, j) => (
                            <td key={j}><span className="skeleton-cell" style={{ width: j === 3 ? 72 : j === 7 ? 48 : '80%' }}/></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : denied ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>Permission denied.</div>
              ) : data.data.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Icon name="money" size={32} color="var(--ink-5)"/>
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>
                    No refund requests{status ? ` with status "${status}"` : ''}.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Ticket</th>
                        <th>Park</th>
                        <th>Amount</th>
                        <th>Requested by</th>
                        <th>Requested</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map(r => (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>#{r.id}</td>
                          <td className="mono" style={{ fontSize: 12 }}>#{r.ticket_id}</td>
                          <td style={{ color: 'var(--ink-2)' }}>{r.park_name || '—'}</td>
                          <td className="mono" style={{ fontWeight: 600 }}>{inr(r.amount)}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.requested_by_email || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-4)' }}>{fmtDate(r.requested_at)}</td>
                          <td><StatusBadge status={r.status}/></td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-sm" onClick={() => setSelected(r)}>
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}>
                  <div className="pager">
                    <button className="page-btn" disabled={page <= 1} onClick={() => handlePage(page - 1)}>‹</button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button key={p} className={`page-btn${page === p ? ' active' : ''}`} onClick={() => handlePage(p)}>{p}</button>
                      );
                    })}
                    <button className="page-btn" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}>›</button>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                    {data.total} total · page {page} of {totalPages}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {selected && (
        <RefundDetailDrawer
          refund={selected}
          canApprove={can('finance.approve')}
          onClose={() => setSelected(null)}
          onRefresh={handleRefresh}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--teal)', color: '#fff',
          padding: '10px 16px', borderRadius: 6, fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="checkCircle" size={14} color="#fff"/> {toast}
        </div>
      )}
    </div>
  );
}
