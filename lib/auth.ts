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

/**
 * The current signed-in user, read from the session cookie and looked up in
 * the database. Use this in server components and route handlers (Node
 * runtime). Returns null if unauthenticated or the user no longer exists.
 */
export async function getCurrentUser(): Promise<Omit<
  UserRow,
  "password_hash"
> | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const { rows } = await sql<Omit<UserRow, "password_hash">>`
    SELECT id, name, phone, role, must_change_password, active, created_at
    FROM users
    WHERE id = ${Number(session.sub)} AND active = true
  `;
  return rows[0] ?? null;
}

/** Like getCurrentUser, but also returns the raw session payload. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifySession(token);
}

/**
 * Returns the current user if they're an active admin, otherwise null.
 * Convenience for admin API route handlers (middleware already gates the
 * /admin pages, but API routes are matched separately).
 */
export async function requireAdmin(): Promise<Omit<
  UserRow,
  "password_hash"
> | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
