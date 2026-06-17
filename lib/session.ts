import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-safe session helpers. This module only uses `jose` (Web Crypto) and no
 * Node-only APIs, so it can be imported from `middleware.ts` (Edge runtime) as
 * well as from route handlers and server components.
 *
 * Password hashing and DB access live in `@/lib/auth`, which must NOT be
 * imported from middleware.
 */

export const COOKIE_NAME = "session";
export const SESSION_MAX_AGE = 60 * 60 * 2; // 2 hours, in seconds

export type SessionPayload = {
  sub: string; // user id (stringified)
  name: string;
  role: "member" | "admin";
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session token for the given user. */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
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
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "member" && payload.role !== "admin")
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      role: payload.role,
    };
  } catch {
    return null;
  }
}
