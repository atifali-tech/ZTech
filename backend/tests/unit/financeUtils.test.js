'use strict';
// ═══════════════════════════════════════════════════════════════
// Unit tests for backend/lib/financeUtils.js
// ═══════════════════════════════════════════════════════════════

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyVarianceSeverity,
  computeVariance,
  detectExceptions,
  computeSettlementExpected,
} = require('../../lib/financeUtils');

// ─── classifyVarianceSeverity ─────────────────────────────────────────────────

describe('classifyVarianceSeverity', () => {
  it('returns low for <2% variance', () => {
    assert.equal(classifyVarianceSeverity(1000, 1015), 'low'); // 1.5%
  });

  it('returns medium for 2-5% variance', () => {
    assert.equal(classifyVarianceSeverity(1000, 1030), 'medium'); // 3%
  });

  it('returns high for 5-10% variance', () => {
    assert.equal(classifyVarianceSeverity(1000, 1070), 'high'); // 7%
  });

  it('returns critical for >=10% variance', () => {
    assert.equal(classifyVarianceSeverity(1000, 1120), 'critical'); // 12%
  });

  it('returns low for both zero', () => {
    assert.equal(classifyVarianceSeverity(0, 0), 'low');
  });

  it('returns critical when actual is 0 and expected is large', () => {
    assert.equal(classifyVarianceSeverity(1000, 0), 'critical');
  });

  it('works symmetrically for negative variance', () => {
    assert.equal(classifyVarianceSeverity(1000, 930), 'high'); // -7%
  });
});

// ─── computeVariance ─────────────────────────────────────────────────────────

describe('computeVariance', () => {
  it('computes positive variance', () => {
    const v = computeVariance(1000, 1050);
    assert.equal(v.variance,     50);
    assert.equal(v.variance_pct, 5);
    assert.equal(v.severity,     'high');
    assert.equal(v.within_tolerance, false);
  });

  it('marks low variance as within tolerance', () => {
    const v = computeVariance(1000, 1005);
    assert.equal(v.within_tolerance, true);
    assert.equal(v.severity,         'low');
  });

  it('computes negative variance', () => {
    const v = computeVariance(1000, 980);
    assert.equal(v.variance, -20);
    assert.ok(v.variance_pct < 0);
  });

  it('handles zero expected safely', () => {
    const v = computeVariance(0, 100);
    // base = actual (100), variance_pct = 100%
    assert.ok(Math.abs(v.variance_pct) > 0);
  });
});

// ─── detectExceptions ────────────────────────────────────────────────────────

describe('detectExceptions', () => {
  it('returns empty when all tickets match', () => {
    const tickets = [
      { id: 1, total_amount: 500, payment_mode: 'Cash', status: 'Confirmed' },
    ];
    const expected = [{ ticket_id: 1, expected_amount: 500 }];
    const exceptions = detectExceptions(tickets, expected);
    assert.equal(exceptions.length, 0);
  });

  it('detects missing_payment when ticket has no expected entry', () => {
    const tickets = [
      { id: 2, total_amount: 300, payment_mode: 'UPI', status: 'Confirmed' },
    ];
    const expected = [];
    const exceptions = detectExceptions(tickets, expected);
    assert.equal(exceptions.length, 1);
    assert.equal(exceptions[0].exception_type, 'missing_payment');
    assert.equal(exceptions[0].ticket_id,      2);
    assert.equal(exceptions[0].expected_amt,   300);
    assert.equal(exceptions[0].actual_amt,     0);
  });

  it('detects amount_mismatch when amounts differ by > 0.01', () => {
    const tickets = [
      { id: 3, total_amount: 600, payment_mode: 'Card', status: 'Confirmed' },
    ];
    const expected = [{ ticket_id: 3, expected_amount: 500 }];
    const exceptions = detectExceptions(tickets, expected);
    assert.equal(exceptions.length, 1);
    assert.equal(exceptions[0].exception_type, 'amount_mismatch');
    assert.equal(exceptions[0].variance,       100);
  });

  it('ignores tiny floating-point differences (≤0.01)', () => {
    const tickets = [
      { id: 4, total_amount: 100.005, payment_mode: 'Cash', status: 'Confirmed' },
    ];
    const expected = [{ ticket_id: 4, expected_amount: 100.00 }];
    const exceptions = detectExceptions(tickets, expected);
    assert.equal(exceptions.length, 0);
  });

  it('handles multiple tickets with mixed results', () => {
    const tickets = [
      { id: 5, total_amount: 200, payment_mode: 'Cash', status: 'Confirmed' }, // match
      { id: 6, total_amount: 300, payment_mode: 'UPI',  status: 'Confirmed' }, // missing in expected
      { id: 7, total_amount: 400, payment_mode: 'Card', status: 'Confirmed' }, // mismatch
    ];
    const expected = [
      { ticket_id: 5, expected_amount: 200 },
      { ticket_id: 7, expected_amount: 350 },
    ];
    const exceptions = detectExceptions(tickets, expected);
    assert.equal(exceptions.length, 2);
    const types = exceptions.map(e => e.exception_type).sort();
    assert.deepEqual(types, ['amount_mismatch', 'missing_payment']);
  });
});

// ─── computeSettlementExpected (mock pool) ────────────────────────────────────

describe('computeSettlementExpected', () => {
  it('returns parsed numeric totals', async () => {
    const mockRow = {
      expected_rev: '12500.00',
      ticket_count: '42',
      cash_total:   '5000.00',
      upi_total:    '4500.00',
      card_total:   '3000.00',
      split_total:  '0.00',
    };
    const pool = { query: async () => ({ rows: [mockRow] }) };
    const result = await computeSettlementExpected(pool, 1, '2025-06-01');
    assert.equal(typeof result.expected_rev, 'number');
    assert.equal(result.expected_rev, 12500);
    assert.equal(result.ticket_count, 42);
    assert.equal(result.cash_total,   5000);
  });
});
