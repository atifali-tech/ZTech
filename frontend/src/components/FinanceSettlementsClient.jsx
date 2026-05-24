'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar      from './Sidebar';
import Topbar       from './Topbar';
import Icon         from './Icon';
import ConfirmModal from './ConfirmModal';
import { useAuth }  from '../lib/auth-context';
import { inr }      from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function VarianceCell({ variance, severity }) {
  if (variance == null) return <span style={{ color: 'var(--ink-5)' }}>—</span>;
  const cls = severity === 'low' ? 'variance-ok' : severity === 'medium' ? 'variance-warn' : 'variance-bad';
  const arrow = variance > 0 ? '▲' : variance < 0 ? '▼' : '—';
  return (
    <span className={cls}>
      {arrow} {inr(Math.abs(variance))}
    </span>
  );
}

function StatusBadge({ status, locked }) {
  const MAP = {
    open:      { cls: '',        label: 'Open'      },
    submitted: { cls: 'amber',   label: 'Submitted' },
    approved:  { cls: 'teal',    label: 'Approved'  },
    disputed:  { cls: 'red',     label: 'Disputed'  },
  };
  const { cls, label } = MAP[status] || { cls: '', label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={`tag ${cls}`}>{label}</span>
      {locked && <Icon name="lock" size={11} color="var(--red)" title="Locked"/>}
    </span>
  );
}

const LIMIT = 25;
const STATUSES = ['', 'open', 'submitted', 'approved', 'disputed'];

// Stateless create period form — parent manages state (no hooks here)
function CreatePeriodForm({ form, onChange, parks, onSubmit, onCancel, loading, error }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60,
      display: 'grid', placeItems: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-title">Create Settlement Period</div>
        <div className="modal-msg" style={{ marginBottom: 16 }}>
          Opens a new settlement period for daily reconciliation.
        </div>

        {error && (
          <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Park
        </label>
        <select
          value={form.park_id}
          onChange={e => onChange('park_id', e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, marginBottom: 12, background: 'var(--surface)' }}
        >
          <option value="">— Select park —</option>
          {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Period Date
        </label>
        <input
          type="date"
          value={form.period_date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => onChange('period_date', e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, marginBottom: 12 }}
        />

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Notes (optional)
        </label>
        <textarea
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Opening notes…"
          rows={2}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading || !form.park_id || !form.period_date}>
            {loading ? 'Creating…' : 'Create Period'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stateless submit form — parent manages state (no hooks here)
function SubmitForm({ form, onChange, onSubmit, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60,
      display: 'grid', placeItems: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-title">Submit Settlement</div>
        <div className="modal-msg" style={{ marginBottom: 16 }}>
          Enter the actual revenue collected for this period.
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Actual Revenue (INR)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.actual_rev}
          onChange={e => onChange('actual_rev', e.target.value)}
          placeholder="e.g. 45000"
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, marginBottom: 12 }}
        />

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Notes (optional)
        </label>
        <textarea
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
          placeholder="Any reconciliation notes…"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
        />

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading || !form.actual_rev}>
            {loading ? 'Submitting…' : 'Submit Settlement'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinanceSettlementsClient() {
  const { can } = useAuth();

  const [data,        setData]        = useState({ data: [], total: 0 });
  const [loading,     setLoading]     = useState(true);
  const [denied,      setDenied]      = useState(false);
  const [page,        setPage]        = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [toast,       setToast]       = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Parks list for the create period form
  const [parks,       setParks]       = useState([]);

  // Create period modal state
  const [showCreate,    setShowCreate]    = useState(false);
  const [createForm,    setCreateForm]    = useState({ park_id: '', period_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [createError,   setCreateError]   = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Submit form state
  const [submitTarget, setSubmitTarget] = useState(null); // settlement object
  const [submitForm,   setSubmitForm]   = useState({ actual_rev: '', notes: '' });

  // Confirmation for approve / dispute
  const [confirm, setConfirm] = useState(null); // { action, settlement }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    apiFetch('/api/parks').then(setParks).catch(() => {});
  }, []);

  const handleCreatePeriod = async () => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      await apiFetch('/api/finance/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ park_id: createForm.park_id, period_date: createForm.period_date, notes: createForm.notes || undefined }),
      });
      setShowCreate(false);
      showToast('Settlement period created');
      fetchRef.current();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const fetchRef = useRef(null);
  fetchRef.current = async ({ pg = page, st = statusFilter } = {}) => {
    setLoading(true);
    setDenied(false);
    try {
      const params = new URLSearchParams({ page: pg, limit: LIMIT });
      if (st) params.set('status', st);
      const result = await apiFetch(`/api/finance/settlements?${params}`);
      setData(result);
    } catch (err) {
      if (err.message?.toLowerCase().includes('permission')) setDenied(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current(); }, []);

  const handleStatusChange = (s) => {
    setStatusFilter(s);
    setPage(1);
    fetchRef.current({ pg: 1, st: s });
  };

  const handlePage = (p) => {
    setPage(p);
    fetchRef.current({ pg: p });
  };

  const handleSubmit = async () => {
    if (!submitTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await apiFetch(`/api/finance/settlements/${submitTarget.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_rev: parseFloat(submitForm.actual_rev), notes: submitForm.notes }),
      });
      setSubmitTarget(null);
      showToast('Settlement submitted');
      fetchRef.current();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (action, settlement, reason) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const pathMap = {
        approve: `/api/finance/settlements/${settlement.id}/approve`,
        dispute: `/api/finance/settlements/${settlement.id}/dispute`,
      };
      await apiFetch(pathMap[action], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'dispute' ? { reason } : {}),
      });
      setConfirm(null);
      showToast(`Settlement ${action === 'approve' ? 'approved and locked' : 'disputed'}`);
      fetchRef.current();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(data.total / LIMIT);

  if (!can('finance.view') && !loading) {
    return (
      <div className="app">
        <Sidebar active="settlements"/>
        <div className="main">
          <Topbar current="Settlement Management" icon="lock"/>
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
      <Sidebar active="settlements"/>
      <div className="main">
        <Topbar current="Settlement Management" icon="lock"/>
        <div className="canvas">

          {actionError && (
            <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={13} color="var(--red)"/>
              {actionError}
              <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }} onClick={() => setActionError(null)}>✕</button>
            </div>
          )}

          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Settlement Periods</div>
              <span className="tag">{data.total} total</span>

              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                {STATUSES.map(s => (
                  <button
                    key={s || 'all'}
                    className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-ghost'}`}
                    style={{ padding: '0 8px', height: 26 }}
                    onClick={() => handleStatusChange(s)}
                  >
                    {s || 'All'}
                  </button>
                ))}
              </div>

              <div className="sec-actions">
                {can('finance.submit') && (
                  <button className="btn btn-sm btn-primary" onClick={() => { setCreateForm({ park_id: parks[0]?.id || '', period_date: new Date().toISOString().slice(0, 10), notes: '' }); setCreateError(null); setShowCreate(true); }}>
                    <Icon name="plus" size={12} color="#fff"/> New Period
                  </button>
                )}
                <button className="btn btn-sm icon-btn" onClick={() => fetchRef.current()} title="Refresh">
                  <Icon name="refresh" size={13}/>
                </button>
              </div>
            </div>

            <div className="sec-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading settlements…</span></div>
              ) : denied ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>Permission denied.</div>
              ) : data.data.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center' }}>
                  <Icon name="lock" size={32} color="var(--ink-5)"/>
                  <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>
                    No settlement periods{statusFilter ? ` with status "${statusFilter}"` : ''}.
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Park</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Expected</th>
                        <th style={{ textAlign: 'right' }}>Actual</th>
                        <th style={{ textAlign: 'right' }}>Variance</th>
                        <th>Submitted</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map(s => {
                        const severity = s.variance != null
                          ? (Math.abs(s.variance) / (Math.abs(s.expected_rev) || 1) >= 0.10 ? 'critical'
                            : Math.abs(s.variance) / (Math.abs(s.expected_rev) || 1) >= 0.05 ? 'high'
                            : Math.abs(s.variance) / (Math.abs(s.expected_rev) || 1) >= 0.02 ? 'medium'
                            : 'low')
                          : null;
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{s.park_name}</td>
                            <td className="mono" style={{ fontSize: 12 }}>{fmtDate(s.period_date)}</td>
                            <td><StatusBadge status={s.status} locked={s.locked}/></td>
                            <td className="mono" style={{ textAlign: 'right' }}>{s.expected_rev != null ? inr(s.expected_rev) : '—'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{s.actual_rev != null ? inr(s.actual_rev) : '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <VarianceCell variance={s.variance} severity={severity}/>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--ink-4)' }}>{s.submitted_by_email ? `${s.submitted_by_email.split('@')[0]} · ${fmtDate(s.submitted_at)}` : '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              {s.status === 'open' && can('finance.submit') && !s.locked && (
                                <button className="btn btn-sm" onClick={() => { setSubmitTarget(s); setSubmitForm({ actual_rev: '', notes: '' }); }}>
                                  Submit
                                </button>
                              )}
                              {s.status === 'submitted' && can('finance.approve') && (
                                <>
                                  <button className="btn btn-sm btn-danger" style={{ marginRight: 4 }} onClick={() => setConfirm({ action: 'dispute', settlement: s })}>
                                    Dispute
                                  </button>
                                  <button className="btn btn-sm btn-primary" onClick={() => setConfirm({ action: 'approve', settlement: s })}>
                                    <Icon name="lock" size={11} color="#fff"/> Approve & Lock
                                  </button>
                                </>
                              )}
                              {s.status === 'approved' && can('finance.approve') && (
                                <button className="btn btn-sm btn-warning" onClick={() => setConfirm({ action: 'dispute', settlement: s })}>
                                  Dispute
                                </button>
                              )}
                              {s.status === 'disputed' && (
                                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Awaiting resubmission</span>
                              )}
                            </td>
                          </tr>
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
                    {data.total} total · page {page}/{totalPages}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Create period modal */}
      {showCreate && (
        <CreatePeriodForm
          form={createForm}
          onChange={(k, v) => setCreateForm(f => ({ ...f, [k]: v }))}
          parks={parks}
          onSubmit={handleCreatePeriod}
          onCancel={() => setShowCreate(false)}
          loading={createLoading}
          error={createError}
        />
      )}

      {/* Submit form modal */}
      {submitTarget && (
        <SubmitForm
          form={submitForm}
          onChange={(k, v) => setSubmitForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleSubmit}
          onCancel={() => setSubmitTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* Approve / dispute confirmation */}
      {confirm?.action === 'approve' && (
        <ConfirmModal
          title="Approve &amp; Lock Settlement"
          message={`Approve and lock the settlement for ${confirm.settlement.park_name} on ${fmtDate(confirm.settlement.period_date)}? This will prevent new ticket entries for this period.`}
          confirmLabel="Approve & Lock"
          confirmVariant="primary"
          loading={actionLoading}
          onConfirm={() => handleAction('approve', confirm.settlement)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.action === 'dispute' && (
        <ConfirmModal
          title="Dispute Settlement"
          message={`Raise a dispute on the settlement for ${confirm.settlement.park_name} on ${fmtDate(confirm.settlement.period_date)}.`}
          confirmLabel="Raise Dispute"
          confirmVariant="danger"
          requireReason
          reasonLabel="Dispute reason"
          loading={actionLoading}
          onConfirm={(reason) => handleAction('dispute', confirm.settlement, reason)}
          onCancel={() => setConfirm(null)}
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
