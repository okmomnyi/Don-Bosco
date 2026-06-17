/**
 * Creates (or promotes) an admin account. Use this once to bootstrap the very
 * first administrator, since the admin panel is the only other way to make one.
 *
 * Usage:
 *   tsx scripts/create-admin.ts "Full Name" "0712345678" "a-password"
 *   npm run create-admin -- "Full Name" "0712345678" "a-password"
 *
 * If a user with that phone already exists, they're promoted to admin and
 * their password is reset to the one given.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { sql } from "@vercel/postgres";
import { hashPassword, normalizePhone } from "../lib/crypto";

async function main() {
  const [name, rawPhone, password] = process.argv.slice(2);
  if (!name || !rawPhone || !password) {
    console.error('Usage: tsx scripts/create-admin.ts "Full Name" "0712345678" "password"');
    process.exit(1);
  }
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("POSTGRES_URL is not set. Add it to .env.local.");
  }
  if (url.includes("region.aws.neon.tech") || url.includes("user:password@")) {
    throw new Error(
      "POSTGRES_URL is still the placeholder from .env.example.\n" +
        "Create a database at https://neon.com (or attach Vercel Postgres) and paste the real connection string into .env.local, then run `npm run db:init` first."
    );
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    throw new Error(`"${rawPhone}" is not a valid Kenyan phone number.`);
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const hash = await hashPassword(password);

  const { rows } = await sql`
    INSERT INTO users (name, phone, password_hash, role, must_change_password)
    VALUES (${name}, ${phone}, ${hash}, 'admin', false)
    ON CONFLICT (phone) DO UPDATE
      SET role = 'admin',
          password_hash = EXCLUDED.password_hash,
          must_change_password = false,
          active = true
    RETURNING id, name, phone, role
  `;

  console.log("\n✅ Admin ready:");
  console.log(rows[0]);
  console.log(`\nSign in at /admin/login with phone ${phone}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ create-admin failed:");
    console.error(err);
    process.exit(1);
  });
