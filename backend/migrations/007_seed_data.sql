-- Migration 007: Seed data — parks and Super Admin user.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.

-- ── Parks ─────────────────────────────────────────────────────────────────────

INSERT INTO parks (id, name, city, state, color_hex) VALUES
  ('ZP001', 'Jungle Trail',  'Lucknow',    'Uttar Pradesh', '#1D9E75'),
  ('ZP002', 'UP Darshan',    'Agra',       'Uttar Pradesh', '#5A6BCF'),
  ('ZP003', 'Harmony',       'Noida',      'Uttar Pradesh', '#D89614'),
  ('ZP004', 'Gautam Buddha', 'Greater Noida', 'Uttar Pradesh', '#E5604D'),
  ('ZP005', 'Shivalaya',     'Varanasi',   'Uttar Pradesh', '#8C5BB3'),
  ('ZP006', 'Saat Ajoobe',   'Mathura',    'Uttar Pradesh', '#0E7C66'),
  ('ZP007', 'World Park',    'Kanpur',     'Uttar Pradesh', '#8A92A3')
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
