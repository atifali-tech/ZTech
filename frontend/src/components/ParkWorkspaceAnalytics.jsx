'use client';
import { useState, useEffect, useRef } from 'react';
import Icon    from './Icon';
import Toast   from './Toast';
import { inr, inrFull, num } from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="fin-kpi" style={{ minWidth: 130 }}>
      <div className="fin-kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon && <Icon name={icon} size={11} color="var(--ink-5)"/>}
        {label}
      </div>
      <div className="fin-kpi-val" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="fin-kpi-sub">{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.08em', color: 'var(--ink-5)', marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

const DATE_RANGES = [
  { label: 'Today',    days: 0  },
  { label: '7 days',   days: 7  },
  { label: '30 days',  days: 30 },
  { label: '90 days',  days: 90 },
];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ParkWorkspaceAnalytics({ parkId, park }) {
  const [range,    setRange]    = useState(1); // index into DATE_RANGES
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState({ msg: null, type: 'ok' });

  const showToast  = (msg, type = 'ok') => setToast({ msg, type });
  const clearToast = () => setToast({ msg: null, type: 'ok' });

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    setLoading(true);
    try {
      const { days } = DATE_RANGES[range];
      const fromDate = days === 0 ? new Date().toISOString().slice(0, 10) : daysAgo(days);
      const toDate   = new Date().toISOString().slice(0, 10);

      // Tickets & revenue: query tickets table scoped to this park
      const ticketQs = new URLSearchParams({
        park_id:  parkId,
        from:     fromDate,
        to:       toDate,
        limit:    '500',
      });

      // Shifts scoped to this park for variance analysis
      const shiftQs = new URLSearchParams({ park_id: parkId, limit: '200' });

      // Settlements scoped to this park (auth-scoped endpoint, add explicit park filter via query)
      const settleQs = new URLSearchParams({ park_id: parkId, from: fromDate, to: toDate, limit: '50' });

      const [tickets, shifts, settlements] = await Promise.all([
        apiFetch(`/api/tickets?${ticketQs}`).catch(() => ({ data: [], total: 0 })),
        apiFetch(`/api/operations/shifts?${shiftQs}`).catch(() => []),
        apiFetch(`/api/finance/settlements?${settleQs}`).catch(() => ({ data: [], total: 0 })),
      ]);

      const ticketRows     = Array.isArray(tickets) ? tickets : (tickets.data || []);
      const shiftRows      = Array.isArray(shifts)  ? shifts  : [];
      const settlementRows = Array.isArray(settlements) ? settlements : (settlements.data || []);

      // Revenue aggregates
      const totalRevenue  = ticketRows.reduce((s, t) => s + parseFloat(t.total_amount || 0), 0);
      const totalVisitors = ticketRows.reduce((s, t) => s + parseInt(t.quantity || 1, 10), 0);
      const totalTickets  = ticketRows.length;
      const avgTicketVal  = totalTickets > 0 ? totalRevenue / totalTickets : 0;

      // Ticket category breakdown
      const byCategory = {};
      ticketRows.forEach(t => {
        const cat = t.age_category || 'Unknown';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, revenue: 0 };
        byCategory[cat].count   += parseInt(t.quantity || 1, 10);
        byCategory[cat].revenue += parseFloat(t.total_amount || 0);
      });

      // Shift variance
      const closedShifts     = shiftRows.filter(s => ['Closed','Reconciled','Variance Flagged'].includes(s.status));
      const shiftsWithVar    = closedShifts.filter(s => s.variance != null);
      const totalVariance    = shiftsWithVar.reduce((s, sh) => s + parseFloat(sh.variance || 0), 0);
      const flaggedShifts    = shiftRows.filter(s => s.status === 'Variance Flagged').length;
      const openShifts       = shiftRows.filter(s => ['Open','Operating'].includes(s.status)).length;

      // Settlement summary
      const approvedSettlements  = settlementRows.filter(s => s.status === 'approved');
      const approvedRevenue      = approvedSettlements.reduce((s, sp) => s + parseFloat(sp.actual_rev || 0), 0);
      const pendingSettlements   = settlementRows.filter(s => s.status === 'submitted').length;
      const disputedSettlements  = settlementRows.filter(s => s.status === 'disputed').length;

      setData({
        totalRevenue, totalVisitors, totalTickets, avgTicketVal,
        byCategory,
        closedShifts: closedShifts.length, openShifts, flaggedShifts,
        totalVariance, shiftsWithVar: shiftsWithVar.length,
        approvedRevenue, pendingSettlements, disputedSettlements,
        approvedSettlements: approvedSettlements.length,
        settlementCount: settlementRows.length,
      });
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRef.current?.(); }, [parkId, range]);

  return (
    <>
      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-4)', marginRight: 8 }}>Period:</span>
        {DATE_RANGES.map((r, i) => (
          <button key={r.label}
            className={`btn btn-sm${range === i ? ' btn-primary' : ' btn-ghost'}`}
            style={{ padding: '0 12px', height: 28 }}
            onClick={() => setRange(i)}>
            {r.label}
          </button>
        ))}
        {loading && <span style={{ fontSize: 12, color: 'var(--ink-4)', marginLeft: 8 }}>Loading…</span>}
      </div>

      {!loading && data && (
        <>
          {/* Revenue KPIs */}
          <div className="sec">
            <div className="sec-head"><div className="sec-title">Revenue</div></div>
            <div className="sec-body">
              <SectionLabel>Ticket Sales</SectionLabel>
              <div className="fin-kpi-grid" style={{ marginBottom: 0 }}>
                <KpiCard label="Total Revenue"  value={inrFull(data.totalRevenue)}  icon="money"/>
                <KpiCard label="Total Visitors" value={num(data.totalVisitors)}     icon="users"/>
                <KpiCard label="Total Tickets"  value={num(data.totalTickets)}      icon="ticket"/>
                <KpiCard label="Avg Ticket"     value={inr(data.avgTicketVal)}      icon="chart"/>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(data.byCategory).length > 0 && (
            <div className="sec">
              <div className="sec-head"><div className="sec-title">Ticket Breakdown</div></div>
              <div className="sec-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Visitors</th>
                      <th style={{ textAlign: 'right' }}>Revenue</th>
                      <th style={{ textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byCategory)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .map(([cat, v]) => (
                        <tr key={cat}>
                          <td style={{ fontWeight: 600 }}>{cat}</td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{num(v.count)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{inrFull(v.revenue)}</td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--ink-4)' }}>
                            {data.totalRevenue > 0 ? `${((v.revenue / data.totalRevenue) * 100).toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Shift Performance KPIs */}
          <div className="sec">
            <div className="sec-head"><div className="sec-title">Shift Performance</div></div>
            <div className="sec-body">
              <div className="fin-kpi-grid" style={{ marginBottom: 0 }}>
                <KpiCard label="Open Shifts"
                  value={data.openShifts}
                  color={data.openShifts > 0 ? 'var(--teal)' : undefined}
                  icon="clock"/>
                <KpiCard label="Closed Shifts"
                  value={data.closedShifts}
                  icon="checkCircle"/>
                <KpiCard label="Variance Flagged"
                  value={data.flaggedShifts}
                  color={data.flaggedShifts > 0 ? 'var(--red)' : undefined}
                  icon="warning"/>
                <KpiCard label="Net Variance"
                  value={inr(Math.abs(data.totalVariance))}
                  color={data.totalVariance < 0 ? 'var(--red)' : data.totalVariance > 0 ? 'var(--good)' : undefined}
                  sub={data.totalVariance < 0 ? 'shortfall' : data.totalVariance > 0 ? 'surplus' : 'balanced'}
                  icon="money"/>
              </div>
            </div>
          </div>

          {/* Settlements KPIs */}
          <div className="sec">
            <div className="sec-head"><div className="sec-title">Settlements</div></div>
            <div className="sec-body">
              <div className="fin-kpi-grid" style={{ marginBottom: 0 }}>
                <KpiCard label="Approved Revenue" value={inrFull(data.approvedRevenue)} icon="money"/>
                <KpiCard label="Approved Periods" value={data.approvedSettlements}      icon="checkCircle"/>
                <KpiCard label="Pending Review"
                  value={data.pendingSettlements}
                  color={data.pendingSettlements > 0 ? '#D89614' : undefined}
                  icon="clock"/>
                <KpiCard label="Disputed"
                  value={data.disputedSettlements}
                  color={data.disputedSettlements > 0 ? 'var(--red)' : undefined}
                  icon="warning"/>
              </div>
            </div>
          </div>

          {/* Empty state if no data at all */}
          {data.totalTickets === 0 && data.closedShifts === 0 && data.settlementCount === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Icon name="chart" size={32} color="var(--ink-5)"/>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>
                No data found for the selected period.
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Icon name="warning" size={32} color="var(--ink-5)"/>
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-4)' }}>Analytics unavailable.</div>
        </div>
      )}

      <Toast message={toast.msg} type={toast.type} onDismiss={clearToast}/>
    </>
  );
}
