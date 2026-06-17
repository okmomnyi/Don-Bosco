import bcrypt from "bcryptjs";

/**
 * Pure auth helpers with no Next.js / DB dependencies, so they can be imported
 * from standalone scripts (e.g. scripts/create-admin.ts) as well as from the
 * app. `lib/auth.ts` re-exports these for use inside the Next runtime.
 */

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
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

/** A readable temporary password, e.g. "youth-4827". */
export function generateTempPassword(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `youth-${n}`;
}
