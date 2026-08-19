import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, type UserRow } from "@/lib/db";
import { COOKIE_NAME, verifySession, type SessionPayload } from "@/lib/session";

export { COOKIE_NAME, SESSION_MAX_AGE, signSession, verifySession } from "@/lib/session";
export type { SessionPayload } from "@/lib/session";
export {
  hashPassword,
  verifyPassword,
  normalizePhone,
  generateTempPassword,
} from "@/lib/crypto";

/** A user record with the password hash stripped. */
export type SafeUser = Omit<UserRow, "password_hash">;

/**
 * The current signed-in user, read from the session cookie and looked up in
 * the database. Use this in server components and route handlers (Node
 * runtime). Returns null if unauthenticated or the user no longer exists.
 *
 * The token's `tokenVersion` must still match `users.token_version`. Anything
 * that should evict live sessions — a password change, a demotion, a
 * deactivation — increments that column, and every session signed before the
 * bump stops authenticating here on its very next request.
 */
export async function getCurrentUser(): Promise<SafeUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const { rows } = await sql<SafeUser>`
    SELECT id, name, phone, role, must_change_password, active, created_at,
           token_version, temp_password_expires_at
    FROM users
    WHERE id = ${Number(session.sub)} AND active = true
  `;
  const user = rows[0];
  if (!user) return null;
  if (user.token_version !== session.tokenVersion) return null;
  return user;
}

/** Like getCurrentUser, but also returns the raw session payload. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySession(token);
}

/** Why an admin-only resource was refused. */
export type AdminDenial =
  | { ok: false; reason: "unauthenticated" }
  | { ok: false; reason: "not-admin" }
  | { ok: false; reason: "must-change-password" };

export type AdminCheck = { ok: true; user: SafeUser } | AdminDenial;

/**
 * Admin gate with the reason attached, so callers can distinguish "you are not
 * an admin" from "you are an admin who is still on a temporary password" and
 * send the second one somewhere useful.
 */
export async function checkAdmin(): Promise<AdminCheck> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  if (user.role !== "admin") return { ok: false, reason: "not-admin" };
  // An account still on its temporary password has proved only that it knows a
  // password an admin read out over the phone. That is not enough for the
  // treasury, so it gets no admin access until a real password is set.
  if (user.must_change_password) {
    return { ok: false, reason: "must-change-password" };
  }
  return { ok: true, user };
}

/**
 * Returns the current user if they're an active admin who has set a real
 * password, otherwise null. Convenience for admin API route handlers
 * (middleware already gates the /admin pages, but API routes are matched
 * separately).
 */
export async function requireAdmin(): Promise<SafeUser | null> {
  const check = await checkAdmin();
  return check.ok ? check.user : null;
}

/** Error code returned to clients that must send the user to set a password. */
export const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";

/** Where a denied admin should be sent. */
export function adminDenialRedirect(denial: AdminDenial): string {
  return denial.reason === "must-change-password"
    ? "/portal/change-password"
    : "/admin/login";
}

/**
 * The standard response for a denied /api/admin/* request. The
 * must-change-password case carries a code so the client can route to the
 * change-password page instead of showing a bare "Forbidden."
 */
export function adminDenialResponse(denial: AdminDenial): NextResponse {
  if (denial.reason === "must-change-password") {
    return NextResponse.json(
      {
        error:
          "Set a real password before using the admin panel. Your account is still on its temporary one.",
        code: PASSWORD_CHANGE_REQUIRED,
        redirectTo: "/portal/change-password",
      },
      { status: 403 }
    );
  }
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}
