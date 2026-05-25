-- Migration 016: Golden Park — Jungle Trail (ZP001) Full Demo Data
-- Creates a fully populated "CEO Demo" experience for ZP001.
-- Every tab in the Park Workspace shows real, operational-looking data.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING or explicit guards.
-- Run AFTER migrations 001–015.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENSURE CAPACITY IS SET (ZP001)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE parks SET capacity = 2000 WHERE id = 'ZP001' AND capacity IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADDITIONAL USERS — Corporate Admin + Finance Head + Cashier for ZP001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO users (id, name, email, password_hash, role, role_id, token_version)
VALUES
  ('corp-admin-1',  'Meera Nair',      'corporate@zingparks.com',  '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Corporate Admin', 2, 0),
  ('fin-head-1',    'Rajesh Kumar',    'finance@zingparks.com',    '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Finance Head',    3, 0),
  ('cashier-zp001', 'Priya Sharma',    'cashier.zp001@zingparks.in','$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Cashier',         5, 0),
  ('authority-1',   'D.K. Srivastava', 'authority@zingparks.com',  '$2b$10$zrNSWsUWuCZEoNt3WDdq5uuNgVxBtPHEbzIn7xqJVsjG9lAX9qTKu', 'Authority User',  6, 0)
ON CONFLICT (email) DO NOTHING;

-- Assign cashier to ZP001
INSERT INTO user_parks (user_id, park_id)
SELECT 'cashier-zp001', 'ZP001'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 'cashier-zp001')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADDITIONAL ZONES for ZP001 (upgrade from 3 to 5)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_zones (id, park_id, name, zone_type, is_active) VALUES
  ('zone-zp001-food',    'ZP001', 'Food Court',      'Food',  TRUE),
  ('zone-zp001-rides',   'ZP001', 'Adventure Rides', 'Rides', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ADDITIONAL GATES for ZP001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_gates (id, park_id, zone_id, name, gate_type, is_active, throughput_today) VALUES
  ('gate-zp001-vip',  'ZP001', 'zone-zp001-vip',  'VIP Entry Gate', 'VIP',   TRUE, 85),
  ('gate-zp001-side', 'ZP001', 'zone-zp001-entry','Side Exit Gate',  'Exit',  TRUE, 62)
ON CONFLICT (id) DO NOTHING;

-- Update throughput on existing gates to show realistic activity
UPDATE park_gates SET throughput_today = 847 WHERE id = 'gate-zp001-a' AND throughput_today = 0;
UPDATE park_gates SET throughput_today = 723 WHERE id = 'gate-zp001-b' AND throughput_today = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ADDITIONAL COUNTERS for ZP001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_counters (id, park_id, zone_id, name, counter_type, is_active, op_status) VALUES
  ('ctr-zp001-2',  'ZP001', 'zone-zp001-entry', 'Mobile Ticketing Counter', 'Self-Service', TRUE, 'Active'),
  ('counter-zp001-vip',     'ZP001', 'zone-zp001-vip',   'VIP Counter',              'Ticketing',TRUE, 'Active')
ON CONFLICT (id) DO NOTHING;

UPDATE park_counters SET op_status = 'Active' WHERE park_id = 'ZP001' AND op_status = 'Inactive';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ADDITIONAL DEVICES for ZP001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO park_devices (id, park_id, counter_id, name, device_type, status, last_heartbeat) VALUES
  ('dev-zp001-scan2',  'ZP001', 'ctr-zp001-2', 'QR Scanner #2',      'QR Scanner', 'Online',      NOW() - INTERVAL '3 minutes'),
  ('dev-zp001-print1', 'ZP001', 'ctr-zp001-1', 'Ticket Printer',     'Printer',    'Online',      NOW() - INTERVAL '5 minutes'),
  ('dev-zp001-kiosk1', 'ZP001', NULL,           'Self-Service Kiosk', 'Kiosk',      'Maintenance', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CLOSED SHIFTS for ZP001 (historical, with realistic revenue/variance data)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO shift_sessions
  (id, park_id, counter_id, user_id, status, opened_at, closed_at,
   opening_cash, declared_cash, expected_rev, actual_rev,
   transaction_count, refund_count)
VALUES
  ('shift-zp001-h1', 'ZP001', 'ctr-zp001-1', 'cashier-zp001', 'Closed',
   NOW() - INTERVAL '3 days' + INTERVAL '9 hours',
   NOW() - INTERVAL '3 days' + INTERVAL '18 hours',
   5000, 47200, 47000, 47200, 156, 2),
  ('shift-zp001-h2', 'ZP001', 'ctr-zp001-1', 'cashier-zp001', 'Closed',
   NOW() - INTERVAL '2 days' + INTERVAL '9 hours',
   NOW() - INTERVAL '2 days' + INTERVAL '18 hours',
   5000, 52350, 52400, 52350, 174, 1),
  ('shift-zp001-h3', 'ZP001', 'ctr-zp001-1', 'cashier-zp001', 'Closed',
   NOW() - INTERVAL '1 day' + INTERVAL '9 hours',
   NOW() - INTERVAL '1 day' + INTERVAL '18 hours',
   5000, 61800, 61800, 61800, 206, 3),
  ('shift-zp001-h4', 'ZP001', 'ctr-zp001-2', 'cashier-zp001', 'Closed',
   NOW() - INTERVAL '1 day' + INTERVAL '10 hours',
   NOW() - INTERVAL '1 day' + INTERVAL '17 hours',
   2000, 28600, 28600, 28600, 95, 0)
ON CONFLICT (id) DO NOTHING;

-- Open shift today
INSERT INTO shift_sessions
  (id, park_id, counter_id, user_id, status, opened_at,
   opening_cash, transaction_count)
VALUES
  ('shift-zp001-today', 'ZP001', 'ctr-zp001-1', 'cashier-zp001', 'Open',
   NOW() - INTERVAL '4 hours', 5000, 47)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TICKETS for ZP001 (30 days of sales for Analytics tab)
-- ─────────────────────────────────────────────────────────────────────────────
-- We insert in bulk for each of the past 30 days. Each day gets Adult, Child,
-- Senior Citizen, Toddler tickets in realistic proportions.

DO $$
DECLARE
  d            INTEGER;
  base_date    DATE;
  is_weekend   BOOLEAN;
  adult_cnt    INTEGER;
  child_cnt    INTEGER;
  senior_cnt   INTEGER;
  toddler_cnt  INTEGER;
  adult_price  NUMERIC;
  child_price  NUMERIC;
  senior_price NUMERIC;
  gst_id       INTEGER;
  tid          VARCHAR;
  amt          NUMERIC;
  cgst         NUMERIC;
  sgst         NUMERIC;
  pm           VARCHAR;
BEGIN
  SELECT id INTO gst_id FROM gst_rates WHERE category = 'Entry' LIMIT 1;

  FOR d IN 1..30 LOOP
    base_date  := CURRENT_DATE - d;
    is_weekend := EXTRACT(dow FROM base_date) IN (0, 6);

    adult_cnt   := CASE WHEN is_weekend THEN 60 + (random()*40)::int ELSE 30 + (random()*20)::int END;
    child_cnt   := CASE WHEN is_weekend THEN 45 + (random()*30)::int ELSE 20 + (random()*15)::int END;
    senior_cnt  := CASE WHEN is_weekend THEN 10 + (random()*10)::int ELSE  5 + (random()* 5)::int END;
    toddler_cnt := CASE WHEN is_weekend THEN  8 + (random()* 7)::int ELSE  3 + (random()* 4)::int END;

    adult_price  := CASE WHEN is_weekend THEN 350 ELSE 250 END;
    child_price  := CASE WHEN is_weekend THEN 200 ELSE 150 END;
    senior_price := CASE WHEN is_weekend THEN 175 ELSE 125 END;

    -- Adult
    tid  := 'ZP001-' || to_char(base_date, 'YYYYMMDD') || '-AD';
    amt  := adult_price * adult_cnt;
    cgst := amt * 0.05;  sgst := amt * 0.05;
    pm   := CASE WHEN random() > 0.4 THEN 'UPI' ELSE 'Card' END;
    INSERT INTO tickets (ticket_id, park_id, age_category, quantity, amount, cgst_amount, sgst_amount, total_amount, payment_mode, status, gst_rate_id, created_at)
    VALUES (tid, 'ZP001', 'Adult', adult_cnt, amt, cgst, sgst, amt+cgst+sgst, pm, 'Confirmed', gst_id,
            base_date::timestamptz + INTERVAL '10 hours')
    ON CONFLICT DO NOTHING;

    -- Child
    tid  := 'ZP001-' || to_char(base_date, 'YYYYMMDD') || '-CH';
    amt  := child_price * child_cnt;
    cgst := amt * 0.05;  sgst := amt * 0.05;
    pm   := CASE WHEN random() > 0.5 THEN 'UPI' ELSE 'Cash' END;
    INSERT INTO tickets (ticket_id, park_id, age_category, quantity, amount, cgst_amount, sgst_amount, total_amount, payment_mode, status, gst_rate_id, created_at)
    VALUES (tid, 'ZP001', 'Child', child_cnt, amt, cgst, sgst, amt+cgst+sgst, pm, 'Confirmed', gst_id,
            base_date::timestamptz + INTERVAL '10 hours' + INTERVAL '15 minutes')
    ON CONFLICT DO NOTHING;

    -- Senior Citizen
    tid  := 'ZP001-' || to_char(base_date, 'YYYYMMDD') || '-SR';
    amt  := senior_price * senior_cnt;
    cgst := amt * 0.05;  sgst := amt * 0.05;
    pm   := CASE WHEN random() > 0.5 THEN 'Cash' ELSE 'UPI' END;
    INSERT INTO tickets (ticket_id, park_id, age_category, quantity, amount, cgst_amount, sgst_amount, total_amount, payment_mode, status, gst_rate_id, created_at)
    VALUES (tid, 'ZP001', 'Senior Citizen', senior_cnt, amt, cgst, sgst, amt+cgst+sgst, pm, 'Confirmed', gst_id,
            base_date::timestamptz + INTERVAL '11 hours')
    ON CONFLICT DO NOTHING;

    -- Toddler (free)
    IF toddler_cnt > 0 THEN
      tid := 'ZP001-' || to_char(base_date, 'YYYYMMDD') || '-TD';
      INSERT INTO tickets (ticket_id, park_id, age_category, quantity, amount, cgst_amount, sgst_amount, total_amount, payment_mode, status, gst_rate_id, created_at)
      VALUES (tid, 'ZP001', 'Toddler', toddler_cnt, 0, 0, 0, 0, 'Cash', 'Confirmed', gst_id,
              base_date::timestamptz + INTERVAL '10 hours' + INTERVAL '30 minutes')
      ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. SETTLEMENT PERIODS for ZP001 (last 3 months, one per day for past 7 days)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO settlement_periods (park_id, period_date, status, expected_rev, actual_rev, variance, notes)
VALUES
  -- Last week — mix of approved and open
  ('ZP001', CURRENT_DATE - 6, 'approved',  48200, 47800, -400,  'Minor shortfall, within threshold'),
  ('ZP001', CURRENT_DATE - 5, 'approved',  52400, 52400,    0,  'Balanced'),
  ('ZP001', CURRENT_DATE - 4, 'approved',  61800, 62100,  300,  'Small surplus'),
  ('ZP001', CURRENT_DATE - 3, 'approved',  55000, 54500, -500,  'Variance noted'),
  ('ZP001', CURRENT_DATE - 2, 'submitted', 49200, 48900, -300,  NULL),
  ('ZP001', CURRENT_DATE - 1, 'submitted', 57600, 57600,    0,  NULL),
  ('ZP001', CURRENT_DATE,     'open',      NULL,  NULL,  NULL,  NULL)
ON CONFLICT (park_id, period_date) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RECONCILIATION EXCEPTIONS for ZP001 (linked to approved settlements)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  sp_id1 INTEGER;
  sp_id2 INTEGER;
  sp_id3 INTEGER;
BEGIN
  SELECT id INTO sp_id1 FROM settlement_periods WHERE park_id='ZP001' AND period_date=CURRENT_DATE-6 LIMIT 1;
  SELECT id INTO sp_id2 FROM settlement_periods WHERE park_id='ZP001' AND period_date=CURRENT_DATE-2 LIMIT 1;
  SELECT id INTO sp_id3 FROM settlement_periods WHERE park_id='ZP001' AND period_date=CURRENT_DATE-5 LIMIT 1;

  IF sp_id1 IS NOT NULL THEN
    INSERT INTO reconciliation_exceptions (settlement_id, exception_type, severity, variance, notes, resolved)
    VALUES (sp_id1, 'amount_mismatch', 'medium', -200.00, 'Cash counter declared ₹200 less than system total', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;

  IF sp_id2 IS NOT NULL THEN
    INSERT INTO reconciliation_exceptions (settlement_id, exception_type, severity, variance, notes, resolved)
    VALUES (sp_id2, 'missing_payment', 'high', -950.00, 'UPI transaction TXN-8812 not matched in bank feed', FALSE)
    ON CONFLICT DO NOTHING;
  END IF;

  IF sp_id3 IS NOT NULL THEN
    INSERT INTO reconciliation_exceptions (settlement_id, exception_type, severity, variance, notes, resolved)
    VALUES (sp_id3, 'amount_mismatch', 'low', -1.00, 'Rounding difference on batch settlement', TRUE)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. OPERATIONAL ALERTS for ZP001 (realistic mix)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO operational_alerts
  (park_id, alert_type, severity, title, body, target_type, status, created_at)
SELECT park_id, alert_type, severity, title, body, target_type, status, created_at
FROM (VALUES
  ('ZP001'::varchar, 'device_offline', 'high',   'QR Scanner Offline',
   'dev-zp001-scanner2 has not sent a heartbeat for 18 minutes.',
   'device'::varchar, 'acknowledged'::varchar, NOW() - INTERVAL '25 minutes'),
  ('ZP001', 'shift_variance', 'medium', 'Shift Variance Detected',
   'Morning shift reported ₹200 shortfall at Ticketing Counter.',
   'shift', 'open', NOW() - INTERVAL '2 hours'),
  ('ZP001', 'gate_congested', 'low',    'Main Entry Gate — High Throughput',
   'Gate throughput exceeded 800 scans. Consider opening additional lane.',
   'gate', 'resolved', NOW() - INTERVAL '4 hours')
) AS v(park_id, alert_type, severity, title, body, target_type, status, created_at)
WHERE NOT EXISTS (SELECT 1 FROM operational_alerts WHERE park_id = v.park_id AND alert_type = v.alert_type AND title = v.title);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. INCIDENTS for ZP001
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO operational_incidents
  (park_id, incident_type, severity, title, description, status, reported_by, created_at)
SELECT park_id, incident_type, severity, title, description, status, reported_by, created_at
FROM (VALUES
  ('ZP001'::varchar, 'shift_variance'::varchar,  'medium'::varchar,
   'Cash Variance — Morning Shift',
   'Counter #1 morning shift closed with ₹200 shortfall. Cashier reports possible miscounting.',
   'resolved'::varchar, 'pm-zp001'::varchar, NOW() - INTERVAL '3 days'),
  ('ZP001', 'device_offline',  'high',
   'POS Terminal Reboot Required',
   'POS Terminal at Ticketing Counter went offline. Required manual restart. No revenue impact.',
   'resolved', 'pm-zp001', NOW() - INTERVAL '1 day'),
  ('ZP001', 'counter_inactive','low',
   'Mobile Counter Opened Late',
   'Mobile ticketing counter opened 45 minutes after scheduled time.',
   'closed', 'pm-zp001', NOW() - INTERVAL '2 days')
) AS v(park_id, incident_type, severity, title, description, status, reported_by, created_at)
WHERE NOT EXISTS (SELECT 1 FROM operational_incidents WHERE park_id = v.park_id AND title = v.title);

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. ADDITIONAL PRICING RULES for ZP001 (if not already seeded)
-- Ensures the demo park has complete pricing across all categories + day types.
-- Uses ON CONFLICT DO NOTHING — safe if 015 already seeded them.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  gst_id INTEGER;
  entry_gst INTEGER;
BEGIN
  SELECT id INTO entry_gst FROM gst_rates WHERE category = 'Entry' LIMIT 1;

  -- Only insert if no active rules for ZP001 exist yet
  IF (SELECT COUNT(*) FROM park_pricing_rules WHERE park_id = 'ZP001' AND is_active = TRUE) = 0 THEN
    INSERT INTO park_pricing_rules
      (park_id, category, day_type, base_price, gst_rate_id, is_active, effective_from, created_by)
    VALUES
      ('ZP001','Adult',         'Weekday', 250, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Adult',         'Weekend', 350, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Adult',         'Holiday', 400, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Child',         'Weekday', 150, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Child',         'Weekend', 200, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Child',         'Holiday', 250, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Senior Citizen','Weekday', 125, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Senior Citizen','Weekend', 175, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Senior Citizen','Holiday', 200, entry_gst, TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Toddler',       'Weekday',   0, NULL,       TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Toddler',       'Weekend',   0, NULL,       TRUE, '2025-01-01', 'pm-zp001'),
      ('ZP001','Toddler',       'Holiday',   0, NULL,       TRUE, '2025-01-01', 'pm-zp001');
  END IF;
END$$;
