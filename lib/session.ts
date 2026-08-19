import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe session helpers. This module only uses `jose` (Web Crypto) and no
 * Node-only APIs, so it can be imported from `middleware.ts` (Edge runtime) as
 * well as from route handlers and server components.
 *
 * Password hashing and DB access live in `@/lib/auth`, which must NOT be
 * imported from middleware.
 */

/**
 * Cookies are only marked Secure where the connection actually is. The
 * `__Host-` prefix requires Secure, so it can only be used in production —
 * a browser silently rejects a `__Host-` cookie sent over plain http, which
 * would make local development impossible to sign in to.
 */
const SECURE_COOKIES = process.env.NODE_ENV === "production";

/**
 * The `__Host-` prefix binds the cookie to the exact origin: it may not carry a
 * Domain attribute, so a compromised or hostile subdomain cannot overwrite the
 * session cookie for the parent site.
 *
 * Changing this name signs everybody out — the old cookie is simply not read
 * any more. That is a one-off cost, not a recurring one.
 */
export const COOKIE_NAME = SECURE_COOKIES ? "__Host-session" : "session";
export const SESSION_MAX_AGE = 60 * 60 * 2; // 2 hours, in seconds

/**
 * One definition of the cookie's attributes, shared by every route that sets
 * it, so login, logout and change-password cannot drift apart.
 *
 * `sameSite: "strict"` is the whole CSRF defence for the JSON endpoints, and it
 * costs nothing here: there is no cross-site flow into this app: every sign-in
 * starts on one of its own pages.
 *
 * `path: "/"` and the absence of `domain` are not stylistic — `__Host-`
 * requires both.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: SECURE_COOKIES,
  sameSite: "strict",
  path: "/",
} as const;

export type SessionPayload = {
  sub: string; // user id (stringified)
  name: string;
  role: "member" | "admin";
  /**
   * Copy of users.token_version at sign time. `getCurrentUser` compares it
   * against the column and treats a mismatch as unauthenticated, which is how
   * a password change, demotion or deactivation revokes tokens already issued.
   *
   * middleware.ts deliberately does NOT check this — it has no database access
   * on the Edge runtime. Middleware stays a cheap first pass; getCurrentUser is
   * the real gate.
   */
  tokenVersion: number;
};

/** Bound into every token so one minted for another app can't be replayed. */
const ISSUER = "don-bosco";
const AUDIENCE = "don-bosco-app";

const HOW_TO_GENERATE =
  "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"" +
  " and put it in .env.local (or the Vercel project's environment variables).";

/**
 * The signing key. Refuses a missing, short, or placeholder secret in the same
 * spirit as `scripts/init-db.ts` refusing a placeholder POSTGRES_URL — a weak
 * secret here means anyone who has read the public repo can forge an admin
 * session, so it must never silently work.
 */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Add it to .env.local (or the Vercel project's environment variables)."
    );
  }
  if (secret.includes("change-me")) {
    throw new Error(
      "JWT_SECRET is still the placeholder from .env.example.\n" + HOW_TO_GENERATE
    );
  }
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET is too short (${secret.length} characters; 32 is the minimum).\n` +
        HOW_TO_GENERATE
    );
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session token for the given user. */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    name: payload.name,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Verify a session token. Returns the payload, or null if invalid/expired. */
export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "member" && payload.role !== "admin") ||
      typeof payload.tokenVersion !== "number"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role,
      tokenVersion: payload.tokenVersion,
    };
  } catch {
    return null;
  }
}
