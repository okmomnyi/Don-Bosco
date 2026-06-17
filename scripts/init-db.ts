/**
 * Creates the database schema (users, contributions, settings) and seeds the
 * `funds_goal` setting. Safe to run more than once — every statement uses
 * IF NOT EXISTS / ON CONFLICT DO NOTHING.
 *
 * Run with:  npm run db:init
 *
 * Requires POSTGRES_URL to be set. For local runs, put it in `.env.local`
 * (or run `vercel env pull .env.local` after linking the project).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fall back to .env

import { sql } from "@vercel/postgres";

// The total amount (in Ksh) the group is targeting. Edit before running, or
// change it later from the admin dashboard / the `settings` table.
const FUNDS_GOAL = process.env.FUNDS_GOAL ?? "100000";

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "POSTGRES_URL is not set. Add it to .env.local (or run `vercel env pull .env.local`)."
    );
  }
  if (url.includes("region.aws.neon.tech") || url.includes("user:password@")) {
    throw new Error(
      "POSTGRES_URL is still the placeholder from .env.example.\n" +
        "Create a database at https://neon.com (or attach Vercel Postgres) and paste the real connection string into .env.local."
    );
  }

  console.log("Creating table: users…");
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      phone         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
      must_change_password BOOLEAN NOT NULL DEFAULT true,
      active        BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // `active` is an addition to the base schema so members can be deactivated
  // without deleting their contribution history. Add it if upgrading.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;`;

  console.log("Creating table: contributions…");
  await sql`
    CREATE TABLE IF NOT EXISTS contributions (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount      NUMERIC(10,2) NOT NULL,
      type        TEXT NOT NULL CHECK (type IN ('subscription', 'dominica', 'project', 'other')),
      date        DATE NOT NULL,
      recorded_by INTEGER REFERENCES users(id),
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  console.log("Creating index on contributions(user_id)…");
  await sql`CREATE INDEX IF NOT EXISTS contributions_user_id_idx ON contributions(user_id);`;

  console.log("Creating table: settings…");
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;

  console.log(`Seeding settings.funds_goal = ${FUNDS_GOAL}…`);
  await sql`
    INSERT INTO settings (key, value)
    VALUES ('funds_goal', ${FUNDS_GOAL})
    ON CONFLICT (key) DO NOTHING;
  `;

  console.log("\n✅ Database initialised.");
  console.log(
    "Next: create your first admin from a Node REPL or a one-off insert (see README)."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ init-db failed:");
    console.error(err);
    process.exit(1);
  });
