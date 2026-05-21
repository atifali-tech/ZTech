'use client';
import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';

export default function ConfirmModal({
  title,
  message,
  confirmLabel   = 'Confirm',
  confirmVariant = 'danger',   // 'danger' | 'primary' | 'warning'
  requireReason  = false,
  reasonLabel    = 'Reason',
  reasonPlaceholder = 'Enter reason…',
  loading        = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('');
  const cancelRef = useRef(null);
  const disabled  = loading || (requireReason && !reason.trim());
  const btnClass  = `btn btn-${confirmVariant}`;

  // Escape key closes the modal
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape' && !loading) onCancel(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [loading, onCancel]);

  // Auto-focus the cancel button (safe default for destructive actions)
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-msg"
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: confirmVariant === 'danger' ? 'var(--red-50)' : confirmVariant === 'warning' ? '#FCF5E4' : 'var(--teal-50)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon
              name={confirmVariant === 'danger' ? 'xCircle' : confirmVariant === 'warning' ? 'warning' : 'checkCircle'}
              size={18}
              color={confirmVariant === 'danger' ? 'var(--red)' : confirmVariant === 'warning' ? 'var(--amber)' : 'var(--teal)'}
            />
          </div>
          <div>
            <div id="confirm-modal-title" className="modal-title">{title}</div>
            <div id="confirm-modal-msg"   className="modal-msg">{message}</div>
          </div>
        </div>

        {requireReason && (
          <div style={{ marginTop: 4 }}>
            <label
              htmlFor="confirm-reason"
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}
            >
              {reasonLabel}
            </label>
            <textarea
              id="confirm-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', border: '1.5px solid var(--border-strong)', borderRadius: 5,
                fontSize: 13, color: 'var(--ink)', resize: 'vertical', fontFamily: 'inherit',
                background: 'var(--surface)', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--teal)'; }}
              onBlur={e  => { e.target.style.borderColor = 'var(--border-strong)'; }}
            />
          </div>
        )}

        <div className="modal-actions">
          <button
            ref={cancelRef}
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            className={btnClass}
            disabled={disabled}
            aria-label={confirmLabel}
            onClick={() => onConfirm(requireReason ? reason : undefined)}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
