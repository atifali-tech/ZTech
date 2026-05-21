'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');
const { notify, notifyByPermission, logWorkflowEvent } = require('../lib/notifier');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRefund(pool, id) {
  const { rows } = await pool.query(
    `SELECT r.*, t.park_id, t.amount AS ticket_amount, t.status AS ticket_status
       FROM refund_requests r
       JOIN tickets t ON t.id = r.ticket_id
      WHERE r.id = $1`,
    [id],
  );
  return rows[0] || null;
}

// ── POST / — create refund request ───────────────────────────────────────────

router.post('/', ...requirePermission('finance.refund'), parkScope, async (req, res) => {
  const pool     = req.app.locals.pool;
  const { ticket_id, reason } = req.body;

  if (!ticket_id || !reason) {
    return res.status(400).json({ error: 'ticket_id and reason are required' });
  }

  const { rows: [ticket] } = await pool.query(
    'SELECT id, park_id, total_amount, status, is_reversal FROM tickets WHERE id = $1',
    [ticket_id],
  );
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'Cancelled') return res.status(409).json({ error: 'Ticket is already cancelled' });
  if (ticket.is_reversal) return res.status(409).json({ error: 'Cannot refund a reversal ticket' });

  // Park scope enforcement — Finance Heads are restricted to their parks
  if (req.scopedParkIds !== null && !req.scopedParkIds.includes(ticket.park_id)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }

  // Check for existing pending/approved refund on same ticket
  const { rows: existing } = await pool.query(
    `SELECT id FROM refund_requests WHERE ticket_id = $1 AND status IN ('pending','approved')`,
    [ticket_id],
  );
  if (existing.length) {
    return res.status(409).json({ error: 'A pending or approved refund already exists for this ticket' });
  }

  const { rows: [refund] } = await pool.query(
    `INSERT INTO refund_requests (ticket_id, requested_by, amount, reason)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ticket_id, req.user.id, ticket.total_amount, reason],
  );

  await logAudit(pool, req.user, 'refund.request', 'refund_request', refund.id, {
    ticket_id, amount: ticket.total_amount, reason,
  });

  // Workflow event + notify approvers (best-effort — never blocks the response)
  logWorkflowEvent(pool, {
    eventType: 'refund.requested', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'refund_request', entityId: refund.id,
    parkId: ticket.park_id,
    meta: { ticket_id, amount: ticket.total_amount, reason },
  }).catch(e => console.error('[notifier] refund.requested:', e.message));

  notifyByPermission(pool, {
    permission: 'finance.approve',
    type: 'refund.requested',
    title: `Refund Requested — ₹${Number(ticket.total_amount).toLocaleString('en-IN')}`,
    body: reason,
    meta: { refund_id: refund.id, ticket_id, amount: ticket.total_amount },
    parkId: ticket.park_id,
  }).catch(e => console.error('[notifier] notify refund.requested:', e.message));

  res.status(201).json(refund);
});

// ── GET / — list refund requests ──────────────────────────────────────────────

router.get('/', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const status = req.query.status;
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params     = [];

  if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

  if (req.scopedParkIds !== null) {
    params.push(req.scopedParkIds);
    conditions.push(`t.park_id = ANY($${params.length})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT r.id, r.ticket_id, r.amount, r.reason, r.status,
            r.requested_at, r.approved_at, r.processed_at,
            r.rejection_reason,
            u.email AS requested_by_email,
            t.park_id,
            p.name AS park_name
       FROM refund_requests r
       JOIN tickets t ON t.id = r.ticket_id
       JOIN parks   p ON p.id = t.park_id
       JOIN users   u ON u.id = r.requested_by
      WHERE ${where}
      ORDER BY r.requested_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: [{ total }] } = await pool.query(
    `SELECT COUNT(*) AS total
       FROM refund_requests r
       JOIN tickets t ON t.id = r.ticket_id
      WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2),
  );

  res.json({ data: rows, total: parseInt(total, 10), page, limit });
});

// ── PUT /:id/approve ──────────────────────────────────────────────────────────

router.put('/:id/approve', ...requirePermission('finance.approve'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const refund = await getRefund(pool, req.params.id);
  if (!refund) return res.status(404).json({ error: 'Refund request not found' });
  if (refund.status !== 'pending') return res.status(409).json({ error: `Cannot approve a refund in '${refund.status}' status` });
  if (refund.requested_by === req.user.id) return res.status(403).json({ error: 'Cannot approve your own refund request' });

  const { rows: [updated] } = await pool.query(
    `UPDATE refund_requests
        SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE id = $2 RETURNING *`,
    [req.user.id, refund.id],
  );

  await logAudit(pool, req.user, 'refund.approve', 'refund_request', refund.id, {
    ticket_id: refund.ticket_id, amount: refund.amount,
  });

  logWorkflowEvent(pool, {
    eventType: 'refund.approved', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'refund_request', entityId: refund.id,
    parkId: refund.park_id,
    meta: { ticket_id: refund.ticket_id, amount: refund.amount },
  }).catch(e => console.error('[notifier] refund.approved:', e.message));

  notify(pool, {
    userId: refund.requested_by,
    type: 'refund.approved',
    title: `Refund Approved — ₹${Number(refund.amount).toLocaleString('en-IN')}`,
    meta: { refund_id: refund.id, ticket_id: refund.ticket_id, amount: refund.amount },
    parkId: refund.park_id,
  }).catch(e => console.error('[notifier] notify refund.approved:', e.message));

  res.json(updated);
});

// ── PUT /:id/reject ───────────────────────────────────────────────────────────

router.put('/:id/reject', ...requirePermission('finance.approve'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const refund = await getRefund(pool, req.params.id);
  if (!refund) return res.status(404).json({ error: 'Refund request not found' });
  if (refund.status !== 'pending') return res.status(409).json({ error: `Cannot reject a refund in '${refund.status}' status` });

  const reason = req.body?.reason || '';
  const { rows: [updated] } = await pool.query(
    `UPDATE refund_requests
        SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3 RETURNING *`,
    [reason, req.user.id, refund.id],
  );

  await logAudit(pool, req.user, 'refund.reject', 'refund_request', refund.id, {
    ticket_id: refund.ticket_id, reason,
  });

  logWorkflowEvent(pool, {
    eventType: 'refund.rejected', actorId: req.user.id, actorEmail: req.user.email,
    entityType: 'refund_request', entityId: refund.id,
    parkId: refund.park_id,
    meta: { ticket_id: refund.ticket_id, reason },
  }).catch(e => console.error('[notifier] refund.rejected:', e.message));

  notify(pool, {
    userId: refund.requested_by,
    type: 'refund.rejected',
    title: 'Refund Rejected',
    body: reason || null,
    meta: { refund_id: refund.id, ticket_id: refund.ticket_id },
    parkId: refund.park_id,
  }).catch(e => console.error('[notifier] notify refund.rejected:', e.message));

  res.json(updated);
});

// ── POST /:id/process — create reversal ticket and mark processed ─────────────

router.post('/:id/process', ...requirePermission('finance.refund'), async (req, res) => {
  const pool   = req.app.locals.pool;
  const refund = await getRefund(pool, req.params.id);
  if (!refund) return res.status(404).json({ error: 'Refund request not found' });
  if (refund.status !== 'approved') return res.status(409).json({ error: 'Refund must be approved before processing' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch original ticket for field copying
    const { rows: [orig] } = await client.query(
      'SELECT * FROM tickets WHERE id = $1',
      [refund.ticket_id],
    );

    // Insert reversal ticket (negative amounts)
    const { rows: [reversal] } = await client.query(
      `INSERT INTO tickets
         (park_id, visitor_name, visitor_email, visitor_phone,
          ticket_type, num_adults, num_children, visit_date,
          amount, cgst_amount, sgst_amount, total_amount,
          payment_mode, cash_amount, upi_amount, card_amount,
          status, source, created_by,
          is_reversal, reversal_of,
          gst_rate_id, tax_invoice_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
               $9,$10,$11,$12,$13,$14,$15,$16,
               'Cancelled','System',$17,
               TRUE,$18,$19,$20)
       RETURNING id`,
      [
        orig.park_id, orig.visitor_name, orig.visitor_email, orig.visitor_phone,
        orig.ticket_type, orig.num_adults, orig.num_children, orig.visit_date,
        -(orig.amount), -(orig.cgst_amount || 0), -(orig.sgst_amount || 0), -(orig.total_amount),
        orig.payment_mode, -(orig.cash_amount || 0), -(orig.upi_amount || 0), -(orig.card_amount || 0),
        req.user.id,
        orig.id, orig.gst_rate_id, orig.tax_invoice_no ? `REV-${orig.tax_invoice_no}` : null,
      ],
    );

    // Mark original ticket as Cancelled
    await client.query(
      `UPDATE tickets SET status = 'Cancelled' WHERE id = $1`,
      [orig.id],
    );

    // Mark refund as processed
    const { rows: [updatedRefund] } = await client.query(
      `UPDATE refund_requests
          SET status = 'processed', reversal_ticket_id = $1, processed_at = NOW()
        WHERE id = $2 RETURNING *`,
      [reversal.id, refund.id],
    );

    await client.query(
      `INSERT INTO audit_log (actor_id, actor_email, action, target_type, target_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.id, req.user.email, 'refund.process',
        'refund_request', String(refund.id),
        JSON.stringify({ ticket_id: orig.id, reversal_id: reversal.id, amount: refund.amount }),
      ],
    );

    await client.query('COMMIT');
    res.json({ refund: updatedRefund, reversal_ticket_id: reversal.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[refunds/process]', err.message);
    res.status(500).json({ error: 'Failed to process refund' });
  } finally {
    client.release();
  }
});

module.exports = router;
