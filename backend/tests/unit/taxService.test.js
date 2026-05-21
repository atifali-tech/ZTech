'use strict';
// ═══════════════════════════════════════════════════════════════
// Unit tests for backend/lib/taxService.js
//
// getRateForCategory is tested with a mock pool so no DB is needed.
// calculateTax and computeTax are fully synchronous-accessible.
// ═══════════════════════════════════════════════════════════════

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTax, getRateForCategory, computeTax } = require('../../lib/taxService');

// ─── calculateTax ─────────────────────────────────────────────────────────────

describe('calculateTax', () => {
  it('computes 5% CGST + 5% SGST correctly', () => {
    const result = calculateTax(1000, { cgst_pct: 5, sgst_pct: 5, igst_pct: 0 });
    assert.equal(result.cgst_amount, 50);
    assert.equal(result.sgst_amount, 50);
    assert.equal(result.igst_amount, 0);
    assert.equal(result.total_tax,   100);
    assert.equal(result.total_amount, 1100);
  });

  it('computes 12% IGST correctly', () => {
    const result = calculateTax(500, { cgst_pct: 0, sgst_pct: 0, igst_pct: 12 });
    assert.equal(result.cgst_amount, 0);
    assert.equal(result.igst_amount, 60);
    assert.equal(result.total_amount, 560);
  });

  it('rounds to 2 decimal places', () => {
    const result = calculateTax(100.01, { cgst_pct: 9, sgst_pct: 9, igst_pct: 0 });
    // 100.01 * 9% = 9.0009 → rounded to 9.00
    assert.equal(result.cgst_amount, 9.00);
    assert.equal(result.sgst_amount, 9.00);
  });

  it('handles zero amount', () => {
    const result = calculateTax(0, { cgst_pct: 5, sgst_pct: 5, igst_pct: 0 });
    assert.equal(result.total_amount, 0);
    assert.equal(result.total_tax,    0);
  });

  it('falls back to DEFAULT_RATE when rate fields missing', () => {
    const result = calculateTax(200, {});
    // Default: 5%+5% → 10 + 10 = 20 tax, 220 total
    assert.equal(result.cgst_amount, 10);
    assert.equal(result.sgst_amount, 10);
    assert.equal(result.total_amount, 220);
  });
});

// ─── getRateForCategory (mock pool) ──────────────────────────────────────────

function makeMockPool(rows) {
  return {
    query: async () => ({ rows }),
  };
}

describe('getRateForCategory', () => {
  it('returns the matching rate row from the DB', async () => {
    const pool = makeMockPool([{ id: 1, cgst_pct: 5, sgst_pct: 5, igst_pct: 0 }]);
    const rate = await getRateForCategory(pool, 'Entry', '2025-06-01');
    assert.equal(rate.id, 1);
    assert.equal(rate.cgst_pct, 5);
  });

  it('falls back to hard-coded DEFAULT_RATE when no rows returned', async () => {
    // First call (specific category) returns empty, second call (default) also empty
    let callCount = 0;
    const pool = {
      query: async () => { callCount++; return { rows: [] }; },
    };
    const rate = await getRateForCategory(pool, 'Unknown', '2025-06-01');
    assert.equal(rate.cgst_pct, 5);
    assert.equal(rate.sgst_pct, 5);
    assert.equal(rate.id, null);
    assert.equal(callCount, 2); // tried specific category, then 'default'
  });

  it('uses default row when specific category not found', async () => {
    let callCount = 0;
    const pool = {
      query: async () => {
        callCount++;
        if (callCount === 1) return { rows: [] }; // specific category miss
        return { rows: [{ id: 5, cgst_pct: 5, sgst_pct: 5, igst_pct: 0 }] };
      },
    };
    const rate = await getRateForCategory(pool, 'F&B', '2025-01-01');
    assert.equal(rate.id, 5);
    assert.equal(callCount, 2);
  });
});

// ─── computeTax (integration of getRateForCategory + calculateTax) ───────────

describe('computeTax', () => {
  it('fetches rate and computes tax in one call', async () => {
    const pool = makeMockPool([{ id: 2, cgst_pct: 5, sgst_pct: 5, igst_pct: 0 }]);
    const result = await computeTax(pool, 200, 'Entry', '2025-07-01');
    assert.equal(result.rate_id,     2);
    assert.equal(result.cgst_amount, 10);
    assert.equal(result.sgst_amount, 10);
    assert.equal(result.total_amount, 220);
  });
});
