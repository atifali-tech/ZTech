-- Migration 005: Fix finance permission inserts
-- Migration 003 incorrectly used the column name 'description' (which does not exist
-- in the permissions table). The correct column is 'label'. This migration inserts the
-- two missing permissions and assigns them to Finance Head and Super Admin.
--
-- Safe to re-run: all statements use ON CONFLICT DO NOTHING / DO UPDATE.

INSERT INTO permissions (name, label)
VALUES
  ('finance.refund',    'Submit and process refund requests'),
  ('finance.reconcile', 'View and manage reconciliation exceptions')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

-- Assign to Finance Head (role_id = 3)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions
WHERE name IN ('finance.refund', 'finance.reconcile')
ON CONFLICT DO NOTHING;

-- Super Admin (role_id = 1) gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
WHERE name IN ('finance.refund', 'finance.reconcile')
ON CONFLICT DO NOTHING;
