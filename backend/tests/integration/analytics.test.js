'use strict';
/**
 * analytics.test.js — ETL bootstrap correctness and demographics endpoint tests.
 *
 * Validates Phase 10 ANA-01: ETL bootstrap correctly populates analytics tables
 * from the tickets table, is idempotent, and respects park scoping.
 */
const request   = require('supertest');
const createApp = require('../../app');
const { createTestPool, resetDatabase, createTestPark, assignUserPark, createTestUser } = require('../helpers/db');
const { loginAs } = require('../helpers/auth');
const { seedTickets } = require('../utils/testHelpers');
const { PARKS } = require('../fixtures/seeds');
const {
  populateVisitorDemographics,
  populateRevenueCategories,
  populateQuarterlyRevenue,
  populateMonthlyRevenue,
  populateRevenueTrend,
} = require('../../scripts/etl-bootstrap');

let pool, app;
let financeToken, cashierToken, pmToken, pmId;

beforeAll(async () => {
  pool = createTestPool();
  app  = createApp(pool);
  await resetDatabase(pool);

  for (const p of PARKS) await createTestPark(pool, p);

  const finance = await loginAs(pool, 'Finance Head',  { email: 'fh.analytics@test.com' });
  const cashier = await loginAs(pool, 'Cashier',       { email: 'cs.analytics@test.com' });
  const pm      = await loginAs(pool, 'Park Manager',  { email: 'pm.analytics@test.com' });

  financeToken = finance.token;
  cashierToken = cashier.token;
  pmToken      = pm.token; pmId = pm.id;

  // Finance Head assigned to both parks so scopedParkIds is non-empty
  await assignUserPark(pool, finance.id, 'TP001');
  await assignUserPark(pool, finance.id, 'TP002');
  // Park Manager assigned to TP001 only (for scoping tests)
  await assignUserPark(pool, pmId, 'TP001');

  // Known ticket data for deterministic assertions
  const today = new Date().toISOString();

  // TP001: 3 Adult Male + 2 Child Female (5 tickets total)
  await seedTickets(pool, { parkId: 'TP001', count: 3, ageCategory: 'Adult',       gender: 'Male',   totalAmount: 500, createdAt: today });
  await seedTickets(pool, { parkId: 'TP001', count: 2, ageCategory: 'Child',       gender: 'Female', totalAmount: 300, createdAt: today });

  // TP002: 1 Senior Citizen Male
  await seedTickets(pool, { parkId: 'TP002', count: 1, ageCategory: 'Senior Citizen', gender: 'Male', totalAmount: 400, createdAt: today });

  // Run ETL
  await populateVisitorDemographics(pool);
  await populateRevenueCategories(pool);
  await populateQuarterlyRevenue(pool);
  await populateMonthlyRevenue(pool);
  await populateRevenueTrend(pool);
});

afterAll(async () => { await pool.end(); });

// ── ETL correctness ───────────────────────────────────────────────────────────
describe('ETL bootstrap — visitor_demographics', () => {
  test('Adult Male count = 3 for TP001', async () => {
    const { rows } = await pool.query(
      `SELECT SUM(count) AS total FROM visitor_demographics
       WHERE park_id = 'TP001' AND age_group = '18-35' AND gender = 'Male'`
    );
    expect(Number(rows[0].total)).toBe(3);
  });

  test('Child Female count = 2 for TP001 (age_group = 13-17)', async () => {
    const { rows } = await pool.query(
      `SELECT SUM(count) AS total FROM visitor_demographics
       WHERE park_id = 'TP001' AND age_group = '13-17' AND gender = 'Female'`
    );
    expect(Number(rows[0].total)).toBe(2);
  });

  test('Senior Male count = 1 for TP002 (age_group = 60+)', async () => {
    const { rows } = await pool.query(
      `SELECT SUM(count) AS total FROM visitor_demographics
       WHERE park_id = 'TP002' AND age_group = '60+' AND gender = 'Male'`
    );
    expect(Number(rows[0].total)).toBe(1);
  });

  test('ETL is idempotent — running twice does not duplicate rows', async () => {
    const { rows: before } = await pool.query('SELECT COUNT(*) AS n FROM visitor_demographics');
    await populateVisitorDemographics(pool);
    const { rows: after } = await pool.query('SELECT COUNT(*) AS n FROM visitor_demographics');
    expect(after[0].n).toBe(before[0].n);
  });
});

describe('ETL bootstrap — revenue_categories', () => {
  test('Tickets category is populated for TP001', async () => {
    const { rows } = await pool.query(
      `SELECT SUM(amount) AS total FROM revenue_categories
       WHERE park_id = 'TP001' AND category = 'Tickets'`
    );
    // 3 × 500 + 2 × 300 = 2100
    expect(Number(rows[0].total)).toBe(2100);
  });

  test('revenue_categories idempotent — running twice does not duplicate', async () => {
    const { rows: before } = await pool.query('SELECT COUNT(*) AS n FROM revenue_categories');
    await populateRevenueCategories(pool);
    const { rows: after } = await pool.query('SELECT COUNT(*) AS n FROM revenue_categories');
    expect(after[0].n).toBe(before[0].n);
  });
});

describe('ETL bootstrap — quarterly_revenue and monthly_revenue', () => {
  test('quarterly_revenue has at least one row after bootstrap', async () => {
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM quarterly_revenue');
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(1);
  });

  test('monthly_revenue has at least one row after bootstrap', async () => {
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM monthly_revenue');
    expect(Number(rows[0].n)).toBeGreaterThanOrEqual(1);
  });

  test('revenue_trend has rows for each park that has tickets', async () => {
    const { rows } = await pool.query('SELECT DISTINCT park_id FROM revenue_trend');
    const parkIds = rows.map(r => r.park_id);
    expect(parkIds).toContain('TP001');
    expect(parkIds).toContain('TP002');
  });
});

// ── Demographics endpoint ─────────────────────────────────────────────────────
// Demographics response shape: { total, demographics: [{ id, name, icon, total, m, f, o, pct }] }
// id = age_group ('adult', 'kid', 'toddler', 'senior')
// m = male_count, f = female_count, o = other_count
describe('GET /api/dashboard/demographics — aggregation and access', () => {
  test('Finance Head can access demographics (200)', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
  });

  test('Cashier cannot access demographics (403 — no analytics.view)', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(r.status).toBe(403);
  });

  test('demographics response contains expected age groups', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('demographics');
    expect(Array.isArray(r.body.demographics)).toBe(true);
    const groups = r.body.demographics.map(g => g.id);
    // We seeded Adult (→ '18-35' → 'adult') and Child (→ '13-17' → 'kid')
    expect(groups).toContain('adult');
    expect(groups).toContain('kid');
  });

  test('demographics adult group has m (male_count) >= 3', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(r.status).toBe(200);
    const adult = r.body.demographics.find(g => g.id === 'adult');
    expect(adult).toBeDefined();
    expect(Number(adult.m)).toBeGreaterThanOrEqual(3);
  });

  test('Park Manager demographics are scoped to TP001 only', async () => {
    const r = await request(app).get('/api/dashboard/demographics')
      .set('Authorization', `Bearer ${pmToken}`);
    expect(r.status).toBe(200);
    // PM sees TP001 data — adult and kid groups — but NOT TP002's senior data
    // (senior only exists in TP002, PM doesn't have TP002)
    const groups = r.body.demographics.map(g => g.id);
    expect(groups).not.toContain('senior');
  });
});
