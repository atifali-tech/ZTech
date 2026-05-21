-- Migration 002: RBAC — roles, permissions, role_permissions
-- Adds role_id FK to users after roles table exists.
-- Safe to re-run: IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(50)  UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id    SERIAL       PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── FK from users → roles (now that roles exists) ────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_users_role_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_role_id
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ── Seed roles (fixed IDs) ────────────────────────────────────────────────────

INSERT INTO roles (id, name, description) VALUES
  (1, 'Super Admin',     'Full system access across all parks'),
  (2, 'Corporate Admin', 'Cross-park analytics and user management'),
  (3, 'Finance Head',    'Revenue, finance data, and approvals'),
  (4, 'Park Manager',    'Single or multi-park operational management'),
  (5, 'Cashier',         'Ticket sales and daily operations'),
  (6, 'Authority User',  'Read-only regulatory and audit access')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- ── Seed permissions ──────────────────────────────────────────────────────────

INSERT INTO permissions (name, label) VALUES
  ('dashboard.view',    'View Dashboard'),
  ('analytics.view',    'View Analytics'),
  ('analytics.export',  'Export Analytics Data'),
  ('tickets.view',      'View Tickets'),
  ('tickets.create',    'Create Tickets'),
  ('tickets.cancel',    'Cancel Tickets'),
  ('parks.view',        'View Parks'),
  ('parks.create',      'Create Parks'),
  ('parks.edit',        'Edit Parks'),
  ('parks.delete',      'Delete Parks'),
  ('users.view',        'View Users'),
  ('users.create',      'Create Users'),
  ('users.edit',        'Edit Users'),
  ('users.delete',      'Delete Users'),
  ('roles.view',        'View Roles & Permissions'),
  ('roles.manage',      'Manage Role Permissions'),
  ('finance.view',      'View Finance Data'),
  ('finance.approve',   'Approve Finance Actions'),
  ('finance.refund',    'Submit and process refund requests'),
  ('finance.reconcile', 'View and manage reconciliation exceptions'),
  ('reports.view',      'View Reports'),
  ('reports.export',    'Export Reports')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

-- ── Seed role_permissions ─────────────────────────────────────────────────────

-- Super Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- Corporate Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions
WHERE name IN (
  'dashboard.view','analytics.view','analytics.export','tickets.view',
  'parks.view','users.view','users.create','users.edit',
  'finance.view','reports.view','reports.export'
)
ON CONFLICT DO NOTHING;

-- Finance Head
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions
WHERE name IN (
  'dashboard.view','analytics.view','analytics.export',
  'tickets.view','finance.view','finance.approve',
  'finance.refund','finance.reconcile',
  'reports.view','reports.export'
)
ON CONFLICT DO NOTHING;

-- Park Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions
WHERE name IN (
  'dashboard.view','analytics.view','tickets.view','tickets.create',
  'tickets.cancel','parks.view','parks.edit','users.view','reports.view'
)
ON CONFLICT DO NOTHING;

-- Cashier
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions
WHERE name IN ('dashboard.view','tickets.view','tickets.create')
ON CONFLICT DO NOTHING;

-- Authority User
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, id FROM permissions
WHERE name IN ('dashboard.view','analytics.view','parks.view','reports.view')
ON CONFLICT DO NOTHING;
