'use client';
import { useState } from 'react';
import Icon         from './Icon';
import ConfirmModal from './ConfirmModal';
import { inr }      from '../lib/format';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include', ...opts });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusTag({ status }) {
  const MAP = {
    pending:   { cls: 'amber',  label: 'Pending' },
    approved:  { cls: 'teal',   label: 'Approved' },
    rejected:  { cls: 'red',    label: 'Rejected' },
    processed: { cls: '',       label: 'Processed' },
  };
  const { cls, label } = MAP[status] || { cls: '', label: status };
  return <span className={`tag ${cls}`}>{label}</span>;
}

function TimelineStep({ done, error, icon, label, meta }) {
  return (
    <div className="timeline-step">
      <div className={`timeline-dot ${done ? 'done' : error ? 'error' : 'wait'}`}>
        <Icon name={icon} size={13} color={done ? 'var(--teal)' : error ? 'var(--red)' : 'var(--ink-4)'}/>
      </div>
      <div className="timeline-content">
        <div className="timeline-label">{label}</div>
        {meta && <div className="timeline-meta">{meta}</div>}
      </div>
    </div>
  );
}

export default function RefundDetailDrawer({ refund, canApprove, onClose, onRefresh }) {
  const [confirm, setConfirm] = useState(null); // null | 'approve' | 'reject' | 'process'
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAction = async (action, reason) => {
    setActionLoading(true);
    setError(null);
    try {
      const pathMap = {
        approve: { method: 'PUT',  path: `/api/refunds/${refund.id}/approve`,  body: {} },
        reject:  { method: 'PUT',  path: `/api/refunds/${refund.id}/reject`,   body: { reason } },
        process: { method: 'POST', path: `/api/refunds/${refund.id}/process`,  body: {} },
      };
      const { method, path, body } = pathMap[action];
      await apiFetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setConfirm(null);
      onRefresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isImmutable = ['processed', 'rejected'].includes(refund.status);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose}/>
      <div className="drawer" role="dialog" aria-label="Refund Details">

        {/* Header */}
        <div className="drawer-head">
          <Icon name="money" size={18} color="var(--teal)"/>
          <div className="drawer-title">Refund #{refund.id}</div>
          <StatusTag status={refund.status}/>
          {refund.ticket_id && (
            <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 4 }}>
              · Ticket #{refund.ticket_id}
            </span>
          )}
          <button className="btn btn-sm icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title="Close">
            <Icon name="xCircle" size={14}/>
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          {error && (
            <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 5, padding: '10px 12px', fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="warning" size={13} color="var(--red)"/>
              {error}
            </div>
          )}

          {/* Amounts */}
          <div className="fin-kpi-grid">
            <div className="fin-kpi">
              <div className="fin-kpi-label">Refund Amount</div>
              <div className="fin-kpi-val">{inr(refund.amount || 0)}</div>
            </div>
            <div className="fin-kpi">
              <div className="fin-kpi-label">Park</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{refund.park_name || '—'}</div>
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="drawer-section">Details</div>
            <div className="drawer-row"><span className="drawer-label">Reason</span><span className="drawer-val" style={{ textAlign: 'right', maxWidth: '60%', whiteSpace: 'normal' }}>{refund.reason || '—'}</span></div>
            <div className="drawer-row"><span className="drawer-label">Requested by</span><span className="drawer-val mono" style={{ fontSize: 12 }}>{refund.requested_by_email || '—'}</span></div>
            <div className="drawer-row"><span className="drawer-label">Requested at</span><span className="drawer-val">{fmt(refund.requested_at)}</span></div>
            {refund.approved_at && (
              <div className="drawer-row"><span className="drawer-label">Approved at</span><span className="drawer-val">{fmt(refund.approved_at)}</span></div>
            )}
            {refund.processed_at && (
              <div className="drawer-row"><span className="drawer-label">Processed at</span><span className="drawer-val">{fmt(refund.processed_at)}</span></div>
            )}
            {refund.rejection_reason && (
              <div className="drawer-row">
                <span className="drawer-label">Rejection</span>
                <span className="drawer-val" style={{ textAlign: 'right', maxWidth: '60%', whiteSpace: 'normal', color: 'var(--red)' }}>{refund.rejection_reason}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <div className="drawer-section">Status Timeline</div>
            <div className="timeline">
              <TimelineStep
                done icon="send"
                label="Request submitted"
                meta={`${refund.requested_by_email || '—'} · ${fmt(refund.requested_at)}`}
              />
              <TimelineStep
                done={['approved','rejected','processed'].includes(refund.status)}
                error={refund.status === 'rejected'}
                icon={refund.status === 'rejected' ? 'xCircle' : 'checkCircle'}
                label={refund.status === 'rejected' ? 'Request rejected' : 'Request approved'}
                meta={refund.approved_at ? fmt(refund.approved_at) : 'Pending approval'}
              />
              <TimelineStep
                done={refund.status === 'processed'}
                icon="money"
                label="Refund processed"
                meta={refund.processed_at ? fmt(refund.processed_at) : refund.status === 'approved' ? 'Ready to process' : 'Not yet processed'}
              />
            </div>
          </div>

          {isImmutable && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 12px', fontSize: 12, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="lock" size={12}/>
              This refund is {refund.status} and cannot be modified.
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isImmutable && (
          <div className="drawer-foot">
            {refund.status === 'pending' && canApprove && (
              <>
                <button className="btn btn-danger btn-sm" onClick={() => setConfirm('reject')}>
                  <Icon name="xCircle" size={12} color="#fff"/> Reject
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setConfirm('approve')}>
                  <Icon name="checkCircle" size={12} color="#fff"/> Approve
                </button>
              </>
            )}
            {refund.status === 'approved' && (
              <button className="btn btn-primary btn-sm" onClick={() => setConfirm('process')}>
                <Icon name="send" size={12} color="#fff"/> Process Refund
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation modals */}
      {confirm === 'approve' && (
        <ConfirmModal
          title="Approve Refund"
          message={`Approve refund of ${inr(refund.amount)} for ticket #${refund.ticket_id}?`}
          confirmLabel="Approve"
          confirmVariant="primary"
          loading={actionLoading}
          onConfirm={() => handleAction('approve')}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'reject' && (
        <ConfirmModal
          title="Reject Refund"
          message="Provide a reason for rejecting this refund request."
          confirmLabel="Reject"
          confirmVariant="danger"
          requireReason
          reasonLabel="Rejection reason"
          loading={actionLoading}
          onConfirm={(reason) => handleAction('reject', reason)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'process' && (
        <ConfirmModal
          title="Process Refund"
          message={`This will cancel ticket #${refund.ticket_id} and create a reversal record for ${inr(refund.amount)}. This action cannot be undone.`}
          confirmLabel="Process Refund"
          confirmVariant="danger"
          loading={actionLoading}
          onConfirm={() => handleAction('process')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
