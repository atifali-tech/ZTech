'use strict';
const express           = require('express');
const requireAuth       = require('../middleware/auth');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');

const router = express.Router();

// All notification endpoints require a valid session.
router.use(requireAuth);

// ── GET /unread-count — fast polling endpoint ─────────────────────────────────

router.get('/unread-count', async (req, res) => {
  const { rows: [{ count }] } = await req.app.locals.pool.query(
    `SELECT COUNT(*)::int AS count
       FROM notifications
      WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id],
  );
  res.json({ count });
});

// ── GET /pending-actions — workflow summary visible to finance users ───────────

router.get('/pending-actions', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const scoped = req.scopedParkIds !== null;
  const sp     = scoped ? [req.scopedParkIds] : [];

  const [refundR, settleR, exceptR] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count
         FROM refund_requests r
         JOIN tickets t ON t.id = r.ticket_id
        WHERE r.status = 'pending'
          ${scoped ? 'AND t.park_id = ANY($1)' : ''}`,
      sp,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
         FROM settlement_periods s
        WHERE s.status = 'submitted'
          ${scoped ? 'AND s.park_id = ANY($1)' : ''}`,
      sp,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
         FROM reconciliation_exceptions re
         JOIN settlement_periods sp ON sp.id = re.settlement_id
        WHERE re.resolved = FALSE
          ${scoped ? 'AND sp.park_id = ANY($1)' : ''}`,
      sp,
    ),
  ]);

  res.json({
    pending_refunds:       refundR.rows[0].count,
    submitted_settlements: settleR.rows[0].count,
    unresolved_exceptions: exceptR.rows[0].count,
  });
});

// ── GET / — list own notifications, paginated ─────────────────────────────────

router.get('/', async (req, res) => {
  const pool    = req.app.locals.pool;
  const page    = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit   = Math.min(50, parseInt(req.query.limit, 10) || 20);
  const offset  = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  const conditions = ['user_id = $1'];
  const params     = [req.user.id];
  if (unreadOnly) conditions.push('is_read = FALSE');

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT id, type, title, body, meta, park_id, is_read, created_at
       FROM notifications
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: [ct] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notifications WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2),
  );

  res.json({ data: rows, total: ct.total, page, limit });
});

// ── GET /workflow-events — global workflow history (finance.view required) ─────

router.get('/workflow-events', ...requirePermission('finance.view'), parkScope, async (req, res) => {
  const pool   = req.app.locals.pool;
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 30);
  const offset = (page - 1) * limit;
  const scoped = req.scopedParkIds !== null;

  const conditions = ['1=1'];
  const params     = [];
  if (req.query.event_type) {
    params.push(req.query.event_type);
    conditions.push(`event_type = $${params.length}`);
  }
  if (scoped) {
    params.push(req.scopedParkIds);
    conditions.push(`park_id = ANY($${params.length})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT id, event_type, actor_email, entity_type, entity_id, park_id, meta, created_at
       FROM workflow_events
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const { rows: [ct] } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM workflow_events WHERE ${conditions.join(' AND ')}`,
    params.slice(0, -2),
  );

  res.json({ data: rows, total: ct.total, page, limit });
});

// ── POST /:id/read — mark single notification as read ─────────────────────────

router.post('/:id/read', async (req, res) => {
  const { rows: [n] } = await req.app.locals.pool.query(
    `UPDATE notifications SET is_read = TRUE
      WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.user.id],
  );
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ ok: true });
});

// ── POST /read-all — mark all own notifications as read ───────────────────────

router.post('/read-all', async (req, res) => {
  await req.app.locals.pool.query(
    `UPDATE notifications SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id],
  );
  res.json({ ok: true });
});

module.exports = router;
