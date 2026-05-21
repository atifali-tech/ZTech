-- Local DB RBAC migration — adapts to the UUID-based schema in zingparks_local.
-- Safe to re-run (all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING).

BEGIN;

-- ── RBAC tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50)  UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Local DB uses UUID for both users.id and parks.id
CREATE TABLE IF NOT EXISTS user_parks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  park_id UUID REFERENCES parks(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, park_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    TEXT,
  actor_email VARCHAR(150),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   VARCHAR(100),
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL        PRIMARY KEY,
  user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(64)   NOT NULL,
  title      VARCHAR(255)  NOT NULL,
  body       TEXT,
  meta       JSONB         NOT NULL DEFAULT '{}',
  park_id    UUID,
  is_read    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_events (
  id          SERIAL        PRIMARY KEY,
  event_type  VARCHAR(64)   NOT NULL,
  actor_id    TEXT,
  actor_email VARCHAR(255),
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  park_id     UUID,
  meta        JSONB         NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Add role_id + created_at columns to users ─────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id    INT REFERENCES roles(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
WHERE name IN ('dashboard.view','analytics.view','analytics.export','tickets.view',
               'parks.view','users.view','users.create','users.edit',
               'finance.view','reports.view','reports.export')
ON CONFLICT DO NOTHING;

-- Finance Head
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions
WHERE name IN ('dashboard.view','analytics.view','analytics.export',
               'tickets.view','finance.view','finance.approve',
               'finance.refund','finance.reconcile',
               'reports.view','reports.export')
ON CONFLICT DO NOTHING;

-- Park Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions
WHERE name IN ('dashboard.view','analytics.view','tickets.view','tickets.create',
               'tickets.cancel','parks.view','parks.edit','users.view','reports.view')
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

-- ── Migrate existing park_ids → user_parks ────────────────────────────────────

INSERT INTO user_parks (user_id, park_id)
SELECT id, park_id FROM users WHERE park_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Assign role_id to existing users based on role string ─────────────────────

UPDATE users SET role_id = 1 WHERE LOWER(role) = 'super admin'     AND role_id IS NULL;
UPDATE users SET role_id = 2 WHERE LOWER(role) = 'corporate admin' AND role_id IS NULL;
UPDATE users SET role_id = 3 WHERE LOWER(role) = 'finance head'    AND role_id IS NULL;
UPDATE users SET role_id = 4 WHERE LOWER(role) IN ('park manager','park admin') AND role_id IS NULL;
UPDATE users SET role_id = 5 WHERE LOWER(role) = 'cashier'         AND role_id IS NULL;
UPDATE users SET role_id = 6 WHERE LOWER(role) = 'authority user'  AND role_id IS NULL;
-- Any remaining unmatched → Cashier
UPDATE users SET role_id = 5 WHERE role_id IS NULL;

COMMIT;
