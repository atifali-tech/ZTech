'use client';
import Icon from './Icon';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <span id="confirm-title">{title}</span>
          <button className="btn-ghost icon-btn" onClick={onCancel} aria-label="Cancel">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, color: 'var(--ink-2)', lineHeight: 1.55 }}>{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
