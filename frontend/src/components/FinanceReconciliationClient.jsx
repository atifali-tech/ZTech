'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar     from './Sidebar';
import Topbar      from './Topbar';
import Icon        from './Icon';
import { useAuth } from '../lib/auth-context';
import { inr, num } from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function SeverityBadge({ severity }) {
  const MAP = {
    low:      { cls: 'green',  label: 'Low'      },
    medium:   { cls: 'amber',  label: 'Medium'   },
    high:     { cls: 'red',    label: 'High'      },
    critical: { cls: 'red',    label: 'Critical'  },
  };
  const { cls, label } = MAP[severity] || { cls: '', label: severity };
  return <span className={`tag ${cls}`}>{label}</span>;
}

function ExceptionTypeBadge({ type }) {
  const MAP = {
    missing_payment:   { cls: 'red',    label: 'Missing Payment'   },
    amount_mismatch:   { cls: 'amber',  label: 'Amount Mismatch'   },
    duplicate:         { cls: 'indigo', label: 'Duplicate'         },
    cancelled_charge:  { cls: 'red',    label: 'Cancelled Charge'  },
  };
  const { cls, label } = MAP[type] || { cls: '', label: type?.replace(/_/g, ' ') || '—' };
  return <span className={`tag ${cls}`}>{label}</span>;
}

function VarianceSummary({ variance, expected, actual }) {
  if (!variance) return null;
  const cls = variance.severity === 'low' ? 'variance-ok' : variance.severity === 'medium' ? 'variance-warn' : 'variance-bad';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <span className={cls} style={{ fontSize: 16, fontWeight: 700 }}>
        {variance.variance >= 0 ? '▲' : '▼'} {inr(Math.abs(variance.variance))}
      </span>
      <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
        ({variance.variance_pct >= 0 ? '+' : ''}{variance.variance_pct?.toFixed(2)}%)
      </span>
      {variance.within_tolerance ? (
        <span className="tag green"><Icon name="checkCircle" size={10}/> Within tolerance</span>
      ) : (
        <span className={`tag ${variance.severity === 'critical' ? 'red' : variance.severity === 'high' ? 'red' : 'amber'}`}>
          <Icon name="warning" size={10}/> {variance.severity?.charAt(0).toUpperCase() + variance.severity?.slice(1)} variance
        </span>
      )}
    </div>
  );
}

export default function FinanceReconciliationClient() {
  const { can } = useAuth();

  const [parks,     setParks]     = useState([]);
  const [parkId,    setParkId]    = useState('');
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10));
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [parksLoading, setParksLoading] = useState(true);
  const [resolving, setResolving] = useState(null); // exception id being resolved
  const [resolveError, setResolveError] = useState(null);

  useEffect(() => {
    apiFetch('/api/parks')
      .then(ps => { setParks(ps); if (ps.length > 0) setParkId(ps[0].id); })
      .catch(() => {})
      .finally(() => setParksLoading(false));
  }, []);

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    if (!parkId || !date) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch(`/api/finance/reconciliation/summary?park_id=${encodeURIComponent(parkId)}&date=${date}`);
      setData(result);
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (exceptionId) => {
    setResolving(exceptionId);
    setResolveError(null);
    try {
      await apiFetch(`/api/finance/reconciliation/exceptions/${exceptionId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Optimistic update — mark this exception as resolved in local state
      setData(d => d ? ({
        ...d,
        exceptions: d.exceptions.map(e => e.id === exceptionId ? { ...e, resolved: true } : e),
      }) : d);
    } catch (err) {
      setResolveError(err.message);
    } finally {
      setResolving(null);
    }
  };

  if (!can('finance.reconcile') && !loading) {
    return (
      <div className="app">
        <Sidebar active="reconciliation"/>
        <div className="main">
          <Topbar current="Reconciliation" icon="chart"/>
          <div className="canvas">
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              <Icon name="lock" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 12 }}>You do not have the <strong>finance.reconcile</strong> permission.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const exp = data?.expected;
  const unresolvedCount = data?.exceptions?.filter(e => !e.resolved).length ?? 0;

  return (
    <div className="app">
      <Sidebar active="reconciliation"/>
      <div className="main">
        <Topbar current="Reconciliation" icon="chart"/>
        <div className="canvas">

          {/* Controls */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Reconciliation Summary</div>
              {data && (
                <span className={`tag ${unresolvedCount > 0 ? 'red' : 'green'}`}>
                  {unresolvedCount > 0 ? `${unresolvedCount} unresolved` : 'No exceptions'}
                </span>
              )}
            </div>
            <div className="sec-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="filter" style={{ maxWidth: 220 }}>
                  <label className="filter-label">Park</label>
                  {parksLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 0' }}>Loading parks…</div>
                  ) : (
                    <select className="filter-select" value={parkId} onChange={e => setParkId(e.target.value)}>
                      {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
                <div className="filter" style={{ maxWidth: 180 }}>
                  <label className="filter-label">Date</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => fetchRef.current()}
                  disabled={loading || !parkId || !date}
                  style={{ alignSelf: 'flex-end' }}
                >
                  <Icon name="refresh" size={13} color="#fff"/>
                  {loading ? 'Loading…' : 'Load'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={13} color="var(--red)"/> {error}
            </div>
          )}

          {resolveError && (
            <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '10px 14px', fontSize: 12.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={13} color="var(--red)"/> {resolveError}
              <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }} onClick={() => setResolveError(null)}>✕</button>
            </div>
          )}

          {data && (
            <>
              {/* KPI row */}
              <div className="fin-kpi-grid">
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Expected Revenue</div>
                  <div className="fin-kpi-val">{inr(exp?.expected_rev ?? 0)}</div>
                  <div className="fin-kpi-sub">{num(exp?.ticket_count ?? 0)} tickets</div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Actual Revenue</div>
                  <div className="fin-kpi-val">{data.actual_rev != null ? inr(data.actual_rev) : <span style={{ color: 'var(--ink-5)' }}>Not submitted</span>}</div>
                  <div className="fin-kpi-sub">{data.settlement?.status ? `Settlement: ${data.settlement.status}` : 'No settlement record'}</div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Variance</div>
                  <div style={{ marginTop: 4 }}>
                    {data.variance ? (
                      <VarianceSummary variance={data.variance} expected={exp?.expected_rev} actual={data.actual_rev}/>
                    ) : (
                      <span style={{ color: 'var(--ink-5)', fontSize: 14 }}>—</span>
                    )}
                  </div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Payment Breakdown</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                    {[
                      { label: 'Cash',  val: exp?.cash_total  },
                      { label: 'UPI',   val: exp?.upi_total   },
                      { label: 'Card',  val: exp?.card_total  },
                      { label: 'Split', val: exp?.split_total },
                    ].filter(r => r.val > 0).map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--ink-4)' }}>{label}</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{inr(val)}</span>
                      </div>
                    ))}
                    {(!exp || (exp.cash_total === 0 && exp.upi_total === 0 && exp.card_total === 0)) && (
                      <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>No transactions</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Settlement status bar */}
              {data.settlement && (
                <div style={{
                  background: data.settlement.locked ? 'var(--red-50)' : 'var(--teal-50)',
                  border: `1px solid ${data.settlement.locked ? 'var(--red-100)' : 'var(--teal-100)'}`,
                  borderRadius: 5, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                }}>
                  <Icon
                    name={data.settlement.locked ? 'lock' : 'checkCircle'}
                    size={14}
                    color={data.settlement.locked ? 'var(--red)' : 'var(--teal)'}
                  />
                  <strong>{data.settlement.locked ? 'Period is locked.' : `Settlement status: ${data.settlement.status}`}</strong>
                  {data.settlement.locked && ' No new ticket entries are permitted for this period.'}
                </div>
              )}

              {/* Exceptions */}
              <div className="sec">
                <div className="sec-head">
                  <div className="sec-title">Reconciliation Exceptions</div>
                  <span className="tag">{data.exceptions?.length ?? 0} total</span>
                  {unresolvedCount > 0 && <span className="tag red">{unresolvedCount} unresolved</span>}
                </div>
                <div className="sec-body" style={{ padding: 0 }}>
                  {data.exceptions?.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                      <Icon name="checkCircle" size={32} color="var(--good)"/>
                      <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>No exceptions found for this period.</div>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ticket</th>
                          <th>Type</th>
                          <th>Severity</th>
                          <th style={{ textAlign: 'right' }}>Expected</th>
                          <th style={{ textAlign: 'right' }}>Actual</th>
                          <th style={{ textAlign: 'right' }}>Variance</th>
                          <th>Status</th>
                          <th>Notes</th>
                          {can('finance.reconcile') && <th style={{ textAlign: 'right' }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {data.exceptions.map(e => (
                          <tr key={e.id}>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--ink-4)' }}>#{e.ticket_id || '—'}</td>
                            <td><ExceptionTypeBadge type={e.exception_type}/></td>
                            <td><SeverityBadge severity={e.severity}/></td>
                            <td className="mono" style={{ textAlign: 'right' }}>{e.expected_amt != null ? inr(e.expected_amt) : '—'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>{e.actual_amt != null ? inr(e.actual_amt) : '—'}</td>
                            <td className="mono" style={{ textAlign: 'right', color: e.variance < 0 ? 'var(--red)' : 'var(--good)', fontWeight: 600 }}>
                              {e.variance != null ? (e.variance >= 0 ? '+' : '') + inr(e.variance) : '—'}
                            </td>
                            <td>
                              {e.resolved
                                ? <span className="tag green">Resolved</span>
                                : <span className="tag amber">Unresolved</span>
                              }
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--ink-4)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.notes || '—'}</td>
                            {can('finance.reconcile') && (
                              <td style={{ textAlign: 'right' }}>
                                {!e.resolved && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    disabled={resolving === e.id}
                                    onClick={() => handleResolve(e.id)}
                                  >
                                    {resolving === e.id ? 'Resolving…' : 'Resolve'}
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {!data && !loading && !error && (
            <div style={{ padding: 64, textAlign: 'center' }}>
              <Icon name="chart" size={40} color="var(--ink-5)"/>
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-4)' }}>Select a park and date to load reconciliation data.</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
