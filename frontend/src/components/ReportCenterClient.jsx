'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar      from './Sidebar';
import Topbar       from './Topbar';
import Icon         from './Icon';
import ExportButton from './ExportButton';
import { useAuth }  from '../lib/auth-context';
import { api }      from '../lib/api';

// ── Stateless helpers (no hooks — inline per Turbopack Rule 1) ────────────────

const TYPE_LABELS = {
  'report.export.analytics':        'Analytics Summary',
  'report.export.finance':          'Finance Summary',
  'report.export.refunds':          'Refund Report',
  'report.export.settlements':      'Settlement Report',
  'report.export.park-performance': 'Park Performance',
  'report.export.reconciliation':   'Reconciliation',
};

const TYPE_COLORS = {
  'report.export.analytics':        'teal',
  'report.export.finance':          'green',
  'report.export.refunds':          'red',
  'report.export.settlements':      'amber',
  'report.export.park-performance': 'indigo',
  'report.export.reconciliation':   'amber',
};

function HistoryBadge({ action }) {
  const label = TYPE_LABELS[action] || action.replace('report.export.', '');
  const cls   = TYPE_COLORS[action] || '';
  return <span className={`tag ${cls}`}>{label}</span>;
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function HistoryTable({ rows, loading }) {
  if (loading) return <div style={{ padding: '24px 16px', color: 'var(--ink-4)', fontSize: 12 }}>Loading history…</div>;
  if (!rows?.length) return (
    <div style={{ padding: '36px 16px', textAlign: 'center' }}>
      <Icon name="file" size={28} color="var(--ink-5)"/>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-4)' }}>No exports yet.</div>
    </div>
  );
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Report Type</th>
          <th>Actor</th>
          <th>Filters</th>
          <th>Rows</th>
          <th>Generated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const meta = r.meta || {};
          return (
            <tr key={r.id}>
              <td><HistoryBadge action={r.action}/></td>
              <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.actor_email || '—'}</td>
              <td style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                {meta.from && meta.to ? `${meta.from} – ${meta.to}` : meta.from || meta.to || 'No filter'}
              </td>
              <td className="mono" style={{ fontSize: 12 }}>
                {meta.row_count ?? '—'}
                {meta.truncated && <span className="tag amber" style={{ marginLeft: 4, fontSize: 9 }}>partial</span>}
              </td>
              <td style={{ fontSize: 11.5, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ReportCard({ title, description, icon, children }) {
  return (
    <div className="sec" style={{ height: '100%' }}>
      <div className="sec-head">
        <Icon name={icon} size={14} color="var(--ink-4)"/>
        <div className="sec-title" style={{ marginLeft: 4 }}>{title}</div>
      </div>
      <div className="sec-body" style={{ padding: '10px 16px 14px' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', marginBottom: 12, lineHeight: 1.5 }}>{description}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function ExportRow({ label, onExport, filename, disabled, noAccess }) {
  if (noAccess) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5 }}>
        <Icon name="lock" size={12} color="var(--ink-5)"/>
        <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{label}</span>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ExportButton label={label} onExport={onExport} filename={filename} disabled={disabled}/>
    </div>
  );
}

// ── Main component (has useState + useEffect + useRef → own file) ─────────────

export default function ReportCenterClient() {
  const { can } = useAuth();

  const today    = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [from,     setFrom]    = useState(monthAgo);
  const [to,       setTo]      = useState(today);
  const [history,  setHistory] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage,  setHistPage]  = useState(1);
  const [histLoading, setHistLoading] = useState(true);

  const filters = () => ({ from, to });

  const histRef = useRef(null);
  histRef.current = async (pg = histPage) => {
    setHistLoading(true);
    try {
      const r = await api.reportHistory({ page: pg, limit: 20 });
      setHistory(r.data || []);
      setHistTotal(r.total || 0);
      setHistPage(pg);
    } catch (_) {
      setHistory([]);
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => { histRef.current(1); }, []);

  // Refresh history after an export completes
  const onExportDone = async (exportFn) => {
    const result = await exportFn();
    // Small delay so audit_log write completes before history refresh
    setTimeout(() => histRef.current(1), 400);
    return result;
  };

  const histPages = Math.ceil(histTotal / 20);

  if (!can('reports.view') && !histLoading) {
    return (
      <div className="app">
        <Sidebar active="reports"/>
        <div className="main">
          <Topbar current="Reports & Exports" icon="download"/>
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
      <Sidebar active="reports"/>
      <div className="main">
        <Topbar current="Reports & Exports" icon="download"/>
        <div className="canvas">

          {/* Date filter */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Report Filters</div>
              <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Applied to all exports below</span>
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
                <div style={{ alignSelf: 'flex-end', fontSize: 11.5, color: 'var(--ink-4)', paddingBottom: 6 }}>
                  Exports are scoped to your authorized parks.
                </div>
              </div>
            </div>
          </div>

          {/* ── Executive Reports ─────────────────────────────── */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', padding: '4px 2px 8px' }}>
              Executive Reports
            </div>
            <div className="grid-12">
              <div className="col-6">
                <ReportCard
                  title="Analytics Summary"
                  icon="chart"
                  description="Daily ticket counts, visitor demographics (adults/children/seniors), revenue, and payment method breakdown per park."
                >
                  <ExportRow
                    label="Export Analytics CSV"
                    filename={`analytics-${from}-${to}.csv`}
                    noAccess={!can('analytics.export')}
                    onExport={() => onExportDone(() => api.exportAnalytics(filters()))}
                  />
                </ReportCard>
              </div>
              <div className="col-6">
                <ReportCard
                  title="Park Performance"
                  icon="map"
                  description="Aggregated revenue, ticket counts, and payment split per park for the selected period. Ranked by gross revenue."
                >
                  <ExportRow
                    label="Export Park Performance CSV"
                    filename={`park-performance-${from}-${to}.csv`}
                    noAccess={!can('reports.view')}
                    onExport={() => onExportDone(() => api.exportParkPerformance(filters()))}
                  />
                </ReportCard>
              </div>
            </div>
          </div>

          {/* ── Finance Reports ────────────────────────────────── */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-4)', padding: '4px 2px 8px' }}>
              Finance Reports
            </div>
            <div className="grid-12">
              <div className="col-6">
                <ReportCard
                  title="Finance Summary"
                  icon="money"
                  description="Daily gross revenue, refunded amounts, and GST (CGST + SGST) breakdown with payment mode split per park."
                >
                  <ExportRow
                    label="Export Finance Summary CSV"
                    filename={`finance-${from}-${to}.csv`}
                    noAccess={!can('finance.view')}
                    onExport={() => onExportDone(() => api.exportFinance(filters()))}
                  />
                </ReportCard>
              </div>
              <div className="col-6">
                <ReportCard
                  title="Refund Report"
                  icon="arrowDown"
                  description="All refund transactions (reversal tickets) including refund amount, GST reversed, and payment mode."
                >
                  <ExportRow
                    label="Export Refunds CSV"
                    filename={`refunds-${from}-${to}.csv`}
                    noAccess={!can('finance.view')}
                    onExport={() => onExportDone(() => api.exportRefunds(filters()))}
                  />
                </ReportCard>
              </div>
            </div>
            <div className="grid-12" style={{ marginTop: 16 }}>
              <div className="col-6">
                <ReportCard
                  title="Settlement Report"
                  icon="lock"
                  description="Settlement period records with expected vs. actual revenue, variance, approval status, and lock state per park."
                >
                  <ExportRow
                    label="Export Settlements CSV"
                    filename={`settlements-${from}-${to}.csv`}
                    noAccess={!can('finance.view')}
                    onExport={() => onExportDone(() => api.exportSettlements(filters()))}
                  />
                </ReportCard>
              </div>
              <div className="col-6">
                <ReportCard
                  title="Reconciliation Exceptions"
                  icon="warning"
                  description="Open and resolved reconciliation exceptions with severity, variance, and type per settlement period."
                >
                  <ExportRow
                    label="Export Reconciliation CSV"
                    filename={`reconciliation-${from}-${to}.csv`}
                    noAccess={!can('finance.reconcile')}
                    onExport={() => onExportDone(() => api.exportReconciliation(filters()))}
                  />
                </ReportCard>
              </div>
            </div>
          </div>

          {/* ── Export History ─────────────────────────────────── */}
          <div className="sec">
            <div className="sec-head">
              <div className="sec-title">Export History</div>
              <span className="tag">{histTotal} total</span>
              <div className="sec-actions">
                <button className="btn btn-sm icon-btn" onClick={() => histRef.current(1)} title="Refresh">
                  <Icon name="refresh" size={13}/>
                </button>
              </div>
            </div>
            <div className="sec-body" style={{ padding: 0 }}>
              <HistoryTable rows={history} loading={histLoading}/>

              {histPages > 1 && (
                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--border)' }}>
                  <div className="pager">
                    <button className="page-btn" disabled={histPage <= 1} onClick={() => histRef.current(histPage - 1)}>‹</button>
                    {Array.from({ length: Math.min(histPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return <button key={p} className={`page-btn${histPage === p ? ' active' : ''}`} onClick={() => histRef.current(p)}>{p}</button>;
                    })}
                    <button className="page-btn" disabled={histPage >= histPages} onClick={() => histRef.current(histPage + 1)}>›</button>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-4)' }}>
                    {histTotal} entries · page {histPage}/{histPages}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
