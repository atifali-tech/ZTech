-- Migration 007: Seed data — parks and Super Admin user.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.

-- ── Parks ─────────────────────────────────────────────────────────────────────

INSERT INTO parks (id, name, city, state, color_hex) VALUES
  ('ZP001', 'Jungle Trail',  'Noida',         'Uttar Pradesh', '#16A34A'),
  ('ZP002', 'UP Darshan',    'Lucknow',        'Uttar Pradesh', '#2563EB'),
  ('ZP003', 'Harmony',       'Kanpur',         'Uttar Pradesh', '#F59E0B'),
  ('ZP004', 'Gautam Buddha', 'Greater Noida',  'Uttar Pradesh', '#DC2626'),
  ('ZP005', 'World Park',    'Delhi',          'NCT Delhi',     '#7C3AED'),
  ('ZP006', 'Shivalaya',     'Varanasi',       'Uttar Pradesh', '#06B6D4'),
  ('ZP007', 'Saat Ajoobe',   'Agra',           'Uttar Pradesh', '#EC4899')
ON CONFLICT (id) DO NOTHING;

-- ── Super Admin user ──────────────────────────────────────────────────────────
-- Password: Admin@!2345  (bcrypt cost 10)

INSERT INTO users (id, name, email, password_hash, role, role_id, token_version)
VALUES (
  gen_random_uuid()::text,
  'System Admin',
  'admin@zingparks.com',
  '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu',
  'Super Admin',
  1,
  0
)
ON CONFLICT (email) DO NOTHING;
