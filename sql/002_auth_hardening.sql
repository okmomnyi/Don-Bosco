-- 002_auth_hardening.sql
--
-- Session revocation, temporary-password expiry, and the login-attempt log that
-- backs rate limiting.
--
-- Idempotent: safe to run more than once. Adds only; drops nothing.
-- Run with:  npm run db:migrate -- sql/002_auth_hardening.sql

BEGIN;

-- Bumped on every password change, role change and deactivation. The value is
-- embedded in the session JWT, so incrementing it invalidates every token
-- already issued for that user — which is what makes a demotion or a
-- deactivation take effect immediately instead of whenever the token expires.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- When the temporary password issued at account creation stops working. NULL
-- means "no expiry", which is what every pre-existing account keeps, so this
-- migration cannot lock anyone out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMPTZ;

-- Every login attempt that reached password verification, successful or not.
-- Two jobs: rate limiting, and being able to see an attack in progress at all.
CREATE TABLE IF NOT EXISTS login_attempts (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT NOT NULL,
  ip         TEXT,
  successful BOOLEAN NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_phone_idx ON login_attempts (phone, at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx    ON login_attempts (ip, at DESC);

COMMIT;
