'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function toCSV(columns, rows) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [columns, ...rows].map(r => r.map(esc).join(',')).join('\n');
}

function downloadBlob(filename, content, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + content, ], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function fetchReport(endpoint, params) {
  const qs  = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${endpoint}?${qs}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function fyDates() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${year}-04-01`, to: `${year + 1}-03-31` };
}

export default function ExportMenu({ onExport, appliedFilters = {} }) {
  const [open,    setOpen]    = useState(false);
  const [busy,    setBusy]    = useState(null); // which export is in progress
  const [error,   setError]   = useState(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const dateParams = {
    from: appliedFilters.date    || '',
    to:   appliedFilters.dateEnd || '',
  };

  const run = async (key, fn) => {
    setOpen(false);
    setBusy(key);
    setError(null);
    try {
      await fn();
      onExport?.(key);
    } catch (e) {
      setError(e.message || 'Export failed');
      setTimeout(() => setError(null), 3500);
    } finally {
      setBusy(null);
    }
  };

  const handleCSV = () => run('CSV', async () => {
    const data = await fetchReport('/api/reports/export/analytics', dateParams);
    downloadBlob(
      `dashboard-export-${dateParams.from || 'all'}.csv`,
      toCSV(data.columns, data.rows),
    );
  });

  const handleExcel = () => run('Excel', async () => {
    // Excel opens UTF-8 CSV with BOM natively
    const data = await fetchReport('/api/reports/export/analytics', dateParams);
    downloadBlob(
      `dashboard-export-${dateParams.from || 'all'}.csv`,
      toCSV(data.columns, data.rows),
      'text/csv;charset=utf-8;',
    );
  });

  const handleDSR = () => run('DSR', async () => {
    const data = await fetchReport('/api/reports/export/analytics', dateParams);
    downloadBlob(
      `dsr-${dateParams.from || 'daily'}.csv`,
      toCSV(data.columns, data.rows),
    );
  });

  const handleFYDSR = () => run('FY-DSR', async () => {
    const { from, to } = fyDates();
    const data = await fetchReport('/api/reports/export/finance', { from, to });
    downloadBlob(
      `fy-dsr-${from}-to-${to}.csv`,
      toCSV(data.columns, data.rows),
    );
  });

  return (
    <div ref={wrapRef} className="export-menu-wrap menu-wrap" style={{ position: 'relative' }}>
      <button
        className="btn btn-sm"
        onClick={() => setOpen(o => !o)}
        disabled={!!busy}
        style={{ minWidth: 84 }}
      >
        {busy
          ? <><span style={{ width: 10, height: 10, border: '2px solid var(--ink-4)', borderTopColor: 'var(--teal)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }}/> {busy}…</>
          : <><Icon name="download" size={12}/> Export <Icon name="chevron" size={10} color="var(--ink-4)"/></>
        }
      </button>

      {error && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--red)', color: '#fff', borderRadius: 5,
          padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap', zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,.15)',
        }}>
          {error}
        </div>
      )}

      {open && (
        <div className="menu" style={{ right: 0, left: 'auto', minWidth: 210 }}>
          <button onClick={handleCSV}>
            <Icon name="download" size={13}/> Download as CSV
            <span className="kbd" style={{ marginLeft: 'auto' }}>⌘E</span>
          </button>
          <button onClick={handleExcel}>
            <Icon name="download" size={13}/> Download as Excel
          </button>
          <div className="menu-sep"/>
          <button onClick={handleDSR}>
            <Icon name="file" size={13}/> DSR Report (Daily)
          </button>
          <button onClick={handleFYDSR}>
            <Icon name="file" size={13}/> FY DSR Report
          </button>
        </div>
      )}
    </div>
  );
}
