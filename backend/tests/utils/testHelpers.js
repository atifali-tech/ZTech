'use strict';
const request = require('supertest');
const { randomUUID: uuid } = require('crypto');

/**
 * Seed ticket rows directly into the DB for analytics / scoping tests.
 * Returns the array of inserted ticket_ids.
 *
 * Each call inserts `count` rows, one row per age_category (defaults to 'Adult').
 * Use different age_category / gender combos to test demographic aggregation.
 */
async function seedTickets(pool, {
  parkId = 'TP001',
  count = 1,
  ageCategory = 'Adult',
  gender = 'Male',
  amount = 500,
  totalAmount = 500,
  status = 'Confirmed',
  createdAt = null,
  cashierId = null,
} = {}) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const ticketId = `T${uuid().replace(/-/g, '').slice(0, 18).toUpperCase()}`;
    const ts = createdAt || new Date().toISOString();
    await pool.query(
      `INSERT INTO tickets
         (ticket_id, park_id, age_category, quantity, amount, total_amount,
          payment_mode, status, source, cashier_id, gender, created_at)
       VALUES ($1,$2,$3,1,$4,$5,'Cash',$6,'Counter',$7,$8,$9)
       ON CONFLICT DO NOTHING`,
      [ticketId, parkId, ageCategory, amount, totalAmount, status, cashierId, gender, ts]
    );
    ids.push(ticketId);
  }
  return ids;
}

/**
 * Log in via the HTTP endpoint and return the JWT string (extracted from cookie).
 * Use this to get a real token that carries the `tv` (token version) claim.
 */
async function loginAndGetToken(app, email, password = 'testpass123') {
  const r = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  if (r.status !== 200) {
    throw new Error(`loginAndGetToken: login failed (${r.status}): ${JSON.stringify(r.body)}`);
  }
  const setCookie = r.headers['set-cookie'];
  if (!setCookie) throw new Error('loginAndGetToken: no Set-Cookie header in response');
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const m = c.match(/^token=([^;]+)/);
    if (m) return m[1];
  }
  throw new Error('loginAndGetToken: token cookie not found in Set-Cookie');
}

/**
 * Assert that an audit_log entry exists matching the given criteria.
 * Throws (via Jest expect) if the entry is missing.
 */
async function assertAuditEntry(pool, { action, actorEmail = null, targetId = null } = {}) {
  const conditions = ['action = $1'];
  const params = [action];
  if (actorEmail) {
    conditions.push(`actor_email = $${params.length + 1}`);
    params.push(actorEmail);
  }
  if (targetId) {
    conditions.push(`target_id = $${params.length + 1}`);
    params.push(String(targetId));
  }
  const { rows } = await pool.query(
    `SELECT id FROM audit_log WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params
  );
  expect(rows.length).toBeGreaterThan(0);
}

module.exports = { seedTickets, loginAndGetToken, assertAuditEntry };
