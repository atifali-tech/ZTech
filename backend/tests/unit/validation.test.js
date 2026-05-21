'use strict';
// ═══════════════════════════════════════════════════════════════
// Unit tests for validateBooking (from backend/routes/tickets.js)
//
// The function and its constants are copied inline so that the
// Express router (and pg/jwt deps) are never imported.
// ═══════════════════════════════════════════════════════════════

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// ─── Inline copy: constants & validateBooking ─────────────────────────────────
//
// Source: backend/routes/tickets.js  (lines 17-85)

const VALID_PAYMENT_MODES = new Set(['Cash', 'UPI', 'Card', 'Split']);
const VALID_SOURCES       = new Set(['App', 'Counter', 'Web']);
const VALID_STATUSES      = new Set(['Confirmed', 'Completed', 'Cancelled']);

function validateBooking(t) {
  const errors = [];

  if (!t.ticket_id)
    errors.push('ticket_id: required');
  // park_id is VARCHAR(10) — e.g. "ZP001". Accept any non-empty string.
  if (!t.park_id || typeof t.park_id !== 'string' || !t.park_id.trim())
    errors.push('park_id: required');

  const vs = t.visitor_summary;
  if (!vs || typeof vs !== 'object')
    errors.push('visitor_summary: required object');
  else {
    const total = Object.values(vs).reduce((s, v) => s + (Number(v) || 0), 0);
    if (total === 0) errors.push('visitor_summary: at least one visitor required');
  }

  const pm = t.price_map;
  if (!pm || typeof pm !== 'object')
    errors.push('price_map: required object');

  if (t.total_amount == null || isNaN(Number(t.total_amount)) || Number(t.total_amount) < 0)
    errors.push('total_amount: required, non-negative number');

  if (!VALID_PAYMENT_MODES.has(t.payment_mode))
    errors.push(`payment_mode: must be one of ${[...VALID_PAYMENT_MODES].join(', ')}`);

  if (!VALID_SOURCES.has(t.source))
    errors.push(`source: must be one of ${[...VALID_SOURCES].join(', ')}`);

  if (t.status && !VALID_STATUSES.has(t.status))
    errors.push(`status: must be one of ${[...VALID_STATUSES].join(', ')}`);

  // Validate payment split sums to total
  if (!errors.length) {
    const cash = Number(t.cash_amount) || 0;
    const upi  = Number(t.upi_amount)  || 0;
    const card = Number(t.card_amount) || 0;
    const sum  = Math.round((cash + upi + card) * 100);
    const tot  = Math.round(Number(t.total_amount) * 100);
    if (sum !== tot)
      errors.push(`cash_amount + upi_amount + card_amount (${cash + upi + card}) must equal total_amount (${t.total_amount})`);
  }

  return errors;
}

// ─── Helper: a fully-valid booking baseline ───────────────────────────────────

function validBooking(overrides) {
  return Object.assign(
    {
      ticket_id:       'TK-20240101-001',
      park_id:         'ZP001',
      visitor_summary: { total_adults: 2, total_children: 1, total_toddlers: 0, total_seniors: 0 },
      price_map:       { adult: 200, child: 100, toddler: 0, senior: 150 },
      total_amount:    500,
      cash_amount:     500,
      upi_amount:      0,
      card_amount:     0,
      payment_mode:    'Cash',
      source:          'Counter',
    },
    overrides
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('validateBooking', () => {
  describe('park_id validation', () => {
    it('passes for a VARCHAR(10) park_id like "ZP001"', () => {
      const errors = validateBooking(validBooking({ park_id: 'ZP001' }));
      assert.deepStrictEqual(errors, []);
    });

    it('passes for a UUID-format park_id (not rejected — any non-empty string is valid)', () => {
      const errors = validateBooking(
        validBooking({ park_id: '550e8400-e29b-41d4-a716-446655440000' })
      );
      assert.deepStrictEqual(errors, []);
    });

    it('errors when park_id is missing', () => {
      const booking = validBooking();
      delete booking.park_id;
      const errors = validateBooking(booking);
      assert.ok(
        errors.some(e => e.includes('park_id: required')),
        `Expected "park_id: required" in errors: ${JSON.stringify(errors)}`
      );
    });

    it('errors when park_id is an empty string', () => {
      const errors = validateBooking(validBooking({ park_id: '' }));
      assert.ok(
        errors.some(e => e.includes('park_id: required')),
        `Expected "park_id: required" in errors: ${JSON.stringify(errors)}`
      );
    });

    it('errors when park_id is a whitespace-only string', () => {
      const errors = validateBooking(validBooking({ park_id: '   ' }));
      assert.ok(
        errors.some(e => e.includes('park_id: required')),
        `Expected "park_id: required" in errors: ${JSON.stringify(errors)}`
      );
    });
  });

  describe('ticket_id validation', () => {
    it('errors when ticket_id is missing', () => {
      const booking = validBooking();
      delete booking.ticket_id;
      const errors = validateBooking(booking);
      assert.ok(
        errors.some(e => e.includes('ticket_id: required')),
        `Expected "ticket_id: required" in errors: ${JSON.stringify(errors)}`
      );
    });

    it('errors when ticket_id is an empty string', () => {
      const errors = validateBooking(validBooking({ ticket_id: '' }));
      assert.ok(
        errors.some(e => e.includes('ticket_id: required')),
        `Expected "ticket_id: required" in errors: ${JSON.stringify(errors)}`
      );
    });
  });

  describe('visitor_summary validation', () => {
    it('errors when visitor_summary is missing', () => {
      const booking = validBooking();
      delete booking.visitor_summary;
      const errors = validateBooking(booking);
      assert.ok(
        errors.some(e => e.includes('visitor_summary')),
        `Expected visitor_summary error in: ${JSON.stringify(errors)}`
      );
    });

    it('errors when visitor_summary is not an object', () => {
      const errors = validateBooking(validBooking({ visitor_summary: 'adults=2' }));
      assert.ok(
        errors.some(e => e.includes('visitor_summary')),
        `Expected visitor_summary error in: ${JSON.stringify(errors)}`
      );
    });

    it('errors when all visitor counts are zero', () => {
      const errors = validateBooking(
        validBooking({
          visitor_summary: { total_adults: 0, total_children: 0, total_toddlers: 0, total_seniors: 0 },
        })
      );
      assert.ok(
        errors.some(e => e.includes('visitor_summary') && e.includes('at least one visitor')),
        `Expected "at least one visitor" error in: ${JSON.stringify(errors)}`
      );
    });
  });

  describe('price_map validation', () => {
    it('errors when price_map is missing', () => {
      const booking = validBooking();
      delete booking.price_map;
      const errors = validateBooking(booking);
      assert.ok(
        errors.some(e => e.includes('price_map')),
        `Expected price_map error in: ${JSON.stringify(errors)}`
      );
    });

    it('errors when price_map is not an object', () => {
      const errors = validateBooking(validBooking({ price_map: null }));
      assert.ok(
        errors.some(e => e.includes('price_map')),
        `Expected price_map error in: ${JSON.stringify(errors)}`
      );
    });
  });

  describe('payment_mode validation', () => {
    it('errors on an invalid payment_mode', () => {
      const errors = validateBooking(validBooking({ payment_mode: 'Bitcoin' }));
      assert.ok(
        errors.some(e => e.includes('payment_mode')),
        `Expected payment_mode error in: ${JSON.stringify(errors)}`
      );
    });

    it('accepts all valid payment modes', () => {
      for (const mode of ['Cash', 'UPI', 'Card', 'Split']) {
        const errors = validateBooking(
          validBooking({
            payment_mode: mode,
            // for Split, set up a realistic split (500 total: 200 cash + 200 upi + 100 card)
            cash_amount: 200,
            upi_amount:  200,
            card_amount: 100,
            total_amount: 500,
          })
        );
        assert.ok(
          !errors.some(e => e.includes('payment_mode')),
          `payment_mode "${mode}" should be valid, got: ${JSON.stringify(errors)}`
        );
      }
    });
  });

  describe('source validation', () => {
    it('errors on an invalid source', () => {
      const errors = validateBooking(validBooking({ source: 'Kiosk' }));
      assert.ok(
        errors.some(e => e.includes('source')),
        `Expected source error in: ${JSON.stringify(errors)}`
      );
    });

    it('accepts all valid sources', () => {
      for (const src of ['App', 'Counter', 'Web']) {
        const errors = validateBooking(validBooking({ source: src }));
        assert.ok(
          !errors.some(e => e.includes('source')),
          `source "${src}" should be valid, got: ${JSON.stringify(errors)}`
        );
      }
    });
  });

  describe('status validation', () => {
    it('errors when an invalid status is provided', () => {
      const errors = validateBooking(validBooking({ status: 'Pending' }));
      assert.ok(
        errors.some(e => e.includes('status')),
        `Expected status error in: ${JSON.stringify(errors)}`
      );
    });

    it('passes when no status is set (optional field)', () => {
      const booking = validBooking();
      delete booking.status;
      const errors = validateBooking(booking);
      assert.deepStrictEqual(errors, []);
    });

    it('accepts all valid statuses', () => {
      for (const st of ['Confirmed', 'Completed', 'Cancelled']) {
        const errors = validateBooking(validBooking({ status: st }));
        assert.ok(
          !errors.some(e => e.includes('status')),
          `status "${st}" should be valid, got: ${JSON.stringify(errors)}`
        );
      }
    });
  });

  describe('payment split validation', () => {
    it('errors when cash + upi + card does not equal total_amount', () => {
      const errors = validateBooking(
        validBooking({
          total_amount: 500,
          cash_amount:  200,
          upi_amount:   200,
          card_amount:  50, // 200+200+50 = 450 ≠ 500
        })
      );
      assert.ok(
        errors.some(e => e.includes('must equal total_amount')),
        `Expected payment split mismatch error in: ${JSON.stringify(errors)}`
      );
    });

    it('passes when cash + upi + card exactly equals total_amount', () => {
      const errors = validateBooking(
        validBooking({
          total_amount: 500,
          cash_amount:  300,
          upi_amount:   150,
          card_amount:  50, // 300+150+50 = 500
        })
      );
      assert.deepStrictEqual(errors, []);
    });

    it('passes with floating point amounts within rounding tolerance', () => {
      const errors = validateBooking(
        validBooking({
          total_amount: 150.75,
          cash_amount:  100.25,
          upi_amount:   50.50,
          card_amount:  0,     // 100.25+50.50+0 = 150.75
        })
      );
      assert.deepStrictEqual(errors, []);
    });

    it('errors when total_amount is missing', () => {
      const booking = validBooking();
      delete booking.total_amount;
      const errors = validateBooking(booking);
      assert.ok(
        errors.some(e => e.includes('total_amount')),
        `Expected total_amount error in: ${JSON.stringify(errors)}`
      );
    });

    it('errors when total_amount is negative', () => {
      const errors = validateBooking(validBooking({ total_amount: -1 }));
      assert.ok(
        errors.some(e => e.includes('total_amount')),
        `Expected total_amount error in: ${JSON.stringify(errors)}`
      );
    });
  });

  describe('full valid booking', () => {
    it('returns no errors for a fully valid booking', () => {
      const errors = validateBooking(validBooking());
      assert.deepStrictEqual(errors, []);
    });
  });
});
