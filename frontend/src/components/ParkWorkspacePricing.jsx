'use client';
import { useState, useEffect, useRef } from 'react';
import Icon           from './Icon';
import Toast          from './Toast';
import ConfirmDialog  from './ConfirmDialog';
import PricingRuleModal from './PricingRuleModal';
import { useAuth }    from '../lib/auth-context';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const inr = (v) => `₹${Number(v ?? 0).toFixed(2)}`;

const CATEGORIES = ['Adult', 'Child', 'Senior Citizen', 'Toddler'];
const DAY_TYPES  = ['Weekday', 'Weekend', 'Holiday'];

const DAY_TAG = { Weekday: 'tag', Weekend: 'tag teal', Holiday: 'tag amber' };

function StatusTag({ active }) {
  return active
    ? <span className="tag green" style={{ fontSize: 10 }}>Active</span>
    : <span className="tag gray"  style={{ fontSize: 10 }}>Inactive</span>;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ParkWorkspacePricing({ parkId }) {
  const { can } = useAuth();

  const [rules,   setRules]   = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('rules');   // 'rules' | 'history'
  const [modal,   setModal]   = useState(null);      // null | 'create' | rule object
  const [confirm, setConfirm] = useState(null);      // rule to deactivate/delete
  const [toast,   setToast]   = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([
        apiFetch(`/api/parks/${parkId}/pricing`),
        apiFetch(`/api/parks/${parkId}/pricing/history`),
      ]);
      setRules(Array.isArray(r) ? r : []);
      setHistory(Array.isArray(h) ? h : []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId]);

  const handleSave = (saved) => {
    setRules(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      return idx >= 0 ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved];
    });
    showToast(modal === 'create' ? 'Pricing rule added' : 'Pricing rule updated');
    setModal(null);
    // Refresh history
    apiFetch(`/api/parks/${parkId}/pricing/history`).then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => {});
  };

  const handleDelete = async () => {
    const rule = confirm;
    setConfirm(null);
    try {
      const result = await apiFetch(`/api/parks/${parkId}/pricing/${rule.id}`, { method: 'DELETE' });
      if (result.action === 'deleted') {
        setRules(prev => prev.filter(r => r.id !== rule.id));
        showToast('Rule deleted');
      } else {
        setRules(prev => prev.map(r => r.id === rule.id ? result.rule : r));
        showToast('Rule deactivated (has history — preserved for audit)');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Group active rules by category for a summary view
  const activeRules = rules.filter(r => r.is_active);

  // Build matrix: category × day_type → price
  const matrix = {};
  CATEGORIES.forEach(cat => {
    matrix[cat] = {};
    DAY_TYPES.forEach(dt => { matrix[cat][dt] = null; });
  });
  activeRules.forEach(r => {
    if (matrix[r.category]) matrix[r.category][r.day_type] = r;
  });

  const hasAnyRule = rules.length > 0;
  const hasActiveRule = activeRules.length > 0;

  return (
    <>
      {/* Summary cards */}
      {tab === 'rules' && !loading && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Active Rules',   value: activeRules.length },
            { label: 'Categories',     value: [...new Set(activeRules.map(r => r.category))].length },
            { label: 'Highest Price',  value: activeRules.length ? `₹${Math.max(...activeRules.map(r => parseFloat(r.base_price || 0))).toFixed(0)}` : '—' },
            { label: 'Last Updated',   value: rules.length ? new Date(Math.max(...rules.map(r => new Date(r.updated_at || r.created_at)))).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
          ].map(c => (
            <div key={c.label} style={{
              flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '12px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-4)', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="sec">
        <div className="sec-head">
          <div className="sec-title">Pricing Management</div>
          <span className="tag">{activeRules.length} active rules</span>
          <div className="sec-actions">
            <div className="toggle-group">
              <button className={tab === 'rules'   ? 'on' : ''} onClick={() => setTab('rules')}>Active Rules</button>
              <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
                Change History {history.length > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({history.length})</span>}
              </button>
            </div>
            {can('parks.edit') && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal('create')}>
                <Icon name="plus" size={12} color="#fff"/> Add Rule
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="page-loading">
          <div className="page-loading-spinner"/>
          <span className="page-loading-text">Loading pricing…</span>
        </div>
      )}

      {/* ── RULES TAB ── */}
      {!loading && tab === 'rules' && (
        <>
          {/* Pricing Matrix — active rules at a glance */}
          {hasActiveRule && (
            <div className="sec" style={{ marginBottom: 0 }}>
              <div className="sec-head">
                <div className="sec-title" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-4)' }}>Active Price Matrix</div>
              </div>
              <div className="sec-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      {DAY_TYPES.map(dt => <th key={dt} style={{ textAlign: 'center' }}>{dt}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.map(cat => (
                      <tr key={cat}>
                        <td style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{cat}</td>
                        {DAY_TYPES.map(dt => {
                          const rule = matrix[cat][dt];
                          const gstPct = rule ? (parseFloat(rule.cgst_pct || 0) + parseFloat(rule.sgst_pct || 0)) : 0;
                          return (
                            <td key={dt} style={{ textAlign: 'center' }}>
                              {rule ? (
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--teal)' }}>{inr(rule.base_price)}</div>
                                  {gstPct > 0 && (
                                    <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>
                                      +{gstPct}% GST = {inr(parseFloat(rule.base_price) * (1 + gstPct / 100))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--ink-5)', fontSize: 12 }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All rules table */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">All Rules</div>
              <span className="tag">{rules.length} total</span>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              {rules.length === 0 ? (
                <div style={{ padding: '24px 0 32px' }}>
                  {/* Onboarding message */}
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Icon name="ticket" size={28} color="var(--ink-5)"/>
                    <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>Configure Ticket Pricing</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-4)', maxWidth: 360, margin: '6px auto 0' }}>
                      Set prices for each ticket category and day type. Prices apply automatically based on the visit date.
                    </div>
                    {can('parks.edit') && (
                      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setModal('create')}>
                        <Icon name="plus" size={13} color="#fff"/> Add First Rule
                      </button>
                    )}
                  </div>
                  {/* Pricing structure preview */}
                  <div style={{ padding: '0 24px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-5)', marginBottom: 8 }}>
                      Supported Pricing Structure
                    </div>
                    <table className="data-table" style={{ opacity: 0.5 }}>
                      <thead>
                        <tr>
                          <th>Category</th>
                          {DAY_TYPES.map(dt => <th key={dt} style={{ textAlign: 'center' }}><span className={DAY_TAG[dt]}>{dt}</span></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {CATEGORIES.map(cat => (
                          <tr key={cat}>
                            <td style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{cat}</td>
                            {DAY_TYPES.map(dt => (
                              <td key={dt} style={{ textAlign: 'center', color: 'var(--ink-5)', fontSize: 12 }}>
                                {cat === 'Toddler' ? 'Free' : '₹ —'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 8, textAlign: 'center' }}>
                      12 rules total — 4 categories × 3 day types. GST is applied automatically per rule.
                    </div>
                  </div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Day Type</th>
                      <th style={{ textAlign: 'right' }}>Base Price</th>
                      <th>GST</th>
                      <th style={{ textAlign: 'right' }}>Total Price</th>
                      <th>Effective From</th>
                      <th>Effective To</th>
                      <th>Status</th>
                      {can('parks.edit') && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map(r => {
                      const gstPct = parseFloat(r.cgst_pct || 0) + parseFloat(r.sgst_pct || 0);
                      const total  = parseFloat(r.base_price) * (1 + gstPct / 100);
                      return (
                        <tr key={r.id} style={!r.is_active ? { opacity: 0.55 } : {}}>
                          <td style={{ fontWeight: 600 }}>{r.category}</td>
                          <td><span className={DAY_TAG[r.day_type] || 'tag'} style={{ fontSize: 10 }}>{r.day_type}</span></td>
                          <td className="mono" style={{ textAlign: 'right' }}>{inr(r.base_price)}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                            {gstPct > 0 ? `${gstPct}% (${r.cgst_pct}C + ${r.sgst_pct}S)` : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: r.is_active ? 'var(--teal)' : undefined }}>{inr(total)}</td>
                          <td style={{ fontSize: 12 }}>{formatDate(r.effective_from)}</td>
                          <td style={{ fontSize: 12, color: r.effective_to ? 'var(--ink-3)' : 'var(--ink-5)' }}>
                            {r.effective_to ? formatDate(r.effective_to) : 'Open-ended'}
                          </td>
                          <td><StatusTag active={r.is_active}/></td>
                          {can('parks.edit') && (
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => setModal(r)}>Edit</button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--red)' }}
                                  onClick={() => setConfirm(r)}
                                >
                                  {r.is_active ? 'Deactivate' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {!loading && tab === 'history' && (
        <div className="sec">
          <div className="sec-head">
            <div className="sec-title">Pricing Change History</div>
            <span className="tag">{history.length} entries</span>
          </div>
          <div className="sec-body" style={{ padding: 0 }}>
            {history.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
                No pricing changes recorded yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Category</th>
                    <th>Day Type</th>
                    <th>Action</th>
                    <th style={{ textAlign: 'right' }}>Previous Price</th>
                    <th style={{ textAlign: 'right' }}>New Price</th>
                    <th>Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {new Date(h.changed_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 600 }}>{h.category}</td>
                      <td><span className={DAY_TAG[h.day_type] || 'tag'} style={{ fontSize: 10 }}>{h.day_type}</span></td>
                      <td>
                        <span className={`tag ${h.action === 'created' ? 'green' : h.action === 'deactivated' ? 'gray' : 'amber'}`} style={{ fontSize: 10, textTransform: 'capitalize' }}>
                          {h.action}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-4)' }}>
                        {h.old_base_price != null ? inr(h.old_base_price) : <span style={{ color: 'var(--ink-5)' }}>—</span>}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{inr(h.new_base_price)}</td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{h.changed_by_email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <PricingRuleModal
          parkId={parkId}
          rule={modal === 'create' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm deactivate/delete */}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.is_active ? 'Deactivate Rule' : 'Delete Rule'}
        message={
          confirm?.is_active
            ? `Deactivate ${confirm?.category} / ${confirm?.day_type} pricing? The rule will be preserved for audit history.`
            : `Permanently delete this ${confirm?.category} / ${confirm?.day_type} rule? This cannot be undone.`
        }
        confirmLabel={confirm?.is_active ? 'Deactivate' : 'Delete'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
