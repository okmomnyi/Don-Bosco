-- ============================================================================
-- 003_ledger.sql — replace `contributions` with a two-sided ledger.
--
-- Adds expenditure without breaking any existing contribution row.
-- Idempotent: safe to re-run.
--
-- Runs after sql/002_auth_hardening.sql.
--   npm run db:migrate -- sql/003_ledger.sql
-- (or paste this file into the Neon SQL editor)
--
-- DEPLOY ORDERING: the rename in step 4 is a breaking change for any code
-- still reading `contributions`. Run this migration as part of the same
-- cutover that deploys the ledger-aware code, not hours ahead of it.
--
-- ROLLBACK PLAN: this migration does not drop `contributions`. It renames it
-- to `contributions_legacy` and leaves it untouched. To revert, drop
-- `ledger_entries` and rename it back.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The ledger.
--
-- One row per movement of money, in either direction. `amount` is ALWAYS
-- positive; direction lives in `kind`. `signed_amount` is generated, so the
-- group balance is SUM(signed_amount) and no caller can get the sign wrong.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              SERIAL PRIMARY KEY,

  kind            TEXT NOT NULL CHECK (kind IN ('contribution', 'expenditure')),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0 AND amount <= 99999999.99),
  signed_amount   NUMERIC(12,2) GENERATED ALWAYS AS
                    (CASE WHEN kind = 'contribution' THEN amount ELSE -amount END) STORED,

  -- Who paid in (contributions only).
  user_id         INTEGER REFERENCES users(id) ON DELETE RESTRICT,
  -- Who was paid (expenditures only).
  payee           TEXT,
  category        TEXT,

  project_id      INTEGER REFERENCES projects(id) ON DELETE RESTRICT,

  method          TEXT NOT NULL DEFAULT 'cash'
                    CHECK (method IN ('cash', 'mpesa', 'bank', 'other')),
  reference       TEXT,                -- M-Pesa code, cheque no, receipt no
  date            DATE NOT NULL,
  notes           TEXT,

  recorded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key TEXT,

  -- Entries are never deleted. They are voided, which leaves the row in place
  -- and excludes it from `ledger_live`.
  voided_at       TIMESTAMPTZ,
  voided_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  void_reason     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A contribution is money from a member; an expenditure is money to a payee.
  -- These are mutually exclusive and both are mandatory in their own case.
  CONSTRAINT contribution_has_member
    CHECK (kind <> 'contribution' OR (user_id IS NOT NULL AND payee IS NULL)),
  CONSTRAINT expenditure_has_payee
    CHECK (kind <> 'expenditure' OR (payee IS NOT NULL AND user_id IS NULL)),
  CONSTRAINT void_is_complete
    CHECK ((voided_at IS NULL) = (voided_by IS NULL)),
  CONSTRAINT void_has_reason
    CHECK (voided_at IS NULL OR void_reason IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 2. Indexes.
--
-- Every report filters on date, and most group by project or member. The
-- partial indexes cover the live-rows-only access pattern.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ledger_user_idx
  ON ledger_entries (user_id, date DESC) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS ledger_project_idx
  ON ledger_entries (project_id, date DESC) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS ledger_date_idx
  ON ledger_entries (date DESC, id DESC) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS ledger_kind_idx
  ON ledger_entries (kind) WHERE voided_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_idempotency_idx
  ON ledger_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. `ledger_live` — every report reads THIS, never the base table.
--
-- Makes "forgot to exclude voided rows" structurally impossible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW ledger_live AS
  SELECT * FROM ledger_entries WHERE voided_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill from the old table.
--
-- Only runs if `contributions` is still a base table and the ledger is empty,
-- so re-running the migration is a no-op.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'contributions'
      AND table_type = 'BASE TABLE'
  ) AND NOT EXISTS (SELECT 1 FROM ledger_entries LIMIT 1) THEN

    INSERT INTO ledger_entries
      (kind, amount, user_id, project_id, category, date, notes, recorded_by, created_at)
    SELECT
      'contribution',
      c.amount,
      c.user_id,
      c.project_id,
      c.type,            -- legacy type preserved as the category label
      c.date,
      c.notes,
      c.recorded_by,
      c.created_at
    FROM contributions c;

    RAISE NOTICE 'Backfilled % contribution rows into ledger_entries.',
      (SELECT COUNT(*) FROM ledger_entries);

    ALTER TABLE contributions RENAME TO contributions_legacy;
    RAISE NOTICE 'Renamed contributions -> contributions_legacy (kept as backup).';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Expenditure categories, seeded with what a parish youth group spends on.
--    Admins rename/extend these from the Projects page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO expense_categories (name) VALUES
  ('Transport'), ('Refreshments'), ('Materials & Supplies'),
  ('Venue & Equipment'), ('Charity & Outreach'), ('Bank & M-Pesa charges'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Audit log (audit finding H6). Append-only; no UPDATE or DELETE grants.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,            -- 'ledger.create' | 'ledger.void' | ...
  entity     TEXT NOT NULL,            -- 'ledger_entry' | 'user' | 'project'
  entity_id  INTEGER,
  before     JSONB,
  after      JSONB,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx  ON audit_log (actor_id, at DESC);

-- ---------------------------------------------------------------------------
-- 7. Reporting views. Application code selects from these rather than
--    re-deriving the arithmetic in six different route handlers.
-- ---------------------------------------------------------------------------

-- Per-project economics. `raised` drives the progress bar (contributions only,
-- so it never goes backwards); `spent` and `net` are shown separately.
CREATE OR REPLACE VIEW project_totals AS
  SELECT
    p.id,
    p.name,
    p.active,
    p.target_amount,
    COALESCE(SUM(l.amount) FILTER (WHERE l.kind = 'contribution'), 0) AS raised,
    COALESCE(SUM(l.amount) FILTER (WHERE l.kind = 'expenditure'),  0) AS spent,
    COALESCE(SUM(l.signed_amount), 0)                                 AS net
  FROM projects p
  LEFT JOIN ledger_live l ON l.project_id = p.id
  GROUP BY p.id;

-- Group-wide position. One row.
CREATE OR REPLACE VIEW fund_position AS
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE kind = 'contribution'), 0) AS total_raised,
    COALESCE(SUM(amount) FILTER (WHERE kind = 'expenditure'),  0) AS total_spent,
    COALESCE(SUM(signed_amount), 0)                               AS balance,
    COUNT(*) FILTER (WHERE kind = 'contribution')::int            AS contribution_count,
    COUNT(*) FILTER (WHERE kind = 'expenditure')::int             AS expenditure_count
  FROM ledger_live;

-- Per-member totals (contributions only — members do not spend).
CREATE OR REPLACE VIEW member_totals AS
  SELECT
    u.id,
    COALESCE(SUM(l.amount), 0) AS total,
    COUNT(l.id)::int           AS entry_count
  FROM users u
  LEFT JOIN ledger_live l
    ON l.user_id = u.id AND l.kind = 'contribution'
  GROUP BY u.id;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — run these and confirm before deploying code.
-- ============================================================================
-- Every legacy row made it across, and the totals match to the cent:
--   SELECT
--     (SELECT COUNT(*) FROM contributions_legacy)                    AS legacy_rows,
--     (SELECT COUNT(*) FROM ledger_live WHERE kind='contribution')   AS ledger_rows,
--     (SELECT COALESCE(SUM(amount),0) FROM contributions_legacy)     AS legacy_total,
--     (SELECT total_raised FROM fund_position)                       AS ledger_total;
--
-- Balance starts equal to total raised (nothing spent yet):
--   SELECT * FROM fund_position;
--
-- Once you have run the app against this for a week and are satisfied:
--   DROP TABLE contributions_legacy;
