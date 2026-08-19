/**
 * Runs a .sql migration file against POSTGRES_URL.
 *
 * Usage:
 *   npm run db:migrate -- sql/002_auth_hardening.sql
 *   tsx scripts/run-sql.ts sql/002_auth_hardening.sql
 *
 * The file is sent as a single multi-statement query, so a file wrapped in
 * BEGIN/COMMIT is applied atomically. Every migration in sql/ is written to be
 * idempotent, so re-running one is a no-op rather than an error.
 *
 * Requires POSTGRES_URL, in .env.local or the environment.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "@vercel/postgres";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/run-sql.ts <path-to-.sql-file>");
    process.exit(1);
  }

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

  const path = resolve(process.cwd(), file);
  const text = readFileSync(path, "utf8");

  console.log(`Running ${file}…`);
  const client = await db.connect();
  try {
    await client.query(text);
  } finally {
    client.release();
  }
  console.log(`\n✅ ${file} applied.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ migration failed:");
    console.error(err);
    process.exit(1);
  });
