-- Migration 017: Multi-park ticket seed data
-- Generates 6 months of realistic ticket history (Dec 2025 – May 2026) for all
-- parks that currently have fewer than 50 tickets.
-- Safe to re-run: guarded by the row-count check; all inserts use ON CONFLICT DO NOTHING.

DO $$
DECLARE
  v_park        RECORD;
  v_day         DATE;
  v_dow         INT;        -- 0=Sun … 6=Sat
  v_daily_count INT;
  v_weight      NUMERIC;
  i             INT;
  v_age         VARCHAR(20);
  v_gender      VARCHAR(10);
  v_pay         VARCHAR(20);
  v_source      VARCHAR(20);
  v_qty         INT;
  v_base        NUMERIC(10,2);
  v_cgst        NUMERIC(10,2);
  v_sgst        NUMERIC(10,2);
  v_total       NUMERIC(10,2);
  v_hour        INT;
  v_ts          TIMESTAMPTZ;
  v_ticket_id   VARCHAR(20);
  v_cashier_id  TEXT;
  v_ticket_seq  BIGINT := 0;
  v_existing    INT;

  AGE_CATS      VARCHAR(20)[] := ARRAY['Adult','Child','Toddler','Senior Citizen'];
  GENDERS       VARCHAR(10)[] := ARRAY['Male','Male','Female','Female','Other'];
  PAY_MODES     VARCHAR(20)[] := ARRAY['UPI','UPI','Cash','Card'];
  SOURCES       VARCHAR(20)[] := ARRAY['Counter','Counter','Web','WhatsApp'];
  -- base price per age category
  PRICE_ADULT   NUMERIC := 350;
  PRICE_CHILD   NUMERIC := 200;
  PRICE_TODDLER NUMERIC := 100;
  PRICE_SENIOR  NUMERIC := 150;
  GST_RATE      NUMERIC := 0.05;
BEGIN
  -- Grab any cashier/manager to use as cashier_id
  SELECT id INTO v_cashier_id FROM users
  WHERE role IN ('Cashier','Park Manager','Super Admin')
  ORDER BY role DESC LIMIT 1;

  FOR v_park IN
    SELECT p.id,
           -- relative volume weight per park
           CASE p.id
             WHEN 'ZP001' THEN 1.00
             WHEN 'ZP002' THEN 0.55
             WHEN 'ZP003' THEN 0.42
             WHEN 'ZP004' THEN 0.38
             WHEN 'ZP005' THEN 0.28
             WHEN 'ZP006' THEN 0.25
             WHEN 'ZP007' THEN 0.32
             ELSE 0.30
           END AS weight
    FROM parks p
  LOOP
    -- Skip parks that already have enough data
    SELECT COUNT(*) INTO v_existing FROM tickets WHERE park_id = v_park.id;
    CONTINUE WHEN v_existing >= 50;

    v_weight := v_park.weight;

    -- Dec 2025 → 25 May 2026
    FOR v_day IN
      SELECT d::date FROM generate_series('2025-12-01'::date, '2026-05-25'::date, '1 day'::interval) d
    LOOP
      -- 0=Sun,1=Mon,...,6=Sat in PostgreSQL EXTRACT(DOW)
      v_dow := EXTRACT(DOW FROM v_day);

      -- Weekend multiplier: Sat(6)=1.2, Sun(0)=1.1, weekday=0.5-0.8
      v_daily_count := GREATEST(1, ROUND(
        CASE v_dow
          WHEN 0 THEN (8 + floor(random()*12)) * v_weight * 1.10
          WHEN 6 THEN (8 + floor(random()*12)) * v_weight * 1.20
          WHEN 5 THEN (8 + floor(random()*12)) * v_weight * 0.95  -- Fri
          ELSE        (8 + floor(random()*12)) * v_weight * 0.55
        END
      )::INT);

      FOR i IN 1..v_daily_count LOOP
        -- Pick random attributes
        v_age    := AGE_CATS [1 + floor(random() * array_length(AGE_CATS,  1))::int];
        v_gender := GENDERS  [1 + floor(random() * array_length(GENDERS,   1))::int];
        v_pay    := PAY_MODES[1 + floor(random() * array_length(PAY_MODES, 1))::int];
        v_source := SOURCES  [1 + floor(random() * array_length(SOURCES,   1))::int];
        v_qty    := 1 + floor(random() * 4)::int;  -- 1–4 tickets

        v_base := v_qty * CASE v_age
          WHEN 'Adult'          THEN PRICE_ADULT
          WHEN 'Child'          THEN PRICE_CHILD
          WHEN 'Toddler'        THEN PRICE_TODDLER
          WHEN 'Senior Citizen' THEN PRICE_SENIOR
          ELSE PRICE_ADULT
        END;
        v_cgst  := ROUND(v_base * GST_RATE, 2);
        v_sgst  := ROUND(v_base * GST_RATE, 2);
        v_total := v_base + v_cgst + v_sgst;

        -- Park operating hours 9AM–7PM
        v_hour := 9 + floor(random() * 10)::int;
        v_ts   := (v_day::text || ' ' ||
                   lpad(v_hour::text, 2, '0') || ':' ||
                   lpad(floor(random()*60)::text, 2, '0') || ':' ||
                   lpad(floor(random()*60)::text, 2, '0') ||
                   '+05:30')::timestamptz;

        v_ticket_seq := v_ticket_seq + 1;
        v_ticket_id  := 'TK' || lpad(v_ticket_seq::text, 10, '0');

        INSERT INTO tickets (
          ticket_id, created_at, park_id, age_category, gender, quantity,
          amount, cgst_amount, sgst_amount, total_amount,
          cash_amount, upi_amount, card_amount,
          payment_mode, source, status, cashier_id
        ) VALUES (
          v_ticket_id, v_ts, v_park.id, v_age, v_gender, v_qty,
          v_base, v_cgst, v_sgst, v_total,
          CASE v_pay WHEN 'Cash' THEN v_total ELSE 0 END,
          CASE v_pay WHEN 'UPI'  THEN v_total ELSE 0 END,
          CASE v_pay WHEN 'Card' THEN v_total ELSE 0 END,
          v_pay, v_source, 'Confirmed', v_cashier_id
        )
        ON CONFLICT (ticket_id, age_category) DO NOTHING;

      END LOOP; -- tickets per day
    END LOOP;   -- days

    RAISE NOTICE 'Seeded tickets for park %', v_park.id;
  END LOOP;     -- parks

  -- visitor_demographics (base table — needs explicit refresh)
  INSERT INTO visitor_demographics (recorded_date, park_id, age_group, gender, count)
  SELECT
    DATE(t.created_at),
    t.park_id,
    CASE t.age_category
      WHEN 'Toddler'        THEN '0-12'
      WHEN 'Child'          THEN '13-17'
      WHEN 'Adult'          THEN '18-35'
      WHEN 'Senior Citizen' THEN '60+'
      ELSE '18-35'
    END,
    COALESCE(NULLIF(TRIM(t.gender), ''), 'Unknown'),
    SUM(t.quantity)::int
  FROM tickets t
  WHERE t.status != 'Cancelled'
    AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
  GROUP BY 1, 2, 3, 4
  ON CONFLICT (recorded_date, park_id, age_group, gender)
  DO UPDATE SET count = EXCLUDED.count;

  -- revenue_categories (base table — needs explicit refresh)
  INSERT INTO revenue_categories (date, park_id, category, amount)
  SELECT DATE(t.created_at), t.park_id, 'Tickets', SUM(t.total_amount)
  FROM tickets t
  WHERE t.status != 'Cancelled'
    AND (t.is_reversal IS NULL OR t.is_reversal = FALSE)
  GROUP BY 1, 2
  ON CONFLICT (date, park_id, category)
  DO UPDATE SET amount = EXCLUDED.amount;

  -- quarterly_revenue, monthly_revenue, revenue_trend are views — no insert needed.

  RAISE NOTICE 'Done. Analytics tables refreshed.';
END $$;
