'use strict';
const express           = require('express');
const requirePermission = require('../middleware/permission');
const parkScope         = require('../middleware/parkScope');
const logAudit          = require('../lib/audit');

const router = express.Router();

const VALID_CATEGORIES = ['Adult', 'Child', 'Senior Citizen', 'Toddler'];
const VALID_DAY_TYPES  = ['Weekday', 'Weekend', 'Holiday'];
const DATE_RE          = /^\d{4}-\d{2}-\d{2}$/;

// ── GET /api/parks/:parkId/pricing ─────────────────────────────────────────────
// Returns all pricing rules for the park, joined with GST rate info.
router.get('/:parkId/pricing', [...requirePermission('parks.view'), parkScope], async (req, res) => {
  const { parkId } = req.params;
  const scopedIds  = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT
         r.id, r.park_id, r.category, r.day_type,
         r.base_price, r.gst_rate_id, r.is_active,
         r.effective_from, r.effective_to,
         r.created_at, r.updated_at,
         g.cgst_pct, g.sgst_pct,
         u.name AS created_by_name
       FROM park_pricing_rules r
       LEFT JOIN gst_rates g ON g.id = r.gst_rate_id
       LEFT JOIN users     u ON u.id = r.created_by
       WHERE r.park_id = $1
       ORDER BY r.category, r.day_type, r.effective_from DESC`,
      [parkId],
    );
    res.json(rows);
  } catch (err) {
    console.error('[pricing/list]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/parks/:parkId/pricing/history ─────────────────────────────────────
// Returns the pricing change audit trail for the park.
router.get('/:parkId/pricing/history', [...requirePermission('parks.view'), parkScope], async (req, res) => {
  const { parkId } = req.params;
  const scopedIds  = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }
  const pool  = req.app.locals.pool;
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  try {
    const { rows } = await pool.query(
      `SELECT
         h.id, h.rule_id, h.action,
         h.category, h.day_type,
         h.old_base_price, h.new_base_price,
         h.is_active, h.effective_from, h.effective_to,
         h.changed_by_email, h.changed_at
       FROM park_pricing_history h
       WHERE h.park_id = $1
       ORDER BY h.changed_at DESC
       LIMIT $2`,
      [parkId, limit],
    );
    res.json(rows);
  } catch (err) {
    console.error('[pricing/history]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/parks/:parkId/pricing/gst-rates ───────────────────────────────────
// Returns available GST rates for the pricing form dropdowns.
router.get('/:parkId/pricing/gst-rates', [...requirePermission('parks.view'), parkScope], async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const { rows } = await pool.query(
      `SELECT id, category, cgst_pct, sgst_pct, effective_from, effective_to
       FROM gst_rates
       WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE
       ORDER BY category, effective_from DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('[pricing/gst-rates]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/parks/:parkId/pricing ────────────────────────────────────────────
// Create a new pricing rule. Validates for overlapping active periods.
router.post('/:parkId/pricing', [...requirePermission('parks.edit'), parkScope], async (req, res) => {
  const { parkId }   = req.params;
  const scopedIds    = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }

  const { category, day_type, base_price, gst_rate_id, effective_from, effective_to, is_active = true } = req.body;

  // Validation
  if (!VALID_CATEGORIES.includes(category))
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  if (!VALID_DAY_TYPES.includes(day_type))
    return res.status(400).json({ error: `day_type must be one of: ${VALID_DAY_TYPES.join(', ')}` });
  if (base_price === undefined || base_price === null || isNaN(Number(base_price)) || Number(base_price) < 0)
    return res.status(400).json({ error: 'base_price must be a non-negative number' });
  if (!DATE_RE.test(effective_from || ''))
    return res.status(400).json({ error: 'effective_from must be YYYY-MM-DD' });
  if (effective_to && !DATE_RE.test(effective_to))
    return res.status(400).json({ error: 'effective_to must be YYYY-MM-DD' });
  if (effective_to && effective_to < effective_from)
    return res.status(400).json({ error: 'effective_to must be >= effective_from' });

  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify park exists
    const { rows: [park] } = await client.query('SELECT id FROM parks WHERE id = $1', [parkId]);
    if (!park) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Park not found' }); }

    // Verify GST rate exists
    if (gst_rate_id) {
      const { rows: [gst] } = await client.query('SELECT id FROM gst_rates WHERE id = $1', [gst_rate_id]);
      if (!gst) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Invalid gst_rate_id' }); }
    }

    // Overlap check: no two active rules for same (park, category, day_type) may share a date range
    if (is_active) {
      const overlap = await checkOverlap(client, parkId, category, day_type, effective_from, effective_to, null);
      if (overlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Overlapping active pricing rule exists for ${category}/${day_type} in this period` });
      }
    }

    const { rows: [rule] } = await client.query(
      `INSERT INTO park_pricing_rules
         (park_id, category, day_type, base_price, gst_rate_id, is_active, effective_from, effective_to, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [parkId, category, day_type, Number(base_price), gst_rate_id || null, is_active, effective_from, effective_to || null, req.user.id],
    );

    await writeHistory(client, rule, 'created', null, req.user);
    await logAudit(pool, req.user, 'pricing.create', 'park_pricing_rule', rule.id, { parkId, category, day_type, base_price });

    await client.query('COMMIT');
    res.status(201).json(rule);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[pricing/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── PUT /api/parks/:parkId/pricing/:ruleId ─────────────────────────────────────
// Update an existing rule. Writes history on every save.
router.put('/:parkId/pricing/:ruleId', [...requirePermission('parks.edit'), parkScope], async (req, res) => {
  const { parkId, ruleId } = req.params;
  const scopedIds = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }

  const { category, day_type, base_price, gst_rate_id, effective_from, effective_to, is_active } = req.body;

  if (category && !VALID_CATEGORIES.includes(category))
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  if (day_type && !VALID_DAY_TYPES.includes(day_type))
    return res.status(400).json({ error: `day_type must be one of: ${VALID_DAY_TYPES.join(', ')}` });
  if (base_price !== undefined && (isNaN(Number(base_price)) || Number(base_price) < 0))
    return res.status(400).json({ error: 'base_price must be a non-negative number' });
  if (effective_from && !DATE_RE.test(effective_from))
    return res.status(400).json({ error: 'effective_from must be YYYY-MM-DD' });
  if (effective_to && !DATE_RE.test(effective_to))
    return res.status(400).json({ error: 'effective_to must be YYYY-MM-DD' });

  const pool   = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existing] } = await client.query(
      'SELECT * FROM park_pricing_rules WHERE id = $1 AND park_id = $2',
      [ruleId, parkId],
    );
    if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Rule not found' }); }

    const merged = {
      category:       category       ?? existing.category,
      day_type:       day_type       ?? existing.day_type,
      base_price:     base_price !== undefined ? Number(base_price) : Number(existing.base_price),
      gst_rate_id:    gst_rate_id !== undefined ? (gst_rate_id || null) : existing.gst_rate_id,
      is_active:      is_active  !== undefined ? is_active  : existing.is_active,
      effective_from: effective_from ?? existing.effective_from,
      effective_to:   effective_to  !== undefined ? (effective_to || null) : existing.effective_to,
    };

    if (merged.effective_to && merged.effective_to < merged.effective_from) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'effective_to must be >= effective_from' });
    }

    // Overlap check excludes the current rule
    if (merged.is_active) {
      const overlap = await checkOverlap(client, parkId, merged.category, merged.day_type, merged.effective_from, merged.effective_to, Number(ruleId));
      if (overlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Overlapping active pricing rule exists for ${merged.category}/${merged.day_type} in this period` });
      }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE park_pricing_rules SET
         category=$1, day_type=$2, base_price=$3, gst_rate_id=$4,
         is_active=$5, effective_from=$6, effective_to=$7, updated_at=NOW()
       WHERE id=$8 AND park_id=$9
       RETURNING *`,
      [merged.category, merged.day_type, merged.base_price, merged.gst_rate_id,
       merged.is_active, merged.effective_from, merged.effective_to, ruleId, parkId],
    );

    await writeHistory(client, updated, 'updated', existing, req.user);
    await logAudit(pool, req.user, 'pricing.update', 'park_pricing_rule', ruleId, { parkId, ...merged });

    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[pricing/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── DELETE /api/parks/:parkId/pricing/:ruleId ──────────────────────────────────
// Soft-deactivate a rule (set is_active=false). Hard delete only if no history.
router.delete('/:parkId/pricing/:ruleId', [...requirePermission('parks.edit'), parkScope], async (req, res) => {
  const { parkId, ruleId } = req.params;
  const scopedIds = req.scopedParkIds;
  if (scopedIds !== null && !scopedIds.includes(parkId)) {
    return res.status(403).json({ error: 'Access denied to this park' });
  }
  const pool   = req.app.locals.pool;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [existing] } = await client.query(
      'SELECT * FROM park_pricing_rules WHERE id=$1 AND park_id=$2', [ruleId, parkId],
    );
    if (!existing) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Rule not found' }); }

    const { rows: histRows } = await client.query(
      'SELECT id FROM park_pricing_history WHERE rule_id=$1 LIMIT 1', [ruleId],
    );

    if (histRows.length > 0) {
      // Has history — soft deactivate only
      const { rows: [updated] } = await client.query(
        `UPDATE park_pricing_rules SET is_active=FALSE, updated_at=NOW()
         WHERE id=$1 RETURNING *`, [ruleId],
      );
      await writeHistory(client, updated, 'deactivated', existing, req.user);
      await client.query('COMMIT');
      res.json({ ok: true, action: 'deactivated', rule: updated });
    } else {
      // No history — safe hard delete
      await client.query('DELETE FROM park_pricing_rules WHERE id=$1', [ruleId]);
      await client.query('COMMIT');
      await logAudit(pool, req.user, 'pricing.delete', 'park_pricing_rule', ruleId, { parkId });
      res.json({ ok: true, action: 'deleted' });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[pricing/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function checkOverlap(client, parkId, category, dayType, effectiveFrom, effectiveTo, excludeId) {
  // Two date ranges [A, B] and [C, D] overlap when A <= D AND C <= B
  // A null end date is treated as +infinity.
  const { rows } = await client.query(
    `SELECT id FROM park_pricing_rules
     WHERE park_id      = $1
       AND category     = $2
       AND day_type     = $3
       AND is_active    = TRUE
       AND ($4::date IS NULL OR effective_to IS NULL OR effective_to   >= $4::date)
       AND ($5::date IS NULL OR effective_from IS NULL OR effective_from <= $5::date)
       AND ($6::int  IS NULL OR id <> $6)
     LIMIT 1`,
    [parkId, category, dayType, effectiveFrom, effectiveTo || null, excludeId || null],
  );
  return rows.length > 0;
}

async function writeHistory(client, rule, action, previous, actor) {
  await client.query(
    `INSERT INTO park_pricing_history
       (park_id, rule_id, action, category, day_type,
        old_base_price, new_base_price, old_gst_rate_id, new_gst_rate_id,
        is_active, effective_from, effective_to, changed_by_id, changed_by_email)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      rule.park_id, rule.id, action, rule.category, rule.day_type,
      previous ? previous.base_price : null,
      rule.base_price,
      previous ? previous.gst_rate_id : null,
      rule.gst_rate_id,
      rule.is_active,
      rule.effective_from,
      rule.effective_to,
      actor.id, actor.email,
    ],
  );
}

module.exports = router;
