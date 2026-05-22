-- Migration 009: Operations RBAC — permissions for counters, devices, gates, shifts.
-- Additive only. Safe to re-run: ON CONFLICT DO NOTHING / DO UPDATE throughout.

INSERT INTO permissions (name, label) VALUES
  ('counters.view',   'View Counters'),
  ('counters.create', 'Create Counters'),
  ('counters.edit',   'Edit Counters'),
  ('counters.delete', 'Delete Counters'),
  ('devices.view',    'View Devices'),
  ('devices.create',  'Create Devices'),
  ('devices.edit',    'Edit Devices'),
  ('devices.delete',  'Delete Devices'),
  ('gates.view',      'View Gates'),
  ('gates.create',    'Create Gates'),
  ('gates.edit',      'Edit Gates'),
  ('gates.delete',    'Delete Gates'),
  ('shifts.view',     'View Shifts'),
  ('shifts.create',   'Open Shifts'),
  ('shifts.edit',     'Edit Shifts'),
  ('shifts.close',    'Close and Settle Shifts'),
  ('zones.view',      'View Zones'),
  ('zones.create',    'Create Zones'),
  ('zones.edit',      'Edit Zones'),
  ('zones.delete',    'Delete Zones')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

-- Super Admin: all permissions (catches newly added ones)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT DO NOTHING;

-- Corporate Admin: view-only ops
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions
WHERE name IN (
  'counters.view','devices.view','gates.view','shifts.view','zones.view'
)
ON CONFLICT DO NOTHING;

-- Finance Head: view shifts (for revenue variance)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions
WHERE name IN ('shifts.view','counters.view')
ON CONFLICT DO NOTHING;

-- Park Manager: full ops management
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions
WHERE name IN (
  'zones.view','zones.create','zones.edit','zones.delete',
  'counters.view','counters.create','counters.edit','counters.delete',
  'devices.view','devices.create','devices.edit','devices.delete',
  'gates.view','gates.create','gates.edit','gates.delete',
  'shifts.view','shifts.create','shifts.edit','shifts.close'
)
ON CONFLICT DO NOTHING;

-- Cashier: view and manage own shifts, view counters/devices
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions
WHERE name IN (
  'counters.view','devices.view','shifts.view','shifts.create','shifts.close'
)
ON CONFLICT DO NOTHING;

-- Authority User: view-only
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, id FROM permissions
WHERE name IN ('counters.view','devices.view','gates.view','shifts.view','zones.view')
ON CONFLICT DO NOTHING;
