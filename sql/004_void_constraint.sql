-- 004_void_constraint.sql
--
-- Fixes a contradiction between two rules introduced in 003.
--
-- `voided_by` is ON DELETE SET NULL, but the constraint was
--   CHECK ((voided_at IS NULL) = (voided_by IS NULL))
-- which is a biconditional: nulling `voided_by` while `voided_at` stays set
-- violates it. So deleting a user who had ever voided an entry failed with a
-- 23514 that had nothing obviously to do with the delete, and the account
-- became permanently undeletable. For a committee whose officers rotate, that
-- is a trap rather than a safeguard.
--
-- The intent of the original rule was "you cannot mark something voided
-- without recording who did it and why". That intent is kept, in the one
-- direction that matters: void fields may not appear on an entry that is not
-- voided. Losing the *identity* of the voider when their account is deleted is
-- acceptable — `void_reason` still stands, `audit_log` still holds the
-- before/after of the void, and `void_has_reason` still forces a reason.
--
-- Idempotent: safe to run more than once. Adds and replaces; drops no data.
--   npm run db:migrate -- sql/004_void_constraint.sql

BEGIN;

ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS void_is_complete;

-- No void metadata unless the entry is actually voided. `voided_by` may be
-- NULL on a voided entry, but only as the result of the account being removed.
ALTER TABLE ledger_entries
  ADD CONSTRAINT void_is_complete
  CHECK (voided_at IS NOT NULL OR (voided_by IS NULL AND void_reason IS NULL));

COMMIT;
