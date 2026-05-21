-- Migration 005: Notifications and workflow events
-- Safe to re-run: all statements use IF NOT EXISTS.

-- ── Notifications ─────────────────────────────────────────────────────────────
-- One row per recipient; targeted (not broadcast).

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL       PRIMARY KEY,
  user_id    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(64)  NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  meta       JSONB        NOT NULL DEFAULT '{}',
  park_id    VARCHAR(10),             -- park context; null = global
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_park
  ON notifications (park_id) WHERE park_id IS NOT NULL;

-- ── Workflow events ────────────────────────────────────────────────────────────
-- Immutable event log for all workflow state transitions.
-- actor_id is not a FK so it survives user deletion.

CREATE TABLE IF NOT EXISTS workflow_events (
  id          SERIAL       PRIMARY KEY,
  event_type  VARCHAR(64)  NOT NULL,
  actor_id    VARCHAR(36),
  actor_email VARCHAR(255),
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  park_id     VARCHAR(10),
  meta        JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_events_type_date
  ON workflow_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_events_entity
  ON workflow_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_park
  ON workflow_events (park_id) WHERE park_id IS NOT NULL;
