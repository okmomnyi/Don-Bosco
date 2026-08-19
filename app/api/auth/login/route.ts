import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { sql, type UserRow } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  normalizePhone,
  signSession,
  COOKIE_NAME,
  SESSION_MAX_AGE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth";
import {
  clientIp,
  isRateLimited,
  recordAttempt,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

/**
 * A throwaway hash to compare against when the phone number isn't registered,
 * so the "no such user" path pays the same bcrypt cost as the real one.
 * Without it an unregistered number answers in about a millisecond against the
 * ~300ms of a real comparison, which enumerates exactly which parish numbers
 * have accounts.
 *
 * Kicked off at module load (not awaited) so it is normally already resolved
 * by the time the first request needs it, and it is generated at the same cost
 * factor as real hashes so the two paths take the same time.
 */
const dummyHash = hashPassword(randomBytes(32).toString("hex"));

const INVALID_CREDENTIALS = "Phone number or password is incorrect.";

export async function POST(req: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  const password = body.password ?? "";
  const ip = clientIp(req);

  if (!phone || !password) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  if (await isRateLimited(phone, ip)) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const { rows } = await sql<UserRow>`
    SELECT id, name, phone, password_hash, role, must_change_password, active,
           created_at, token_version, temp_password_expires_at
    FROM users
    WHERE phone = ${phone} AND active = true
  `;
  const user = rows[0];

  // Always run a real bcrypt comparison so both branches cost the same.
  const ok = await verifyPassword(
    password,
    user?.password_hash ?? (await dummyHash)
  );

  if (!user || !ok) {
    await recordAttempt(phone, ip, false);
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  // The password was right, so this counts as a successful attempt whatever
  // happens next — it clears the phone's failure count.
  await recordAttempt(phone, ip, true);

  // Opportunistically upgrade a hash made at an older cost factor. This is the
  // only moment the plaintext is available, and it is what eventually removes
  // the timing difference between an old account (cost 10, ~90ms) and a new or
  // non-existent one (cost 12, ~370ms). Failure here must never block a valid
  // sign-in, so it is logged and swallowed.
  if (needsRehash(user.password_hash)) {
    try {
      const upgraded = await hashPassword(password);
      await sql`UPDATE users SET password_hash = ${upgraded} WHERE id = ${user.id}`;
    } catch (err) {
      console.error("[login] could not re-hash password for user", user.id, err);
    }
  }

  // A temporary password stops working after its expiry. Checked only once the
  // password has been verified, so an outsider can't discover which accounts
  // are sitting on an unused temporary password.
  if (
    user.must_change_password &&
    user.temp_password_expires_at !== null &&
    new Date(user.temp_password_expires_at).getTime() <= Date.now()
  ) {
    return NextResponse.json(
      {
        error:
          "That temporary password has expired. Ask a group admin to issue you a new one.",
      },
      { status: 401 }
    );
  }

  const token = await signSession({
    sub: String(user.id),
    name: user.name,
    role: user.role,
    tokenVersion: user.token_version,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
  });

  res.cookies.set(COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });

  return res;
}
