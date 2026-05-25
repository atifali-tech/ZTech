'use client';
import { useState, useMemo } from 'react';
import TrendAreaChart from './TrendAreaChart';
import { inr, num } from '../lib/format';

function normRows(data) {
  const raw = Array.isArray(data) ? data : (data?.daily ?? data?.trend ?? data?.data ?? []);
  return raw.map(r => ({
    date:     r.date     ?? r.period    ?? '',
    revenue:  r.revenue  ?? r.total_revenue  ?? r.rev     ?? 0,
    visitors: r.visitors ?? r.total_visitors ?? r.footfall ?? 0,
    tickets:  r.tickets  ?? r.total_tickets  ?? r.txns     ?? 0,
  }));
}

function fmtDate(dateStr, tab) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr.slice(5) || dateStr;
  if (tab === 'Monthly') return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function weeklyAgg(rows) {
  return rows.reduce((acc, r, i) => {
    const w = Math.floor(i / 7);
    if (!acc[w]) acc[w] = { date: r.date, revenue: 0, visitors: 0, tickets: 0 };
    acc[w].revenue  += r.revenue;
    acc[w].visitors += r.visitors;
    acc[w].tickets  += r.tickets;
    return acc;
  }, []);
}

function monthlyAgg(rows) {
  const m = {};
  rows.forEach(r => {
    const k = r.date.slice(0, 7);
    if (!m[k]) m[k] = { date: r.date, revenue: 0, visitors: 0, tickets: 0 };
    m[k].revenue  += r.revenue;
    m[k].visitors += r.visitors;
    m[k].tickets  += r.tickets;
  });
  return Object.values(m);
}

export default function RevenueTrendCard({ trendData, loading = false }) {
  const [tab,    setTab]    = useState('Daily');
  const [metric, setMetric] = useState('both');

  const allRows = useMemo(() => normRows(trendData), [trendData]);

  const rows = useMemo(() => {
    if (!allRows.length) return [];
    if (tab === 'Weekly')  return weeklyAgg(allRows);
    if (tab === 'Monthly') return monthlyAgg(allRows);
    return allRows;
  }, [allRows, tab]);

  const xLabels = useMemo(() => rows.map(r => fmtDate(r.date, tab)), [rows, tab]);

  const revSeries = { label: 'Revenue',  data: rows.map(r => r.revenue),  color: 'var(--teal)',  formatY: inr };
  const visSeries = { label: 'Visitors', data: rows.map(r => r.visitors), color: 'var(--amber)', formatY: num, dashed: true };
  const tixSeries = { label: 'Tickets',  data: rows.map(r => r.tickets),  color: 'var(--indigo)', formatY: num, dashed: true };

  const activeSeries =
    metric === 'revenue'  ? [revSeries] :
    metric === 'visitors' ? [visSeries] :
    metric === 'tickets'  ? [tixSeries] :
    [revSeries, visSeries];

  const availTabs = allRows.length > 60 ? ['Daily','Weekly','Monthly']
    : allRows.length > 14 ? ['Daily','Weekly'] : ['Daily'];

  const periodLabel = rows.length
    ? `${rows.length} ${tab === 'Monthly' ? 'months' : tab === 'Weekly' ? 'weeks' : 'days'}`
    : '';

  const legendItem = (s, active) => (
    <button
      key={s.label}
      onClick={() => setMetric(m => m === s.key ? 'both' : s.key)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: active ? 'var(--ink-2)' : 'var(--ink-5)',
        transition: 'color .15s',
      }}
    >
      {s.dashed
        ? <span style={{ width: 14, height: 0, borderTop: `2.5px dashed ${s.color}`, display: 'inline-block', opacity: active ? 1 : 0.4 }}/>
        : <span style={{ width: 14, height: 3, background: s.color, display: 'inline-block', borderRadius: 2, opacity: active ? 1 : 0.35 }}/>
      }
      {s.label}
    </button>
  );

  const legends = [
    { ...revSeries, key: 'revenue' },
    { ...visSeries, key: 'visitors' },
  ];

  return (
    <div className="sec">
      <div className="sec-head">
        <div className="sec-head-main">
          <div className="sec-title">Revenue &amp; Visitor Trend</div>
          {periodLabel && <div className="sec-sub">{periodLabel}</div>}
        </div>
        <div className="sec-actions">
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginRight: 6 }}>
            {legends.map(s => legendItem(s, metric === 'both' || metric === s.key))}
          </div>
          {availTabs.length > 1 && (
            <div className="toggle-group">
              {availTabs.map(t => (
                <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="sec-body" style={{ padding: '12px 12px 8px', minHeight: 240 }}>
        {loading
          ? <div className="chart-skeleton" style={{ height: 240 }}/>
          : <TrendAreaChart
              series={activeSeries}
              xLabels={xLabels}
              height={240}
              dualAxis={metric === 'both'}
              formatLeft={inr}
              formatRight={num}
              leftLabel="Revenue"
              rightLabel="Visitors"
            />
        }
      </div>
    </div>
  );
}
