'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar         from './Sidebar';
import Topbar          from './Topbar';
import Icon            from './Icon';
import { KpiCard }     from './KpiRow';
import ChartWrapper          from './ChartWrapper';
import FinanceTrendChart     from './FinanceTrendChart';
import PendingActionsWidget  from './PendingActionsWidget';
import { useAuth }     from '../lib/auth-context';
import { inr, num, downloadCSV } from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Stateless — no hooks — inline per Turbopack Rule 1
function ParkPerfTable({ rows }) {
  if (!rows?.length) return <div style={{ padding: '24px 16px', color: 'var(--ink-4)', fontSize: 12, textAlign: 'center' }}>No data for this period.</div>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Park</th>
          <th style={{ textAlign: 'right' }}>Gross Revenue</th>
          <th style={{ textAlign: 'right' }}>Refunded</th>
          <th style={{ textAlign: 'right' }}>Net Revenue</th>
          <th style={{ textAlign: 'right' }}>Refund %</th>
          <th>Settlement</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.park_id}>
            <td style={{ fontWeight: 600 }}>{r.park_name}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(r.gross_rev)}</td>
            <td className="mono" style={{ textAlign: 'right', color: r.refunded_amount > 0 ? 'var(--red)' : undefined }}>{inr(r.refunded_amount)}</td>
            <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{inr(r.net_rev)}</td>
            <td className="mono" style={{ textAlign: 'right', color: r.refund_pct > 5 ? 'var(--red)' : 'var(--ink-3)' }}>
              {r.refund_pct?.toFixed(1)}%
            </td>
            <td>
              {r.settlement_status
                ? <span className={`tag ${r.settlement_status === 'approved' ? 'green' : r.settlement_status === 'disputed' ? 'red' : 'amber'}`}>{r.settlement_status}</span>
                : <span style={{ color: 'var(--ink-5)', fontSize: 12 }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Stateless — no hooks
function TaxTable({ data }) {
  if (!data?.by_category?.length) return null;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Category</th>
          <th style={{ textAlign: 'right' }}>Tickets</th>
          <th style={{ textAlign: 'right' }}>CGST</th>
          <th style={{ textAlign: 'right' }}>SGST</th>
          <th style={{ textAlign: 'right' }}>Total Tax</th>
        </tr>
      </thead>
      <tbody>
        {data.by_category.map(r => (
          <tr key={r.category}>
            <td>{r.category || '—'}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{num(r.ticket_count)}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(r.cgst)}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(r.sgst)}</td>
            <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{inr(r.total_tax)}</td>
          </tr>
        ))}
        {data.totals && (
          <tr style={{ background: 'var(--surface-2)', fontWeight: 600 }}>
            <td>Total</td>
            <td/>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(data.totals.cgst)}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(data.totals.sgst)}</td>
            <td className="mono" style={{ textAlign: 'right' }}>{inr(data.totals.total_tax)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default function FinanceDashboardClient() {
  const { can } = useAuth();

  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from,     setFrom]     = useState(monthAgo);
  const [to,       setTo]       = useState(today);
  const [overview, setOverview] = useState(null);
  const [parkPerf, setParkPerf] = useState([]);
  const [trend,    setTrend]    = useState([]);
  const [tax,      setTax]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchRef = useRef(null);
  fetchRef.current = async ({ f = from, t = to } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const qs = `?from=${f}&to=${t}`;
      const [ov, pp, tr, tx] = await Promise.all([
        apiFetch(`/api/finance/analytics/overview${qs}`),
        apiFetch(`/api/finance/analytics/park-performance${qs}`),
        apiFetch('/api/finance/analytics/refund-trend'),
        apiFetch(`/api/finance/analytics/tax-summary${qs}`),
      ]);
      setOverview(ov);
      setParkPerf(Array.isArray(pp) ? pp : []);
      setTrend(Array.isArray(tr) ? tr : []);
      setTax(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current(); }, []);

  const handleApply = () => fetchRef.current({ f: from, t: to });

  const csvParkPerf = () => {
    if (!parkPerf?.length) return;
    downloadCSV('park-performance.csv',
      ['Park', 'Gross Revenue', 'Refunded', 'Net Revenue', 'Refund %', 'Settlement'],
      parkPerf.map(r => [r.park_name, r.gross_rev, r.refunded_amount, r.net_rev, `${r.refund_pct?.toFixed(1)}%`, r.settlement_status || '—']),
    );
  };

  const csvTax = () => {
    if (!tax?.by_category?.length) return;
    downloadCSV('tax-summary.csv',
      ['Category', 'Tickets', 'CGST', 'SGST', 'Total Tax'],
      tax.by_category.map(r => [r.category, r.ticket_count, r.cgst, r.sgst, r.total_tax]),
    );
  };

  if (!can('finance.view') && !loading) {
    return (
      <div className="app">
        <Sidebar active="finance-overview"/>
        <div className="main">
          <Topbar current="Finance Overview" icon="chart"/>
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
      <Sidebar active="finance-overview"/>
      <div className="main">
        <Topbar current="Finance Overview" icon="chart"/>
        <div className="canvas">

          <PendingActionsWidget/>

          {/* Date range filter */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Finance Analytics</div>
              {overview && (
                <span className="tag">{num(overview.ticket_count)} tickets</span>
              )}
              <div className="sec-actions">
                <button className="btn btn-sm icon-btn" onClick={() => fetchRef.current()} title="Refresh" disabled={loading}>
                  <Icon name="refresh" size={13}/>
                </button>
              </div>
            </div>
            <div className="sec-body" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="filter" style={{ maxWidth: 180 }}>
                  <label className="filter-label">From</label>
                  <input type="date" className="filter-input" value={from}
                    onChange={e => setFrom(e.target.value)} max={to}/>
                </div>
                <div className="filter" style={{ maxWidth: 180 }}>
                  <label className="filter-label">To</label>
                  <input type="date" className="filter-input" value={to}
                    onChange={e => setTo(e.target.value)} max={today} min={from}/>
                </div>
                <button className="btn btn-primary" onClick={handleApply} disabled={loading}
                  style={{ alignSelf: 'flex-end' }}>
                  <Icon name="refresh" size={13} color="#fff"/>
                  {loading ? 'Loading…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--red-50)', border: '1px solid var(--red-100)',
              borderRadius: 5, padding: '10px 14px', fontSize: 12.5,
              color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="warning" size={13} color="var(--red)"/> {error}
            </div>
          )}

          {/* KPI row 1 — Revenue */}
          <div className="grid-12">
            <div className="col-3">
              <KpiCard
                label="Gross Revenue" icon="chart"
                value={overview ? inr(overview.gross_rev) : '—'}
                extra={overview && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{num(overview.ticket_count)} tickets issued</div>}
              />
            </div>
            <div className="col-3">
              <KpiCard
                label="Net Revenue" icon="money"
                value={overview ? inr(overview.net_rev) : '—'}
                extra={overview && <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>After {inr(overview.refunded_amount)} refunded</div>}
              />
            </div>
            <div className="col-3">
              <KpiCard
                label="Refunded" icon="arrowDown"
                value={overview ? inr(overview.refunded_amount) : '—'}
                extra={overview && (
                  <div style={{ fontSize: 11, color: overview.refund_pct > 5 ? 'var(--red)' : 'var(--ink-4)' }}>
                    {overview.refund_pct?.toFixed(1)}% of gross revenue
                  </div>
                )}
              />
            </div>
            <div className="col-3">
              <KpiCard
                label="GST Collected" icon="file"
                value={overview ? inr((overview.cgst_total || 0) + (overview.sgst_total || 0)) : '—'}
                extra={overview && (
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span>CGST: {inr(overview.cgst_total)}</span>
                    <span>SGST: {inr(overview.sgst_total)}</span>
                  </div>
                )}
              />
            </div>
          </div>

          {/* KPI row 2 — Operational status */}
          <div className="grid-12">
            <div className="col-4">
              <KpiCard
                label="Pending Settlements"
                value={overview ? num(overview.pending_settlements) : '—'}
                extra={overview && (
                  overview.pending_settlements > 0
                    ? <span className="tag amber">Requires action</span>
                    : <span className="tag green">All up to date</span>
                )}
              />
            </div>
            <div className="col-4">
              <KpiCard
                label="Locked Periods"
                value={overview ? num(overview.locked_periods) : '—'}
                extra={<div style={{ fontSize: 11, color: 'var(--ink-4)' }}>Approved and immutable</div>}
              />
            </div>
            <div className="col-4">
              <KpiCard
                label="Unresolved Exceptions"
                value={overview ? num(overview.unresolved_variances) : '—'}
                extra={overview && (
                  overview.unresolved_variances > 0
                    ? <span className="tag red">Needs review</span>
                    : <span className="tag green">All clear</span>
                )}
              />
            </div>
          </div>

          {/* Park performance table */}
          <ChartWrapper
            title="Park Performance"
            sub={`${from} – ${to}`}
            loading={loading}
            empty={!loading && !parkPerf?.length}
            chart={<ParkPerfTable rows={parkPerf}/>}
            onCsv={parkPerf?.length ? csvParkPerf : undefined}
            noPad
          />

          {/* Refund trend chart */}
          <ChartWrapper
            title="Refund Trend"
            sub="Last 12 months"
            loading={loading}
            empty={!loading && !trend?.length}
            emptyText="No refunds in the last 12 months"
            chart={<FinanceTrendChart data={trend}/>}
          />

          {/* Tax summary table */}
          <ChartWrapper
            title="Tax Summary by Category"
            sub={`${from} – ${to}`}
            loading={loading}
            empty={!loading && !tax?.by_category?.length}
            chart={<TaxTable data={tax}/>}
            onCsv={tax?.by_category?.length ? csvTax : undefined}
            noPad
          />

        </div>
      </div>
    </div>
  );
}
