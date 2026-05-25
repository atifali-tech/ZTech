'use client';
import { useState, useEffect, useRef } from 'react';
import Icon    from './Icon';
import Toast   from './Toast';
import { useAuth } from '../lib/auth-context';
import { inr }     from '../lib/format';

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
  return <span className={cls}>{arrow} {inr(Math.abs(variance))}</span>;
}

// Stateless create period form — no hooks, safe per Turbopack Rule 1
function CreatePeriodForm({ form, onChange, onSubmit, onCancel, loading, error }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60,
      display: 'grid', placeItems: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-title">Create Settlement Period</div>
        <div className="modal-msg" style={{ marginBottom: 16 }}>Opens a new settlement period for daily reconciliation.</div>

        {error && (
          <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
            {error}
          </div>
        )}

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
          <button className="btn btn-primary" onClick={onSubmit} disabled={loading || !form.period_date}>
            {loading ? 'Creating…' : 'Create Period'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Stateless submit form — no hooks
function SubmitRevenueForm({ form, onChange, onSubmit, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60,
      display: 'grid', placeItems: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box">
        <div className="modal-title">Submit Settlement</div>
        <div className="modal-msg" style={{ marginBottom: 16 }}>Enter the actual revenue collected for this period.</div>

        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
          Actual Revenue (INR)
        </label>
        <input
          type="number" min="0" step="0.01"
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
          rows={2}
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

const SETTLEMENT_STATUS_TAG = {
  open:      'tag',
  submitted: 'tag amber',
  approved:  'tag green',
  disputed:  'tag red',
};

const EXCEPTION_TYPE_TAG = {
  missing_payment:  'tag red',
  amount_mismatch:  'tag amber',
  duplicate:        'tag indigo',
  cancelled_charge: 'tag red',
};

export default function ParkWorkspaceFinance({ parkId }) {
  const { can } = useAuth();

  const [subTab,         setSubTab]         = useState('settlements');
  const [settlements,    setSettlements]    = useState([]);
  const [recon,          setRecon]          = useState(null);
  const [reconDate,      setReconDate]      = useState(new Date().toISOString().slice(0, 10));
  const [settleLoading,  setSettleLoading]  = useState(true);
  const [reconLoading,   setReconLoading]   = useState(false);
  const [statusFilter,   setStatusFilter]   = useState('');
  const [actionLoading,  setActionLoading]  = useState(false);
  const [toast,          setToast]          = useState({ msg: null, type: 'ok' });

  // Create period modal
  const [showCreate,    setShowCreate]    = useState(false);
  const [createForm,    setCreateForm]    = useState({ period_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [createError,   setCreateError]   = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Submit revenue modal
  const [submitTarget, setSubmitTarget] = useState(null);
  const [submitForm,   setSubmitForm]   = useState({ actual_rev: '', notes: '' });

  // Reconciliation exceptions
  const [resolving,    setResolving]    = useState(null);

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const settleRef = useRef(null);
  settleRef.current = async () => {
    setSettleLoading(true);
    try {
      const qs = new URLSearchParams({ park_id: parkId, limit: '20' });
      if (statusFilter) qs.set('status', statusFilter);
      const result = await apiFetch(`/api/finance/settlements?${qs}`);
      setSettlements(Array.isArray(result) ? result : (result.data || []));
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSettleLoading(false); }
  };

  const reconRef = useRef(null);
  reconRef.current = async () => {
    if (!reconDate) return;
    setReconLoading(true);
    try {
      const result = await apiFetch(`/api/finance/reconciliation/summary?park_id=${encodeURIComponent(parkId)}&date=${reconDate}`);
      setRecon(result);
    } catch (err) {
      setRecon(null);
    } finally {
      setReconLoading(false);
    }
  };

  useEffect(() => { settleRef.current?.(); }, [parkId, statusFilter]);
  useEffect(() => { reconRef.current?.(); }, [parkId, reconDate]);

  const handleCreatePeriod = async () => {
    setCreateLoading(true);
    setCreateError(null);
    try {
      await apiFetch('/api/finance/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ park_id: parkId, period_date: createForm.period_date, notes: createForm.notes || undefined }),
      });
      setShowCreate(false);
      showToast('Settlement period created');
      settleRef.current?.();
    } catch (err) { setCreateError(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleSubmitRevenue = async () => {
    if (!submitTarget) return;
    setActionLoading(true);
    try {
      await apiFetch(`/api/finance/settlements/${submitTarget.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_rev: parseFloat(submitForm.actual_rev), notes: submitForm.notes }),
      });
      setSubmitTarget(null);
      showToast('Settlement submitted');
      settleRef.current?.();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const handleSettleAction = async (action, settlement) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/finance/settlements/${settlement.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      showToast(`Settlement ${action}d`);
      settleRef.current?.();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setActionLoading(false); }
  };

  const handleResolveException = async (exceptionId) => {
    setResolving(exceptionId);
    try {
      await apiFetch(`/api/finance/reconciliation/exceptions/${exceptionId}/resolve`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      setRecon(d => d ? ({
        ...d,
        exceptions: d.exceptions.map(e => e.id === exceptionId ? { ...e, resolved: true } : e),
      }) : d);
      showToast('Exception resolved');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setResolving(null); }
  };

  const SUB_TABS = [
    { id: 'settlements',    label: 'Settlements'   },
    { id: 'reconciliation', label: 'Reconciliation', hidden: !can('finance.reconcile') },
  ].filter(t => !t.hidden);

  return (
    <>
      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 18px',
              fontSize: 13, fontWeight: subTab === t.id ? 600 : 400,
              color: subTab === t.id ? 'var(--teal)' : 'var(--ink-3)',
              borderBottom: subTab === t.id ? '2px solid var(--teal)' : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              transition: 'color .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Settlements section */}
      {subTab === 'settlements' && <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Settlements</div>
          <span className="tag">{settlements.length} shown</span>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            {['', 'open', 'submitted', 'approved', 'disputed'].map(s => (
              <button key={s || 'all'}
                className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-ghost'}`}
                style={{ padding: '0 8px', height: 26 }}
                onClick={() => setStatusFilter(s)}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <div className="sec-actions">
            {can('finance.submit') && (
              <button className="btn btn-primary btn-sm"
                onClick={() => { setCreateForm({ period_date: new Date().toISOString().slice(0, 10), notes: '' }); setCreateError(null); setShowCreate(true); }}>
                <Icon name="plus" size={12} color="#fff"/> New Period
              </button>
            )}
          </div>
        </div>
        <div className="sec-body" style={{ padding: 0 }}>
          {settleLoading ? (
            <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>
          ) : settlements.length === 0 ? (
            <div style={{ padding: '32px 40px' }}>
              {/* Workflow visualization */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Icon name="file" size={24} color="var(--ink-5)"/>
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>No Settlement Periods Yet</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-4)' }}>Create a period to begin daily revenue reconciliation.</div>
              </div>
              {/* Visual workflow steps */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 0, flexWrap: 'wrap', marginBottom: 24,
              }}>
                {[
                  { step: 1, label: 'Create Period',    icon: 'plus',        desc: 'Open a daily settlement period', active: true  },
                  { step: 2, label: 'Submit Revenue',   icon: 'money',       desc: 'Enter actual cash collected',    active: false },
                  { step: 3, label: 'Approve',          icon: 'checkCircle', desc: 'Finance Head reviews & approves',active: false },
                  { step: 4, label: 'Reconcile',        icon: 'shield',      desc: 'Resolve any exceptions',         active: false },
                ].map((s, i, arr) => (
                  <div key={s.step} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      width: 120, padding: '10px 8px',
                      background: s.active ? 'var(--teal-50)' : 'var(--surface-2)',
                      border: `1px solid ${s.active ? 'var(--teal-100)' : 'var(--border)'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', marginBottom: 6,
                        background: s.active ? 'var(--teal)' : 'var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name={s.icon} size={14} color={s.active ? '#fff' : 'var(--ink-5)'}/>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: s.active ? 'var(--teal)' : 'var(--ink-3)', textAlign: 'center' }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-5)', textAlign: 'center', marginTop: 2, lineHeight: 1.3 }}>{s.desc}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 24, height: 1, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--ink-5)', marginTop: -10 }}>›</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {can('finance.submit') && (
                <div style={{ textAlign: 'center' }}>
                  <button className="btn btn-primary"
                    onClick={() => { setCreateForm({ period_date: new Date().toISOString().slice(0, 10), notes: '' }); setCreateError(null); setShowCreate(true); }}>
                    <Icon name="plus" size={13} color="#fff"/> Create First Settlement Period
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Expected</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{fmtDate(s.period_date)}</td>
                    <td>
                      <span className={SETTLEMENT_STATUS_TAG[s.status] || 'tag'}>{s.status}</span>
                      {s.locked && <Icon name="lock" size={11} color="var(--red)" style={{ marginLeft: 4 }}/>}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>
                      {s.expected_rev != null ? inr(s.expected_rev) : '—'}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>
                      {s.actual_rev != null ? inr(s.actual_rev) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <VarianceCell variance={s.variance} severity={s.variance_severity}/>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {can('finance.submit') && s.status === 'open' && (
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => { setSubmitTarget(s); setSubmitForm({ actual_rev: '', notes: '' }); }}>
                            Submit
                          </button>
                        )}
                        {can('finance.reconcile') && s.status === 'submitted' && (
                          <>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--good)' }}
                              disabled={actionLoading}
                              onClick={() => handleSettleAction('approve', s)}>
                              Approve
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                              disabled={actionLoading}
                              onClick={() => handleSettleAction('dispute', s)}>
                              Dispute
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>}

      {/* Reconciliation section */}
      {subTab === 'reconciliation' && can('finance.reconcile') && (
        <div className="sec">
          <div className="sec-head">
            <div className="sec-title">Reconciliation</div>
            <input
              type="date"
              value={reconDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setReconDate(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12 }}
            />
          </div>
          <div className="sec-body">
            {reconLoading ? (
              <div className="page-loading"><div className="page-loading-spinner"/><span className="page-loading-text">Loading…</span></div>
            ) : !recon ? (
              <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--ink-4)' }}>
                No reconciliation data for this date.
              </div>
            ) : (
              <>
                {/* Variance summary */}
                {recon.variance && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div className="fin-kpi" style={{ minWidth: 100 }}>
                      <div className="fin-kpi-val">{inr(recon.variance.expected_rev ?? 0)}</div>
                      <div className="fin-kpi-label">Expected</div>
                    </div>
                    <div className="fin-kpi" style={{ minWidth: 100 }}>
                      <div className="fin-kpi-val">{inr(recon.variance.actual_rev ?? 0)}</div>
                      <div className="fin-kpi-label">Actual</div>
                    </div>
                    <div className="fin-kpi" style={{ minWidth: 100 }}>
                      <div className="fin-kpi-val"
                        style={{ color: recon.variance.variance < 0 ? 'var(--red)' : recon.variance.variance > 0 ? 'var(--good)' : undefined }}>
                        {recon.variance.variance >= 0 ? '▲' : '▼'} {inr(Math.abs(recon.variance.variance ?? 0))}
                      </div>
                      <div className="fin-kpi-label">Variance ({recon.variance.variance_pct?.toFixed(1)}%)</div>
                    </div>
                    <div className="fin-kpi" style={{ minWidth: 80 }}>
                      <div className="fin-kpi-val">{recon.exceptions?.length ?? 0}</div>
                      <div className="fin-kpi-label">Exceptions</div>
                    </div>
                  </div>
                )}

                {/* Exceptions table */}
                {recon.exceptions && recon.exceptions.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Exceptions
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Severity</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th style={{ textAlign: 'right' }}>Status</th>
                          {can('finance.reconcile') && <th style={{ textAlign: 'right' }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {recon.exceptions.map(e => (
                          <tr key={e.id}>
                            <td><span className={EXCEPTION_TYPE_TAG[e.exception_type] || 'tag'}>{e.exception_type?.replace(/_/g, ' ')}</span></td>
                            <td>
                              <span className={e.severity === 'critical' || e.severity === 'high' ? 'tag red' : e.severity === 'medium' ? 'tag amber' : 'tag green'}>
                                {e.severity}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.description || '—'}</td>
                            <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>
                              {e.amount != null ? inr(e.amount) : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {e.resolved
                                ? <span className="tag green">Resolved</span>
                                : <span className="tag amber">Open</span>
                              }
                            </td>
                            {can('finance.reconcile') && (
                              <td style={{ textAlign: 'right' }}>
                                {!e.resolved && (
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--good)' }}
                                    disabled={resolving === e.id}
                                    onClick={() => handleResolveException(e.id)}>
                                    {resolving === e.id ? '…' : 'Resolve'}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {recon.exceptions?.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: 'var(--ink-4)' }}>
                    <Icon name="checkCircle" size={16} color="var(--good)" style={{ verticalAlign: 'middle', marginRight: 6 }}/>
                    No exceptions for this date.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create period modal */}
      {showCreate && (
        <CreatePeriodForm
          form={createForm}
          onChange={(k, v) => setCreateForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleCreatePeriod}
          onCancel={() => setShowCreate(false)}
          loading={createLoading}
          error={createError}
        />
      )}

      {/* Submit revenue modal */}
      {submitTarget && (
        <SubmitRevenueForm
          form={submitForm}
          onChange={(k, v) => setSubmitForm(f => ({ ...f, [k]: v }))}
          onSubmit={handleSubmitRevenue}
          onCancel={() => setSubmitTarget(null)}
          loading={actionLoading}
        />
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
