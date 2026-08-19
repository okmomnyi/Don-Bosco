import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
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
 * Shortest password we accept. Not exported — a route module may only export
 * handlers and Next's own route config. Kept in step with the same constant in
 * components/ChangePasswordForm.tsx and scripts/create-admin.ts.
 *
 * Note: bcrypt silently truncates the input at 72 bytes, so a longer password
 * is not stronger past that point.
 */
const MIN_PASSWORD_LENGTH = 10;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ip = clientIp(req);
  if (await isRateLimited(user.phone, ip)) {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const newPassword = (body.newPassword ?? "").trim();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const { rows } = await sql<{ password_hash: string }>`
    SELECT password_hash FROM users WHERE id = ${user.id}
  `;
  const currentHash = rows[0]?.password_hash;
  if (!currentHash) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // The current password is required, so that a borrowed phone or a stolen
  // cookie can't be used to lock the real owner out of their own account.
  // Skipped only when the account is still on its temporary password, which
  // was already presented at login moments ago.
  if (!user.must_change_password) {
    const currentPassword = body.currentPassword ?? "";
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 }
      );
    }
    const currentOk = await verifyPassword(currentPassword, currentHash);
    await recordAttempt(user.phone, ip, currentOk);
    if (!currentOk) {
      return NextResponse.json(
        { error: "Your current password is incorrect." },
        { status: 400 }
      );
    }
  }

  // Re-using the same password is a no-op that looks like a successful change,
  // which matters most for someone still on a temporary password.
  if (await verifyPassword(newPassword, currentHash)) {
    return NextResponse.json(
      { error: "That is your current password. Choose a different one." },
      { status: 400 }
    );
  }

  const hash = await hashPassword(newPassword);
  // Bumping token_version signs out every session for this user, so a password
  // reset actually evicts whoever else was holding one.
  const { rows: updated } = await sql<{ token_version: number }>`
    UPDATE users
    SET password_hash = ${hash},
        must_change_password = false,
        temp_password_expires_at = NULL,
        token_version = token_version + 1
    WHERE id = ${user.id}
    RETURNING token_version
  `;

  const res = NextResponse.json({ ok: true });

  // …including the session that made this request, so it is re-issued at the
  // new version. Every *other* browser still holds the old one and is signed
  // out on its next request.
  const token = await signSession({
    sub: String(user.id),
    name: user.name,
    role: user.role,
    tokenVersion: updated[0]?.token_version ?? user.token_version + 1,
  });
  res.cookies.set(COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE,
  });

  return res;
}
