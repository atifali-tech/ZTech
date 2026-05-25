'use client';
import { useState, useEffect, useRef } from 'react';
import TrendAreaChart from './TrendAreaChart';
import { inr, num } from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function fmtDate(s) {
  const d = new Date((s || '') + 'T00:00:00');
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function RefundTrendCard() {
  const [rows,    setRows]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRef = useRef(null);
  fetchRef.current = async () => {
    try {
      const res = await fetch(`${BASE}/api/finance/analytics/refund-trend?limit=30`, { credentials: 'include' });
      if (res.status === 403 || res.status === 401) { setRows([]); return; }
      if (res.ok) {
        const j = await res.json();
        const raw = Array.isArray(j) ? j : (j?.trend ?? j?.data ?? []);
        setRows(raw.map(r => ({
          date:   r.date || r.period || '',
          count:  r.count  ?? r.refund_count   ?? 0,
          amount: r.amount ?? r.total_amount   ?? 0,
        })));
      }
    } catch (_) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRef.current(); }, []);

  if (!loading && (!rows || rows.length === 0)) return null;

  const xLabels    = (rows || []).map(r => fmtDate(r.date));
  const countSeries = { label: 'Refunds', data: (rows || []).map(r => r.count),  color: 'var(--coral)',  formatY: num };
  const amtSeries   = { label: 'Amount',  data: (rows || []).map(r => r.amount), color: 'var(--amber)',  formatY: inr, dashed: true };

  return (
    <div className="sec" style={{ height: '100%' }}>
      <div className="sec-head">
        <div className="sec-head-main">
          <div className="sec-title">Refund Trend</div>
          <div className="sec-sub">last 30 days</div>
        </div>
        <div className="sec-actions">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ width: 12, height: 2.5, background: 'var(--coral)', display: 'inline-block', borderRadius: 1 }}/>
              Count
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)' }}>
              <span style={{ width: 12, height: 0, borderTop: '2px dashed var(--amber)', display: 'inline-block' }}/>
              Amount
            </span>
          </div>
        </div>
      </div>
      <div className="sec-body" style={{ padding: '12px 12px 8px', minHeight: 170 }}>
        {loading
          ? <div className="chart-skeleton" style={{ height: 170 }}/>
          : <TrendAreaChart
              series={[countSeries, amtSeries]}
              xLabels={xLabels}
              height={170}
              dualAxis
              formatLeft={num}
              formatRight={inr}
              leftLabel="Count"
              rightLabel="Amt"
            />
        }
      </div>
    </div>
  );
}
