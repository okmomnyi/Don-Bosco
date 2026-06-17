import { sql, db, createPool } from "@vercel/postgres";

/**
 * Thin wrapper around @vercel/postgres.
 *
 * `sql` is a tagged-template query helper that parameterises values safely:
 *   const { rows } = await sql`SELECT * FROM users WHERE phone = ${phone}`;
 *
 * It reads the connection string from the `POSTGRES_URL` env var automatically
 * (set by Vercel Postgres / Neon, or in `.env.local` for local development).
 *
 * Re-exported here so the rest of the app imports from a single place
 * (`@/lib/db`) rather than reaching into the package directly.
 */
export { sql, db, createPool };

/** Shape of a row in the `users` table. */
export type UserRow = {
  id: number;
  name: string;
  phone: string;
  password_hash: string;
  role: "member" | "admin";
  must_change_password: boolean;
  active: boolean;
  created_at: string;
};

/** Shape of a row in the `contributions` table. */
export type ContributionRow = {
  id: number;
  user_id: number;
  amount: string; // NUMERIC comes back as a string from pg
  type: "subscription" | "dominica" | "project" | "other";
  date: string;
  recorded_by: number | null;
  notes: string | null;
  created_at: string;
};

export const CONTRIBUTION_TYPES = [
  "subscription",
  "dominica",
  "project",
  "other",
] as const;
