-- Migration 013: Business Workflow Gap Remediation
-- Addresses audit findings: P1 (Finance Head parks.view), P3 (Park Manager finance),
-- P2 (Corporate Admin analytics.export), P4/P6 (missing analytics.export),
-- P9 (operations perms visible in roles UI — data-only; UI change is frontend).
-- Additive only. Safe to re-run: ON CONFLICT DO NOTHING throughout.

-- ── 1. Finance Head: add parks.view (P1 — critical bug, breaks Reconciliation) ──

INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name = 'parks.view'
ON CONFLICT DO NOTHING;

-- ── 2. Park Manager: add finance.view, finance.refund, finance.reconcile ─────────
--    Allows Park Managers to see their park's settlement status, initiate refunds,
--    and cross-check reconciliation before submitting.

INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions
WHERE name IN ('finance.view', 'finance.refund', 'finance.reconcile')
ON CONFLICT DO NOTHING;

-- ── 3. Park Manager: add analytics.export ────────────────────────────────────────

INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name = 'analytics.export'
ON CONFLICT DO NOTHING;

-- ── 4. Corporate Admin: add analytics.export (was missing — unintentional) ───────

INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name = 'analytics.export'
ON CONFLICT DO NOTHING;

-- ── 5. Authority User: add tickets.view (read-only compliance visibility) ────────

INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, id FROM permissions WHERE name IN ('tickets.view', 'analytics.export')
ON CONFLICT DO NOTHING;

-- ── 6. tickets.cancel permission (for Park Manager and Cashier) ───────────────────
--    Permission already exists from seed (002_rbac.sql) but was not assigned to
--    Cashier. Park Manager already had it. Adding Cashier now.

INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions WHERE name = 'tickets.cancel'
ON CONFLICT DO NOTHING;

-- ── 7. finance.view for Park Manager also grants settlement read in existing UI ───
--    No new columns required; settlement_periods already has all needed columns.
--    The parkScope middleware will automatically restrict data to their parks.
