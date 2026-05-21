'use strict';

// Create a targeted notification for a specific user.
async function notify(pool, { userId, type, title, body = null, meta = {}, parkId = null }) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, meta, park_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, body, JSON.stringify(meta), parkId],
  );
}

// Create notifications for every user who holds a given permission.
// parkId is stored on each notification for display context but does NOT filter recipients —
// users with finance.approve have global visibility by design.
async function notifyByPermission(pool, { permission, type, title, body = null, meta = {}, parkId = null }) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id
       FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p       ON p.id = rp.permission_id
      WHERE p.name = $1`,
    [permission],
  );
  for (const u of rows) {
    await notify(pool, { userId: u.id, type, title, body, meta, parkId });
  }
}

// Append an immutable workflow event. actor_id is not a FK — survives user deletion.
async function logWorkflowEvent(pool, {
  eventType, actorId = null, actorEmail = null,
  entityType = null, entityId = null, parkId = null, meta = {},
}) {
  await pool.query(
    `INSERT INTO workflow_events
       (event_type, actor_id, actor_email, entity_type, entity_id, park_id, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      eventType,
      actorId   || null,
      actorEmail || null,
      entityType || null,
      entityId != null ? String(entityId) : null,
      parkId    || null,
      JSON.stringify(meta),
    ],
  );
}

module.exports = { notify, notifyByPermission, logWorkflowEvent };
