'use client';
import { useState, useCallback, useTransition } from 'react';
import { num } from '../lib/format';
import Icon        from './Icon';
import { computeDefaultDates } from './FilterBar';
import DatePicker    from './DatePicker';
import WeekPicker    from './WeekPicker';
import MonthPicker   from './MonthPicker';
import QuarterPicker from './QuarterPicker';
import YearPicker    from './YearPicker';

// ─── Constants ───────────────────────────────────────────────
const AGE_CATS   = ['', 'Adult', 'Child', 'Toddler', 'Senior Citizen'];
const PAY_MODES  = ['', 'Cash', 'UPI', 'Card', 'Split'];
const STATUSES   = ['', 'Completed', 'Cancelled', 'Refunded', 'Pending'];
const PAGE_SIZES = [25, 50, 100];
const RANGES     = ['Daily','Weekly','Monthly','Quarterly','Yearly','Last 3 Months','Last 6 Months','Last 12 Months','Custom Range'];
const MO         = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtRolling(a, b) {
  if (!a || !b) return '';
  const s = new Date(a + 'T00:00:00'), e = new Date(b + 'T00:00:00');
  const sy = s.getFullYear(), ey = e.getFullYear();
  if (sy === ey) return `${MO[s.getMonth()]} – ${MO[e.getMonth()]} ${ey}`;
  return `${MO[s.getMonth()]} '${String(sy).slice(2)} – ${MO[e.getMonth()]} '${String(ey).slice(2)}`;
}

// ─── Helpers ─────────────────────────────────────────────────
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function PayBadge({ mode, amount }) {
  const MAP = { Cash: '#5DCAA5', UPI: '#62ADE8', Card: '#A09AF0', Split: '#E89B3A' };
  return (
    <span style={{ color: MAP[mode] || 'var(--ink-4)', fontWeight: 600 }}>
      {mode}
      {amount > 0 && <span className="mono" style={{ color: 'var(--ink-4)', fontWeight: 500 }}> {money(amount)}</span>}
    </span>
  );
}

function StatusBadge({ s }) {
  const MAP = { Completed: '#5DCAA5', Cancelled: '#E24B4A', Refunded: '#62ADE8', Pending: '#E89B3A' };
  return <span style={{ color: MAP[s] || 'var(--ink-4)', fontWeight: 600 }}>{s}</span>;
}

// ─── CSV export ───────────────────────────────────────────────
function SortTh({ col, label, sort, onSort }) {
  const active = sort.col === col;
  return (
    <th className="sortable" onClick={() => onSort(col)}>
      {label}
      <span style={{ marginLeft: 4, color: active ? 'var(--teal)' : 'var(--ink-5)', fontSize: 10 }}>
        {active ? (sort.dir === 'asc' ? 'Asc' : 'Desc') : '-'}
      </span>
    </th>
  );
}

function ticketCategories(ticket) {
  return ticket.categories || [{ name: ticket.ageCategory, quantity: ticket.quantity }];
}

function categoryLabel(name) {
  const n = (name || '').trim().toLowerCase();
  return { adult: 'Adult', child: 'Child', toddler: 'Toddler', senior_citizen: 'Senior Citizen', 'senior citizen': 'Senior Citizen' }[n]
    || ((name || '').charAt(0).toUpperCase() + (name || '').slice(1));
}

function formatCategory(cat, showQuantity) {
  const label = categoryLabel(cat.name);
  return showQuantity && cat.quantity ? `${label} (${cat.quantity})` : label;
}

function ticketPayments(ticket) {
  const split = [
    ['Cash', ticket.cashAmount],
    ['UPI', ticket.upiAmount],
    ['Card', ticket.cardAmount],
  ].filter(([, amount]) => Number(amount) > 0);

  return split.length > 1 ? split : [[ticket.paymentMode, ticket.total]];
}

function CategoryThread({ ticket }) {
  const categories = ticketCategories(ticket);
  const payments   = ticketPayments(ticket);
  const modeStr    = payments.length === 1
    ? payments[0][0]
    : payments.map(([m, a]) => `${m} ${money(a)}`).join(' / ');

  if (categories.length === 1) {
    const cat  = categories[0];
    const name = categoryLabel(cat.name || ticket.ageCategory);
    const qty  = cat.quantity != null ? cat.quantity : ticket.quantity;
    return (
      <span style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', fontSize: 12 }}>
        {name} × {qty} {money(ticket.total)}{' '}
        <span style={{ color: 'var(--ink-4)' }}>{modeStr}</span>
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {categories.map((cat, i) => {
        const name = categoryLabel(cat.name || ticket.ageCategory);
        const qty  = cat.quantity != null ? cat.quantity : ticket.quantity;
        return (
          <span key={`${cat.name}-${i}`} style={{ color: 'var(--ink-3)', whiteSpace: 'nowrap', fontSize: 12 }}>
            {name} × {qty}
          </span>
        );
      })}
      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
        {money(ticket.total)} · {modeStr}
      </span>
    </div>
  );
}

function PaymentThread({ ticket }) {
  const payments = ticketPayments(ticket);
  const showAmount = payments.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {payments.map(([mode, amount]) => (
        <PayBadge key={mode} mode={mode} amount={showAmount ? amount : 0}/>
      ))}
    </div>
  );
}

function exportCSV(tickets) {
  const headers = ['Date','Ticket ID','Park','Category','Qty','GST','Total (incl. taxes)','Payment','Status','Cashier'];
  const rows = tickets.map(t => [
    new Date(t.createdAt).toLocaleString('en-IN'),
    t.ticketId,
    t.park,
    ticketCategories(t).map(c => formatCategory(c, ticketCategories(t).length > 1)).join(' / '),
    t.quantity,
    (t.cgstAmount + t.sgstAmount).toFixed(2),
    t.total.toFixed(2),
    ticketPayments(t).map(([mode, amount], _, payments) => payments.length > 1 ? `${mode} ${Number(amount).toFixed(2)}` : mode).join(' / '),
    t.status,
    t.cashier,
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Filter bar ───────────────────────────────────────────────
function FiltersBar({ filters, setFilters, parks, onSearch }) {
  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const isRolling = ['Last 3 Months','Last 6 Months','Last 12 Months'].includes(filters.range);
  const isCustom  = filters.range === 'Custom Range';

  const onRangeChange = (range) => {
    const { date, dateEnd } = computeDefaultDates(range);
    setFilters(f => ({ ...f, range, date, dateEnd }));
  };

  const dateLabel = { Daily: 'Select Day', Weekly: 'Select Week', Monthly: 'Select Month', Quarterly: 'Select Quarter', Yearly: 'Select Year' }[filters.range] || 'Period';

  return (
    <div className="filterbar" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
      <div className="filter-field" style={{ flex: 1, minWidth: 0 }}>
        <label className="filter-label">Search</label>
        <input className="filter-input" placeholder="Ticket ID (e.g. TK-ABC123)"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSearch()}/>
      </div>

      <div className="filter-field" style={{ minWidth: 0 }}>
        <label className="filter-label">Park</label>
        <select className="filter-select" value={filters.park} onChange={e => set('park', e.target.value)}>
          <option value="">All Parks</option>
          {parks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="filter-field" style={{ minWidth: 0 }}>
        <label className="filter-label">Category</label>
        <select className="filter-select" value={filters.age} onChange={e => set('age', e.target.value)}>
          {AGE_CATS.map(v => <option key={v} value={v}>{v || 'All Categories'}</option>)}
        </select>
      </div>

      <div className="filter-field" style={{ minWidth: 0 }}>
        <label className="filter-label">Payment</label>
        <select className="filter-select" value={filters.payment} onChange={e => set('payment', e.target.value)}>
          {PAY_MODES.map(v => <option key={v} value={v}>{v || 'All Modes'}</option>)}
        </select>
      </div>

      <div className="filter-field" style={{ minWidth: 0 }}>
        <label className="filter-label">Status</label>
        <select className="filter-select" value={filters.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(v => <option key={v} value={v}>{v || 'All Statuses'}</option>)}
        </select>
      </div>

      <div className="filter-field" style={{ minWidth: 0 }}>
        <label className="filter-label">Date Range</label>
        <select className="filter-select" value={filters.range} onChange={e => onRangeChange(e.target.value)}>
          {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isRolling ? (
        <div className="filter-field" style={{ minWidth: 0 }}>
          <label className="filter-label">Period</label>
          <div className="picker-readonly">{fmtRolling(filters.date, filters.dateEnd)}</div>
        </div>
      ) : isCustom ? (
        <div className="filter-field" style={{ minWidth: 0 }}>
          <label className="filter-label">From – To</label>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <DatePicker value={filters.date} onChange={d => setFilters(f => ({ ...f, date: d }))}/>
            <span style={{ color: 'var(--ink-4)', fontSize: 11 }}>–</span>
            <DatePicker value={filters.dateEnd} onChange={d => setFilters(f => ({ ...f, dateEnd: d }))}/>
          </div>
        </div>
      ) : (
        <div className="filter-field" style={{ minWidth: 0 }}>
          <label className="filter-label">{dateLabel}</label>
          {filters.range === 'Daily'     && <DatePicker    value={filters.date} onChange={d => setFilters(f => ({ ...f, date: d, dateEnd: d }))}/>}
          {filters.range === 'Weekly'    && <WeekPicker    value={filters.date} valueEnd={filters.dateEnd} onChange={(d, de) => setFilters(f => ({ ...f, date: d, dateEnd: de }))}/>}
          {filters.range === 'Monthly'   && <MonthPicker   value={filters.date} onChange={(d, de) => setFilters(f => ({ ...f, date: d, dateEnd: de }))}/>}
          {filters.range === 'Quarterly' && <QuarterPicker value={filters.date} onChange={(d, de) => setFilters(f => ({ ...f, date: d, dateEnd: de }))}/>}
          {filters.range === 'Yearly'    && <YearPicker    value={filters.date} onChange={(d, de) => setFilters(f => ({ ...f, date: d, dateEnd: de }))}/>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', paddingBottom: 1 }}>
        <button className="btn btn-primary btn-sm" onClick={onSearch}>
          <Icon name="filter" size={12}/> Apply
        </button>
        <button className="btn btn-sm" onClick={() => {
          const { date, dateEnd } = computeDefaultDates('Monthly');
          setFilters({ search: '', park: '', age: '', payment: '', status: '', range: 'Monthly', date, dateEnd });
        }}>Reset</button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function TicketsClient({ initialData, parks }) {
  const initDates = computeDefaultDates('Monthly');
  const [data,    setData]    = useState(initialData);
  const [filters, setFilters] = useState({ search: '', park: '', age: '', payment: '', status: '', range: 'Monthly', date: initDates.date, dateEnd: initDates.dateEnd });
  const [sort,    setSort]    = useState({ col: 'created_at', dir: 'desc' });
  const [page,    setPage]    = useState(1);
  const [limit,   setLimit]   = useState(50);
  const [detail,  setDetail]  = useState(null);
  const [pending, startTransition] = useTransition();

  const fetchData = useCallback(async (overrides = {}) => {
    const params = {
      page:     overrides.page    ?? page,
      limit:    overrides.limit   ?? limit,
      sort:     overrides.sort    ?? sort.col,
      dir:      overrides.dir     ?? sort.dir,
      search:   filters.search,
      park:     filters.park,
      age:      filters.age,
      payment:  filters.payment,
      status:   filters.status,
      dateFrom: filters.date,
      dateTo:   filters.dateEnd,
      ...overrides,
    };
    Object.keys(params).forEach(k => { if (params[k] === '') delete params[k]; });
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const qs   = new URLSearchParams(params).toString();
    const res  = await fetch(`${BASE}/api/tickets?${qs}`, { cache: 'no-store' });
    const json = await res.json();
    setData(json);
  }, [page, limit, sort, filters]);

  const handleSearch = () => { startTransition(() => { setPage(1); fetchData({ page: 1 }); }); };
  const handleSort   = (col) => {
    const dir = col === sort.col && sort.dir === 'desc' ? 'asc' : 'desc';
    setSort({ col, dir });
    startTransition(() => fetchData({ sort: col, dir }));
  };
  const handlePage  = (p)   => { setPage(p); startTransition(() => fetchData({ page: p })); };
  const handleLimit = (lim) => { setLimit(lim); setPage(1); startTransition(() => fetchData({ limit: lim, page: 1 })); };

  const tickets    = data?.tickets    || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
  const summary    = data?.summary    || { count: 0, revenue: 0 };

  const totalPages = pagination.totalPages || 1;
  const curPage    = pagination.page       || 1;
  const pageNums   = [];
  for (let p = Math.max(1, curPage - 2); p <= Math.min(totalPages, curPage + 2); p++) pageNums.push(p);

  return (
    <>
      <div className="filter-sticky">
        <FiltersBar filters={filters} setFilters={setFilters} parks={parks} onSearch={handleSearch}/>

        {/* Summary + export bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          <div className="summary-bar" style={{ flex: 1, borderRadius: 8 }}>
            <span>Showing <strong>{num(tickets.length)}</strong> of <strong>{num(summary.count)}</strong> matching tickets</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>Total Revenue: <strong style={{ color: 'var(--teal)' }}>₹{summary.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            {pending && <span style={{ color: 'var(--ink-5)', marginLeft: 'auto', fontSize: 11 }}>Loading…</span>}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>Per page:</span>
            {PAGE_SIZES.map(s => (
              <button key={s} className={'btn btn-sm' + (limit === s ? ' btn-primary' : '')} onClick={() => handleLimit(s)}>{s}</button>
            ))}
            <button className="btn btn-sm" onClick={() => exportCSV(tickets)} title="Export current page as CSV">
              <Icon name="download" size={12}/> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="sec" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', opacity: pending ? 0.55 : 1, transition: 'opacity .2s' }}>
          <table className="data-table" style={{ minWidth: 960 }}>
            <thead>
              <tr>
                <SortTh col="created_at"   label="Date & Time" sort={sort} onSort={handleSort}/>
                <SortTh col="ticket_id"    label="Ticket ID" sort={sort} onSort={handleSort}/>
                <SortTh col="park_name"    label="Park" sort={sort} onSort={handleSort}/>
                <SortTh col="age_category" label="Category" sort={sort} onSort={handleSort}/>
                <th>Qty</th>
                <th>GST</th>
                <SortTh col="total_amount" label="Total (incl. taxes)" sort={sort} onSort={handleSort}/>
                <th>Payment</th>
                <SortTh col="status" label="Status" sort={sort} onSort={handleSort}/>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--ink-5)', padding: '32px 0' }}>
                    No tickets match your filters
                  </td>
                </tr>
              ) : tickets.map(t => (
                <tr key={t.ticketId} style={{ cursor: 'pointer' }} onClick={() => setDetail(t)}>
                  <td style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{fmt(t.createdAt)}</td>
                  <td className="mono" style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 11.5 }}>{t.ticketId}</td>
                  <td style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{t.park}</td>
                  <td><CategoryThread ticket={t}/></td>
                  <td className="mono" style={{ textAlign: 'center' }}>{t.quantity}</td>
                  <td className="mono" style={{ color: 'var(--ink-4)' }}>{money(t.cgstAmount + t.sgstAmount)}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{money(t.total)}</td>
                  <td><PaymentThread ticket={t}/></td>
                  <td><StatusBadge s={t.status}/></td>
                  <td style={{ color: 'var(--ink-4)', fontSize: 11.5 }}>{t.cashier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
            Page <strong style={{ color: 'var(--ink)' }}>{curPage}</strong> of <strong style={{ color: 'var(--ink)' }}>{totalPages}</strong>
          </div>
          <div className="pager">
            <button className="page-btn" disabled={curPage <= 1} onClick={() => handlePage(1)}>«</button>
            <button className="page-btn" disabled={curPage <= 1} onClick={() => handlePage(curPage - 1)}>‹</button>
            {pageNums.map(p => (
              <button key={p} className={'page-btn' + (p === curPage ? ' active' : '')} onClick={() => handlePage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={curPage >= totalPages} onClick={() => handlePage(curPage + 1)}>›</button>
            <button className="page-btn" disabled={curPage >= totalPages} onClick={() => handlePage(totalPages)}>»</button>
          </div>
        </div>
      </div>

      {/* Detail slide-in panel */}
      {detail && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        }} onClick={() => setDetail(null)}>
          <div style={{
            width: 400, maxWidth: '90vw', height: '100vh',
            background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            padding: 28, overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{detail.ticketId}</div>
                <div style={{ color: 'var(--ink-4)', fontSize: 12, marginTop: 3 }}>{fmt(detail.createdAt)}</div>
              </div>
              <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--ink-4)', cursor: 'pointer' }} onClick={() => setDetail(null)}>✕</button>
            </div>
            {[
              ['Park', detail.park],
              ['Category', ticketCategories(detail).map(c => formatCategory(c, ticketCategories(detail).length > 1)).join(', ')],
              ['Quantity', detail.quantity],
              ['GST', money(detail.cgstAmount + detail.sgstAmount)],
              ['Total (incl. taxes)', money(detail.total)],
              ['Payment', ticketPayments(detail).map(([mode, amount], _, payments) => payments.length > 1 ? `${mode} ${money(amount)}` : mode).join(', ')],
              ['Status', detail.status],
              ['Cashier', detail.cashier],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-4)' }}>{label}</span>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{val}</span>
              </div>
            ))}

            {ticketPayments(detail).length > 1 && (
              <div style={{ marginTop: 16, background: 'var(--surface-2)', borderRadius: 6, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Split Breakdown</div>
                {[
                  ['Cash', detail.cashAmount, '#5DCAA5'],
                  ['UPI',  detail.upiAmount,  '#62ADE8'],
                  ['Card', detail.cardAmount, '#A09AF0'],
                ].filter(([,v]) => v > 0).map(([label, val, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 12.5 }}>
                    <span style={{ color }}>{label}</span>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{money(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
