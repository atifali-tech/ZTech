-- Migration 015: UAT Seed Data
-- Populates all 7 parks with realistic operational data so no screen is
-- empty during UAT. Safe to re-run: all inserts use ON CONFLICT DO NOTHING
-- or are idempotent by design.
-- Run AFTER migrations 001–014.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PARK OPERATIONAL SETTINGS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_operational_settings
  (park_id, supports_entry_tracking, supports_devices, supports_zones,
   supports_gates, supports_shifts, max_daily_capacity, alert_threshold_pct,
   occupancy_warning_pct, occupancy_critical_pct, shift_variance_threshold, auto_close_shifts)
VALUES
  ('ZP001', TRUE, TRUE, TRUE, TRUE, TRUE, 2000, 75, 85, 95, 500, FALSE),
  ('ZP002', TRUE, TRUE, TRUE, TRUE, TRUE, 1500, 75, 85, 95, 500, FALSE),
  ('ZP003', TRUE, TRUE, TRUE, TRUE, TRUE, 1200, 75, 85, 95, 400, FALSE),
  ('ZP004', TRUE, TRUE, TRUE, TRUE, TRUE, 1000, 75, 85, 95, 400, FALSE),
  ('ZP005', TRUE, TRUE, TRUE, TRUE, TRUE,  800, 80, 90, 95, 300, FALSE),
  ('ZP006', TRUE, TRUE, TRUE, TRUE, TRUE,  700, 80, 90, 95, 300, FALSE),
  ('ZP007', TRUE, TRUE, TRUE, TRUE, TRUE,  900, 80, 90, 95, 350, FALSE)
ON CONFLICT (park_id) DO UPDATE SET
  supports_entry_tracking = EXCLUDED.supports_entry_tracking,
  supports_devices        = EXCLUDED.supports_devices,
  supports_zones          = EXCLUDED.supports_zones,
  supports_gates          = EXCLUDED.supports_gates,
  supports_shifts         = EXCLUDED.supports_shifts;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PARK MANAGER USERS (one per park, role_id=4)
-- ─────────────────────────────────────────────────────────────────────────────
-- Password for all: Manager@1234  (bcrypt $2b$10$ hash)

INSERT INTO users (id, name, email, password_hash, role, role_id, park_id, token_version)
VALUES
  ('pm-zp001', 'Aakash Sharma',   'pm.zp001@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP001', 0),
  ('pm-zp002', 'Bhavna Rao',      'pm.zp002@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP002', 0),
  ('pm-zp003', 'Chetan Verma',    'pm.zp003@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP003', 0),
  ('pm-zp004', 'Divya Singh',     'pm.zp004@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP004', 0),
  ('pm-zp005', 'Eshan Mehta',     'pm.zp005@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP005', 0),
  ('pm-zp006', 'Fatima Qureshi',  'pm.zp006@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP006', 0),
  ('pm-zp007', 'Ganesh Iyer',     'pm.zp007@zingparks.in', '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Park Manager', 4, 'ZP007', 0)
ON CONFLICT (email) DO NOTHING;

-- Assign park managers to their parks in user_parks
INSERT INTO user_parks (user_id, park_id)
VALUES
  ('pm-zp001','ZP001'), ('pm-zp002','ZP002'), ('pm-zp003','ZP003'),
  ('pm-zp004','ZP004'), ('pm-zp005','ZP005'), ('pm-zp006','ZP006'),
  ('pm-zp007','ZP007')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ZONES  (3 per park: Entry, General, VIP)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_zones (id, park_id, name, zone_type, is_active) VALUES
  -- ZP001
  ('zone-zp001-entry',   'ZP001', 'Main Entry Zone',    'Entry',   TRUE),
  ('zone-zp001-general', 'ZP001', 'Central Zone',       'General', TRUE),
  ('zone-zp001-vip',     'ZP001', 'VIP Enclosure',      'VIP',     TRUE),
  -- ZP002
  ('zone-zp002-entry',   'ZP002', 'East Entry Zone',    'Entry',   TRUE),
  ('zone-zp002-general', 'ZP002', 'Heritage Walk Zone', 'General', TRUE),
  ('zone-zp002-vip',     'ZP002', 'Premium Zone',       'VIP',     TRUE),
  -- ZP003
  ('zone-zp003-entry',   'ZP003', 'North Gate Zone',    'Entry',   TRUE),
  ('zone-zp003-general', 'ZP003', 'Harmony Gardens',    'General', TRUE),
  ('zone-zp003-food',    'ZP003', 'Food Court Zone',    'Food',    TRUE),
  -- ZP004
  ('zone-zp004-entry',   'ZP004', 'Lotus Gate Zone',    'Entry',   TRUE),
  ('zone-zp004-general', 'ZP004', 'Meditation Zone',    'General', TRUE),
  ('zone-zp004-rides',   'ZP004', 'Rides Zone',         'Rides',   TRUE),
  -- ZP005
  ('zone-zp005-entry',   'ZP005', 'Temple Gate Zone',   'Entry',   TRUE),
  ('zone-zp005-general', 'ZP005', 'Main Grounds',       'General', TRUE),
  -- ZP006
  ('zone-zp006-entry',   'ZP006', 'Heritage Entry',     'Entry',   TRUE),
  ('zone-zp006-general', 'ZP006', 'Wonder Zone',        'General', TRUE),
  -- ZP007
  ('zone-zp007-entry',   'ZP007', 'World Gate Entry',   'Entry',   TRUE),
  ('zone-zp007-general', 'ZP007', 'International Zone', 'General', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GATES  (2 per park: Entry + Exit)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_gates (id, park_id, zone_id, name, gate_type, occupancy_enabled, is_active) VALUES
  ('gate-zp001-a', 'ZP001', 'zone-zp001-entry',   'Gate A — Main Entry', 'Entry', TRUE,  TRUE),
  ('gate-zp001-b', 'ZP001', 'zone-zp001-entry',   'Gate B — Main Exit',  'Exit',  FALSE, TRUE),
  ('gate-zp002-a', 'ZP002', 'zone-zp002-entry',   'East Entry Gate',     'Entry', TRUE,  TRUE),
  ('gate-zp002-b', 'ZP002', 'zone-zp002-entry',   'East Exit Gate',      'Exit',  FALSE, TRUE),
  ('gate-zp003-a', 'ZP003', 'zone-zp003-entry',   'North Entry Gate',    'Entry', TRUE,  TRUE),
  ('gate-zp003-b', 'ZP003', 'zone-zp003-entry',   'North Exit Gate',     'Exit',  FALSE, TRUE),
  ('gate-zp004-a', 'ZP004', 'zone-zp004-entry',   'Lotus Entry Gate',    'Entry', TRUE,  TRUE),
  ('gate-zp004-b', 'ZP004', 'zone-zp004-entry',   'Lotus Exit Gate',     'Exit',  FALSE, TRUE),
  ('gate-zp005-a', 'ZP005', 'zone-zp005-entry',   'Temple Entry Gate',   'Entry', TRUE,  TRUE),
  ('gate-zp005-b', 'ZP005', 'zone-zp005-entry',   'Temple Exit Gate',    'Exit',  FALSE, TRUE),
  ('gate-zp006-a', 'ZP006', 'zone-zp006-entry',   'Heritage Entry Gate', 'Entry', TRUE,  TRUE),
  ('gate-zp006-b', 'ZP006', 'zone-zp006-entry',   'Heritage Exit Gate',  'Exit',  FALSE, TRUE),
  ('gate-zp007-a', 'ZP007', 'zone-zp007-entry',   'World Gate Entry',    'Entry', TRUE,  TRUE),
  ('gate-zp007-b', 'ZP007', 'zone-zp007-entry',   'World Gate Exit',     'Exit',  FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. COUNTERS  (2 per park: Ticketing + Inquiry)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_counters (id, park_id, zone_id, name, counter_type, is_active) VALUES
  ('ctr-zp001-1', 'ZP001', 'zone-zp001-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp001-2', 'ZP001', 'zone-zp001-entry',   'Inquiry Counter',     'Self-Service', TRUE),
  ('ctr-zp002-1', 'ZP002', 'zone-zp002-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp002-2', 'ZP002', 'zone-zp002-entry',   'Inquiry Counter',     'Self-Service',   TRUE),
  ('ctr-zp003-1', 'ZP003', 'zone-zp003-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp003-2', 'ZP003', 'zone-zp003-entry',   'Mobile Counter',      'Self-Service',    TRUE),
  ('ctr-zp004-1', 'ZP004', 'zone-zp004-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp004-2', 'ZP004', 'zone-zp004-entry',   'Inquiry Counter',     'Self-Service',   TRUE),
  ('ctr-zp005-1', 'ZP005', 'zone-zp005-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp005-2', 'ZP005', 'zone-zp005-entry',   'Inquiry Counter',     'Self-Service',   TRUE),
  ('ctr-zp006-1', 'ZP006', 'zone-zp006-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp006-2', 'ZP006', 'zone-zp006-entry',   'Mobile Counter',      'Self-Service',    TRUE),
  ('ctr-zp007-1', 'ZP007', 'zone-zp007-entry',   'Ticketing Counter 1', 'Ticketing', TRUE),
  ('ctr-zp007-2', 'ZP007', 'zone-zp007-entry',   'Inquiry Counter',     'Self-Service',   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DEVICES  (1 POS per ticketing counter, 1 Scanner per entry gate)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_devices (id, park_id, counter_id, name, device_type, status, software_version, is_active) VALUES
  -- ZP001
  ('dev-zp001-pos1', 'ZP001', 'ctr-zp001-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp001-scan', 'ZP001', NULL,           'Entry Scanner A',   'QR Scanner', 'Online',  'v2.1.0', TRUE),
  -- ZP002
  ('dev-zp002-pos1', 'ZP002', 'ctr-zp002-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp002-scan', 'ZP002', NULL,           'Entry Scanner A',   'QR Scanner', 'Offline', 'v2.0.9', TRUE),
  -- ZP003
  ('dev-zp003-pos1', 'ZP003', 'ctr-zp003-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp003-tab',  'ZP003', 'ctr-zp003-2', 'Mobile Tablet 1',   'Tablet',     'Online',  'v1.5.3', TRUE),
  -- ZP004
  ('dev-zp004-pos1', 'ZP004', 'ctr-zp004-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp004-scan', 'ZP004', NULL,           'Entry Scanner A',   'QR Scanner', 'Online',  'v2.1.0', TRUE),
  -- ZP005
  ('dev-zp005-pos1', 'ZP005', 'ctr-zp005-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.0', TRUE),
  ('dev-zp005-scan', 'ZP005', NULL,           'Entry Scanner A',   'QR Scanner', 'Maintenance', 'v2.0.8', TRUE),
  -- ZP006
  ('dev-zp006-pos1', 'ZP006', 'ctr-zp006-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp006-tab',  'ZP006', 'ctr-zp006-2', 'Mobile Tablet 1',   'Tablet',     'Online',  'v1.5.3', TRUE),
  -- ZP007
  ('dev-zp007-pos1', 'ZP007', 'ctr-zp007-1', 'POS Terminal 1',    'POS',        'Online',  'v3.2.1', TRUE),
  ('dev-zp007-scan', 'ZP007', NULL,           'Entry Scanner A',   'QR Scanner', 'Online',  'v2.1.0', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. PRICING RULES  (Adult/Child/Senior Citizen/Toddler × Weekday/Weekend)
--    GST rate ID 1 = Entry 5%+5% from 004_finance.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_pricing_rules
  (park_id, category, day_type, base_price, gst_rate_id, is_active, effective_from, created_by)
SELECT p.id, cat.category, dt.day_type, cat.price * dt.multiplier, 1, TRUE, '2024-04-01', NULL
FROM parks p
CROSS JOIN (VALUES
  ('Adult',          150.00),
  ('Child',          100.00),
  ('Senior Citizen',  80.00),
  ('Toddler',          0.00)
) AS cat(category, price)
CROSS JOIN (VALUES
  ('Weekday', 1.0),
  ('Weekend', 1.3)
) AS dt(day_type, multiplier)
ON CONFLICT DO NOTHING;

-- Holiday pricing (1.5× weekday Adult/Child/Senior)
INSERT INTO park_pricing_rules
  (park_id, category, day_type, base_price, gst_rate_id, is_active, effective_from, created_by)
SELECT p.id, cat.category, 'Holiday', cat.price * 1.5, 1, TRUE, '2024-04-01', NULL
FROM parks p
CROSS JOIN (VALUES
  ('Adult',          150.00),
  ('Child',          100.00),
  ('Senior Citizen',  80.00)
) AS cat(category, price)
ON CONFLICT DO NOTHING;

-- Toddler Holiday (always 0)
INSERT INTO park_pricing_rules
  (park_id, category, day_type, base_price, gst_rate_id, is_active, effective_from, created_by)
SELECT p.id, 'Toddler', 'Holiday', 0.00, NULL, TRUE, '2024-04-01', NULL
FROM parks p
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SHIFT SESSIONS  (1 closed shift per park + 1 open shift for ZP001–ZP003)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO shift_sessions
  (park_id, counter_id, user_id, status, opened_at, closed_at,
   opening_cash, declared_cash, expected_rev, actual_rev, notes)
VALUES
  -- Closed shifts (yesterday)
  ('ZP001','ctr-zp001-1','pm-zp001','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000, 12400.00, 12400.00, 12400.00, 'Normal day'),
  ('ZP002','ctr-zp002-1','pm-zp002','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  9800.00,  9800.00,  9800.00, 'Normal day'),
  ('ZP003','ctr-zp003-1','pm-zp003','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  7600.00,  7600.00,  7600.00, 'Normal day'),
  ('ZP004','ctr-zp004-1','pm-zp004','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  8200.00,  8200.00,  8200.00, 'Normal day'),
  ('ZP005','ctr-zp005-1','pm-zp005','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  5900.00,  5900.00,  5900.00, 'Normal day'),
  ('ZP006','ctr-zp006-1','pm-zp006','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  4800.00,  4800.00,  4800.00, 'Normal day'),
  ('ZP007','ctr-zp007-1','pm-zp007','Closed', NOW()-INTERVAL '26h', NOW()-INTERVAL '18h', 5000,  6100.00,  6100.00,  6100.00, 'Normal day'),
  -- Open shifts (today — for ZP001, ZP002, ZP003)
  ('ZP001','ctr-zp001-1','pm-zp001','Open',   NOW()-INTERVAL '2h',  NULL, 5000, NULL, NULL, NULL, NULL),
  ('ZP002','ctr-zp002-1','pm-zp002','Open',   NOW()-INTERVAL '90m', NULL, 5000, NULL, NULL, NULL, NULL),
  ('ZP003','ctr-zp003-1','pm-zp003','Open',   NOW()-INTERVAL '3h',  NULL, 5000, NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ALERTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO operational_alerts
  (park_id, alert_type, severity, title, body, status, created_at)
VALUES
  ('ZP001', 'occupancy_high',   'medium', 'High Occupancy',         'Current occupancy at 82% of max capacity.',       'open',         NOW()-INTERVAL '45m'),
  ('ZP001', 'device_offline',   'high',   'Scanner Offline',        'Entry Scanner A has been offline for 15 minutes.','resolved',     NOW()-INTERVAL '3h'),
  ('ZP002', 'device_offline',   'high',   'POS Offline',            'POS Terminal 1 is not responding.',                'open',         NOW()-INTERVAL '20m'),
  ('ZP003', 'shift_variance',   'medium', 'Shift Variance',         'Shift variance exceeds ₹450 threshold.',          'open',         NOW()-INTERVAL '1h'),
  ('ZP004', 'occupancy_high',   'low',    'Approaching Threshold',  'Occupancy at 70% — approaching alert threshold.', 'acknowledged', NOW()-INTERVAL '30m'),
  ('ZP005', 'device_offline',   'medium', 'Scanner Maintenance',    'Entry Scanner A is in maintenance mode.',         'open',         NOW()-INTERVAL '2h'),
  ('ZP006', 'shift_variance',   'low',    'Long Running Shift',     'Shift open for over 9 hours without a break.',    'open',         NOW()-INTERVAL '9h'),
  ('ZP007', 'occupancy_high',   'low',    'Low Footfall',           'Below expected footfall for this time of day.',   'open',         NOW()-INTERVAL '4h')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. INCIDENTS
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO operational_incidents
  (park_id, incident_type, severity, title, description, status, reported_by, created_at)
VALUES
  ('ZP001', 'counter_inactive','medium', 'Queue Overflow at Main Gate',   'Queue extended outside the park boundary during peak hour.', 'open',          'pm-zp001', NOW()-INTERVAL '2h'),
  ('ZP001', 'gate_blocked',    'high',   'Turnstile Malfunction Gate A',  'Turnstile at Gate A jamming intermittently.',                'investigating', 'pm-zp001', NOW()-INTERVAL '5h'),
  ('ZP002', 'custom',          'low',    'Signage Missing at East Entry', 'Direction signs to Ticketing Counter missing.',              'open',          'pm-zp002', NOW()-INTERVAL '1d'),
  ('ZP003', 'custom',          'medium', 'Wet Floor Near Fountain',       'Water spillage near central fountain — slip hazard.',        'resolved',      'pm-zp003', NOW()-INTERVAL '6h'),
  ('ZP004', 'stale_heartbeat', 'medium', 'Scanner Software Outdated',     'Scanner firmware on Entry Scanner A is 2 versions behind.',  'open',          'pm-zp004', NOW()-INTERVAL '3d'),
  ('ZP005', 'counter_inactive','low',    'Counter Understaffed',          'Only 1 of 2 counters operational due to staff absence.',     'open',          'pm-zp005', NOW()-INTERVAL '4h'),
  ('ZP006', 'custom',          'high',   'Electrical Panel Exposed',      'Maintenance panel in Rides Zone left open.',                 'resolved',      'pm-zp006', NOW()-INTERVAL '2d'),
  ('ZP007', 'counter_inactive','low',    'Parking Overflow',              'Visitor parking capacity exceeded, overflow management needed.','open',        'pm-zp007', NOW()-INTERVAL '1h')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. SETTLEMENT PERIODS  (last 3 months per park)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO settlement_periods
  (park_id, period_date, status, locked, expected_rev, actual_rev, variance, notes)
SELECT
  p.id,
  (CURRENT_DATE - INTERVAL '1 month' * m.mo)::date,
  CASE WHEN m.mo = 0 THEN 'open'
       WHEN m.mo = 1 THEN 'submitted'
       ELSE 'approved' END,
  CASE WHEN m.mo >= 2 THEN TRUE ELSE FALSE END,
  p.capacity * 150.0 * 22,   -- rough expected: capacity × avg price × working days
  p.capacity * 150.0 * 22 * (0.92 + random() * 0.12),
  p.capacity * 150.0 * 22 * (random() * 0.05 - 0.02),
  CASE WHEN m.mo = 0 THEN 'Period in progress'
       WHEN m.mo = 1 THEN 'Submitted for approval'
       ELSE 'Approved and locked' END
FROM parks p
CROSS JOIN (VALUES (0),(1),(2)) AS m(mo)
WHERE p.capacity IS NOT NULL
ON CONFLICT (park_id, period_date) DO NOTHING;

-- Set reasonable capacities for parks that may lack them
UPDATE parks SET capacity = 1500 WHERE capacity IS NULL AND id = 'ZP001';
UPDATE parks SET capacity = 1200 WHERE capacity IS NULL AND id = 'ZP002';
UPDATE parks SET capacity = 1000 WHERE capacity IS NULL AND id = 'ZP003';
UPDATE parks SET capacity = 900  WHERE capacity IS NULL AND id = 'ZP004';
UPDATE parks SET capacity = 700  WHERE capacity IS NULL AND id = 'ZP005';
UPDATE parks SET capacity = 600  WHERE capacity IS NULL AND id = 'ZP006';
UPDATE parks SET capacity = 800  WHERE capacity IS NULL AND id = 'ZP007';
