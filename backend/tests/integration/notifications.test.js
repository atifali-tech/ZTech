'use strict';
// ═══════════════════════════════════════════════════════════════
// Integration tests for /api/notifications
//
// Covers: auth enforcement, unread-count, list/pagination,
// mark-as-read, mark-all-read, pending-actions scoping,
// workflow-events, notification creation on refund/settlement
// workflow actions, scope isolation (user A ≠ user B).
// ═══════════════════════════════════════════════════════════════

const request = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { PARKS } = require('../fixtures/seeds');
const { notify, logWorkflowEvent } = require('../../lib/notifier');

let pool, app;
let saToken, saId;
let financeToken, financeId;
let managerToken, managerId;
let cashierToken;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const sa      = await loginAs(pool, 'Super Admin',  { email: 'sa.notif@test.com' });
  const finance = await loginAs(pool, 'Finance Head', { email: 'fh.notif@test.com' });
  const manager = await loginAs(pool, 'Park Manager', { email: 'pm.notif@test.com' });
  const cashier = await loginAs(pool, 'Cashier',      { email: 'cs.notif@test.com' });

  saToken      = sa.token;      saId      = sa.id;
  financeToken = finance.token; financeId = finance.id;
  managerToken = manager.token; managerId = manager.id;
  cashierToken = cashier.token;

  await assignUserPark(pool, managerId, 'TP001');

  // Seed some notifications for SA
  await notify(pool, { userId: saId,      type: 'refund.requested',     title: 'Refund #1',     meta: { amount: 500 }, parkId: 'TP001' });
  await notify(pool, { userId: saId,      type: 'settlement.submitted', title: 'Settlement A',  meta: {}, parkId: 'TP002' });
  await notify(pool, { userId: financeId, type: 'refund.requested',     title: 'Refund for FH', meta: {}, parkId: 'TP001' });

  // Seed a workflow event
  await logWorkflowEvent(pool, {
    eventType: 'refund.requested', actorId: managerId, actorEmail: 'pm.notif@test.com',
    entityType: 'refund_request', entityId: '999',
    parkId: 'TP001', meta: { amount: 300 },
  });
});

afterAll(async () => { await pool.end(); });

// ── Auth enforcement ──────────────────────────────────────────────────────────

describe('Auth enforcement', () => {
  test('401 GET /unread-count without token', async () => {
    const r = await request(app).get('/api/notifications/unread-count');
    expect(r.status).toBe(401);
  });

  test('401 GET / without token', async () => {
    const r = await request(app).get('/api/notifications');
    expect(r.status).toBe(401);
  });

  test('401 POST /:id/read without token', async () => {
    const r = await request(app).post('/api/notifications/1/read');
    expect(r.status).toBe(401);
  });
});

// ── GET /unread-count ─────────────────────────────────────────────────────────

describe('GET /api/notifications/unread-count', () => {
  test('returns count for SA', async () => {
    const r = await request(app).get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('count');
    expect(typeof r.body.count).toBe('number');
    expect(r.body.count).toBeGreaterThanOrEqual(2); // seeded 2 for SA
  });

  test('Finance Head sees only their own unread', async () => {
    const r = await request(app).get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body.count).toBeGreaterThanOrEqual(1);
  });

  test('Cashier with no notifications returns 0', async () => {
    const r = await request(app).get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(0);
  });
});

// ── GET / — list notifications ────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  test('200 returns paginated list for SA', async () => {
    const r = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('data');
    expect(r.body).toHaveProperty('total');
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.total).toBeGreaterThanOrEqual(2);
  });

  test('Scope isolation: SA only sees their own notifications', async () => {
    const r = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    // Should not contain Finance Head's notification
    r.body.data.forEach(n => {
      expect(n).not.toHaveProperty('user_id'); // user_id not returned
      expect(n.title).not.toBe('Refund for FH');
    });
  });

  test('Finance Head only sees their own notifications', async () => {
    const r = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    r.body.data.forEach(n => {
      expect(n.title).not.toBe('Refund #1');
      expect(n.title).not.toBe('Settlement A');
    });
  });

  test('unread=true filter returns only unread', async () => {
    const r = await request(app).get('/api/notifications?unread=true')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    r.body.data.forEach(n => expect(n.is_read).toBe(false));
  });

  test('response shape has required fields', async () => {
    const r = await request(app).get('/api/notifications')
      .set('Authorization', `Bearer ${saToken}`);
    const n = r.body.data[0];
    expect(n).toHaveProperty('id');
    expect(n).toHaveProperty('type');
    expect(n).toHaveProperty('title');
    expect(n).toHaveProperty('is_read');
    expect(n).toHaveProperty('created_at');
  });
});

// ── POST /:id/read ────────────────────────────────────────────────────────────

describe('POST /api/notifications/:id/read', () => {
  let notifId;

  beforeAll(async () => {
    // Get SA's first unread notification id
    const { rows } = await pool.query(
      `SELECT id FROM notifications WHERE user_id = $1 AND is_read = FALSE LIMIT 1`,
      [saId],
    );
    notifId = rows[0]?.id;
  });

  test('200 marks own notification as read', async () => {
    if (!notifId) return;
    const r = await request(app).post(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    // Verify in DB
    const { rows } = await pool.query('SELECT is_read FROM notifications WHERE id = $1', [notifId]);
    expect(rows[0].is_read).toBe(true);
  });

  test('404 when trying to mark another user\'s notification', async () => {
    if (!notifId) return;
    // Finance Head tries to mark SA's notification
    const r = await request(app).post(`/api/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(404);
  });
});

// ── POST /read-all ────────────────────────────────────────────────────────────

describe('POST /api/notifications/read-all', () => {
  test('200 marks all own notifications as read', async () => {
    const r = await request(app).post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [saId],
    );
    expect(count).toBe(0);
  });

  test('unread-count returns 0 after read-all', async () => {
    const r = await request(app).get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
    expect(r.body.count).toBe(0);
  });
});

// ── GET /pending-actions ──────────────────────────────────────────────────────

describe('GET /api/notifications/pending-actions', () => {
  test('401 without token', async () => {
    const r = await request(app).get('/api/notifications/pending-actions');
    expect(r.status).toBe(401);
  });

  test('403 for Cashier (no finance.view)', async () => {
    const r = await request(app).get('/api/notifications/pending-actions')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('200 for Finance Head — returns counts', async () => {
    const r = await request(app).get('/api/notifications/pending-actions')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('pending_refunds');
    expect(r.body).toHaveProperty('submitted_settlements');
    expect(r.body).toHaveProperty('unresolved_exceptions');
    expect(typeof r.body.pending_refunds).toBe('number');
  });

  test('200 for Super Admin', async () => {
    const r = await request(app).get('/api/notifications/pending-actions')
      .set('Authorization', `Bearer ${saToken}`);
    expect(r.status).toBe(200);
  });
});

// ── GET /workflow-events ──────────────────────────────────────────────────────

describe('GET /api/notifications/workflow-events', () => {
  test('401 without token', async () => {
    const r = await request(app).get('/api/notifications/workflow-events');
    expect(r.status).toBe(401);
  });

  test('403 for Cashier (no finance.view)', async () => {
    const r = await request(app).get('/api/notifications/workflow-events')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('200 Finance Head sees workflow events', async () => {
    const r = await request(app).get('/api/notifications/workflow-events')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('data');
    expect(r.body).toHaveProperty('total');
    expect(r.body.total).toBeGreaterThanOrEqual(1);
  });

  test('workflow event shape is correct', async () => {
    const r = await request(app).get('/api/notifications/workflow-events')
      .set('Authorization', `Bearer ${financeToken}`);
    const ev = r.body.data[0];
    expect(ev).toHaveProperty('event_type');
    expect(ev).toHaveProperty('actor_email');
    expect(ev).toHaveProperty('entity_type');
    expect(ev).toHaveProperty('created_at');
  });

  test('Park Manager sees only their park events', async () => {
    // Seed an event for TP002 (not manager's park)
    await logWorkflowEvent(pool, {
      eventType: 'refund.rejected', actorId: saId, actorEmail: 'sa@test.com',
      entityType: 'refund_request', entityId: '888',
      parkId: 'TP002', meta: {},
    });

    const r = await request(app).get('/api/notifications/workflow-events')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(r.status).toBe(200);
    const parkIds = r.body.data.map(ev => ev.park_id).filter(Boolean);
    expect(parkIds.every(id => id === 'TP001')).toBe(true);
  });
});

// ── Workflow event created on refund request ──────────────────────────────────

describe('Workflow events via refund actions', () => {
  let ticketId;

  beforeAll(async () => {
    // Seed a real ticket to refund
    const { rows: [t] } = await pool.query(`
      INSERT INTO tickets
        (ticket_id, park_id, age_category, quantity,
         amount, cgst_amount, sgst_amount, total_amount,
         cash_amount, upi_amount, card_amount,
         payment_mode, status, created_at)
      VALUES
        ('NTF001','TP001','Adult',1, 500,25,25,550, 550,0,0, 'Cash','Confirmed', NOW())
      RETURNING id
    `);
    ticketId = t.id;
  });

  test('POST /api/refunds creates a workflow_event', async () => {
    const before = await pool.query(
      `SELECT COUNT(*)::int AS count FROM workflow_events WHERE event_type = 'refund.requested'`,
    );

    await request(app).post('/api/refunds')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ ticket_id: ticketId, reason: 'Test refund for workflow event' });

    const after = await pool.query(
      `SELECT COUNT(*)::int AS count FROM workflow_events WHERE event_type = 'refund.requested'`,
    );
    expect(after.rows[0].count).toBeGreaterThan(before.rows[0].count);
  });

  test('POST /api/refunds creates notifications for approvers', async () => {
    // Finance Head should have received a notification
    await new Promise(r => setTimeout(r, 100)); // allow async notify to settle
    const { rows } = await pool.query(
      `SELECT id FROM notifications WHERE user_id = $1 AND type = 'refund.requested'`,
      [financeId],
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── notifyByPermission sends to all role holders ──────────────────────────────

describe('notifyByPermission helper', () => {
  test('creates notifications for all users with a permission', async () => {
    const { notifyByPermission: nbp } = require('../../lib/notifier');

    const before = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE type = 'test.notification'`,
    );

    await nbp(pool, {
      permission: 'finance.view',
      type: 'test.notification',
      title: 'Test notification for all finance users',
    });

    const after = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE type = 'test.notification'`,
    );

    // At least Finance Head and Super Admin should have finance.view
    expect(after.rows[0].count).toBeGreaterThan(before.rows[0].count);
  });
});
