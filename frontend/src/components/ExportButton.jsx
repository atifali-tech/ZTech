'use client';
import { useState } from 'react';
import Icon from './Icon';
import { downloadCSV } from '../lib/format';

/**
 * ExportButton — calls onExport(), receives {columns, rows}, triggers CSV download.
 * Shows loading state during fetch. Surfaces errors inline.
 */
export default function ExportButton({ label = 'Export CSV', onExport, filename = 'export.csv', disabled = false }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onExport();
      if (result?.rows?.length && result?.columns?.length) {
        downloadCSV(filename, result.columns, result.rows);
        if (result.truncated) {
          setError(`Showing first ${result.count.toLocaleString()} rows — export is partial.`);
        }
      } else {
        setError('No data found for the selected filters.');
      }
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
      <button
        className="btn btn-sm"
        onClick={handleClick}
        disabled={loading || disabled}
        style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        <Icon name={loading ? 'refresh' : 'download'} size={12}/>
        {loading ? 'Exporting…' : label}
      </button>
      {error && (
        <span style={{ fontSize: 10.5, color: 'var(--red)', maxWidth: 220, lineHeight: 1.4 }}>
          {error}
        </span>
      )}
    </div>
  );
}
