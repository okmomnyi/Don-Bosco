import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Pure auth helpers with no Next.js / DB dependencies, so they can be imported
 * from standalone scripts (e.g. scripts/create-admin.ts) as well as from the
 * app. `lib/auth.ts` re-exports these for use inside the Next runtime.
 */

// bcrypt cost. 12 is roughly 4x the work of 10 — a few hundred milliseconds per
// hash, which is fine for a login form and meaningfully slower to brute-force.
// Note: bcrypt silently truncates the input at 72 bytes, so anything past that
// contributes nothing to the hash.
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * True if a stored hash was made with an older cost factor than we now use.
 * bcrypt hashes look like `$2a$10$<22-char salt><31-char digest>`, so the cost
 * is the two digits after the second `$`.
 */
export function needsRehash(hash: string): boolean {
  const parts = hash.split("$");
  const cost = Number(parts[2]);
  return Number.isInteger(cost) && cost < SALT_ROUNDS;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Normalise a Kenyan phone number to canonical `+254XXXXXXXXX` form so that
 * `0712345678`, `712345678`, `254712345678` and `+254 712 345 678` all match
 * the same stored value. Used at login, signup and migration.
 *
 * Returns null if the input doesn't look like a usable phone number.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (hasPlus && digits.startsWith("254")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("254") && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // National subscriber number should be 9 digits (e.g. 712345678).
  if (digits.length !== 9) return null;
  return `+254${digits}`;
}

/**
 * Alphabet for temporary passwords: lowercase letters and digits with the
 * ambiguous characters removed (no l/1, no o/0), so a temp password can be read
 * aloud over the phone without confusion. Exactly 32 characters, which divides
 * 256 evenly — `byte % 32` is therefore uniform, with no modulo bias.
 */
const TEMP_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 10;

/**
 * A readable but unguessable temporary password, e.g. "youth-k7m2qp9x4e".
 *
 * The old version was `youth-` plus four `Math.random()` digits: a 9,000-value
 * keyspace from a non-cryptographic PRNG whose internal state can be recovered
 * from a handful of observed outputs. This uses `randomBytes` over a 32-symbol
 * alphabet, which is 32^10 (about 2^50) possibilities.
 */
export function generateTempPassword(): string {
  const bytes = randomBytes(TEMP_PASSWORD_LENGTH);
  let out = "";
  for (const b of bytes) {
    out += TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length];
  }
  return `youth-${out}`;
}
