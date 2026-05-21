-- Migration 004: Notifications and Workflow Events
-- Safe to re-run: all statements use IF NOT EXISTS.
-- Prerequisites: migrations 001, 002, 003 must already be applied.
--
-- Run against production:
--   psql -U postgres -d zingparks -f backend/migrations/004_notifications.sql

-- ── Notifications ─────────────────────────────────────────────────────────────
-- One row per recipient; targeted (not broadcast). is_read tracks read state.

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL        PRIMARY KEY,
  user_id    VARCHAR(36)   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(64)   NOT NULL,  -- 'refund.requested', 'settlement.submitted', …
  title      VARCHAR(255)  NOT NULL,
  body       TEXT,
  meta       JSONB         NOT NULL DEFAULT '{}',
  park_id    VARCHAR(10),             -- park context; null = global
  is_read    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_park
  ON notifications (park_id) WHERE park_id IS NOT NULL;

-- ── Workflow Events ────────────────────────────────────────────────────────────
-- Immutable event log for all workflow state transitions.
-- actor_id is not a FK so it survives user deletion.

CREATE TABLE IF NOT EXISTS workflow_events (
  id          SERIAL        PRIMARY KEY,
  event_type  VARCHAR(64)   NOT NULL,  -- 'refund.requested', 'settlement.approved', …
  actor_id    VARCHAR(36),             -- user who triggered the event
  actor_email VARCHAR(255),
  entity_type VARCHAR(50),             -- 'refund_request', 'settlement_period', …
  entity_id   VARCHAR(100),            -- stringified entity PK
  park_id     VARCHAR(10),
  meta        JSONB         NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_type_date
  ON workflow_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_events_entity
  ON workflow_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_workflow_events_park
  ON workflow_events (park_id) WHERE park_id IS NOT NULL;
