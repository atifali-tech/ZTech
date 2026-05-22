'use client';
import { useEffect } from 'react';

export default function Toast({ message, type = 'ok', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3200);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;
  const cls = type === 'error' ? 'error' : type === 'warn' ? 'warning' : type === 'ok' ? 'success' : '';
  return (
    <div className={`toast-fixed ${cls}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
