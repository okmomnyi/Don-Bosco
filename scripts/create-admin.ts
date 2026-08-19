/**
 * Creates (or promotes) an admin account. Use this once to bootstrap the very
 * first administrator, since the admin panel is the only other way to make one.
 *
 * Usage:
 *   tsx scripts/create-admin.ts "Full Name" "0712345678"
 *   npm run create-admin -- "Full Name" "0712345678"
 *
 * The password is prompted for on stdin with echo disabled, so it never lands
 * in shell history or a process listing. In automation, set CI=true and pass it
 * as the third argument instead:
 *   CI=true tsx scripts/create-admin.ts "Full Name" "0712345678" "a-password"
 *
 * If a user with that phone already exists, they're promoted to admin and
 * their password is reset to the one given.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createInterface } from "node:readline";
import { sql } from "@vercel/postgres";
import { hashPassword, normalizePhone } from "../lib/crypto";

/** Kept in step with MIN_PASSWORD_LENGTH in app/api/auth/change-password. */
const MIN_PASSWORD_LENGTH = 10;

/**
 * Read a line from stdin without echoing it. On a terminal this switches to raw
 * mode and consumes keystrokes directly; when stdin is a pipe or a file there is
 * nothing to echo, so one line is read normally.
 */
function readSecret(prompt: string): Promise<string> {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: stdin });
      let line = "";
      rl.once("line", (value) => {
        line = value;
        rl.close();
      });
      rl.once("close", () => resolve(line));
    });
  }

  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    let value = "";

    const finish = (err?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      if (err) reject(err);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        // Enter, or Ctrl-D, ends the entry.
        if (ch === "\r" || ch === "\n" || ch === "\u0004") return finish();
        // Ctrl-C aborts.
        if (ch === "\u0003") return finish(new Error("Cancelled."));
        // Backspace / delete.
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

async function main() {
  const [name, rawPhone, argvPassword] = process.argv.slice(2);
  if (!name || !rawPhone) {
    console.error('Usage: tsx scripts/create-admin.ts "Full Name" "0712345678"');
    console.error("The password is prompted for; it is not passed on the command line.");
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

  // A password on argv lands in shell history and `ps` output, so it is only
  // honoured under CI=true where there is no terminal to prompt on.
  if (argvPassword && process.env.CI !== "true") {
    throw new Error(
      "Don't pass the password as an argument — it is recorded in your shell history.\n" +
        "Re-run without it and type it at the prompt, or set CI=true if this is an automated run."
    );
  }

  const password =
    argvPassword && process.env.CI === "true"
      ? argvPassword
      : await readSecret(`Password for ${name} (not shown): `);

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
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
