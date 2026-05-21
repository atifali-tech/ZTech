-- Migration 001: Add token_version to users table
-- Purpose: Enables server-side session invalidation on logout and password change.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
--
-- Run against production:
--   psql -U postgres -d zingparks -f backend/migrations/001_add_token_version.sql
--
-- Backward compatibility:
--   DEFAULT 0 means all existing users start at version 0.
--   Existing JWTs without the `tv` claim are allowed through until they expire
--   naturally (7-day window). After the first login post-upgrade the new token
--   carries tv=0 and is version-checked on every request.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.token_version IS
  'Incremented on logout and password change. JWTs carry this value as claim tv.
   Middleware rejects tokens whose tv differs from the current DB value.';
