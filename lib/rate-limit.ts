import { sql } from "@/lib/db";

/**
 * Login rate limiting, backed by the `login_attempts` table (sql/002).
 *
 * Node-only — it talks to the database, so it must never be imported from
 * middleware.ts (Edge runtime). It is used by the two authentication routes,
 * neither of which middleware imports.
 */

/** Failed attempts allowed against one phone number inside the window. */
export const MAX_FAILURES_PER_PHONE = 8;
/** Failed attempts allowed from one IP inside the window, across all phones. */
export const MAX_FAILURES_PER_IP = 30;
/** How far back failures are counted, in minutes. */
export const WINDOW_MINUTES = 15;

/**
 * Deliberately identical whichever limit was hit — telling an attacker which
 * one tripped tells them whether the phone number is worth more attempts.
 */
export const RATE_LIMITED_MESSAGE =
  `Too many sign-in attempts. Wait ${WINDOW_MINUTES} minutes and try again.`;

/**
 * The caller's IP, taken from the first value of `x-forwarded-for` (the client
 * as seen by Vercel's edge; later entries are proxies). Returns null when the
 * header is absent, e.g. in local development.
 */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const first = forwarded.split(",")[0]?.trim();
  return first ? first.slice(0, 100) : null;
}

/**
 * True if this phone or this IP has failed too often recently.
 *
 * A phone's failures are counted only back to its last *successful* sign-in,
 * which is how a success "clears" the count. Nothing is deleted to do it: the
 * attempt log is the only record of an attack in progress, and an attacker who
 * guesses one password mid-spray should not get to erase the trail behind them.
 */
export async function isRateLimited(
  phone: string,
  ip: string | null
): Promise<boolean> {
  const { rows } = await sql<{ phone_failures: number; ip_failures: number }>`
    SELECT
      (
        SELECT COUNT(*)::int
        FROM login_attempts a
        WHERE a.phone = ${phone}
          AND a.successful = false
          AND a.at > now() - make_interval(mins => ${WINDOW_MINUTES})
          AND a.at > COALESCE(
            (SELECT MAX(s.at) FROM login_attempts s
              WHERE s.phone = ${phone} AND s.successful = true),
            '-infinity'::timestamptz
          )
      ) AS phone_failures,
      (
        SELECT COUNT(*)::int
        FROM login_attempts a
        WHERE ${ip}::text IS NOT NULL
          AND a.ip = ${ip}
          AND a.successful = false
          AND a.at > now() - make_interval(mins => ${WINDOW_MINUTES})
      ) AS ip_failures
  `;

  const phoneFailures = rows[0]?.phone_failures ?? 0;
  const ipFailures = rows[0]?.ip_failures ?? 0;
  return (
    phoneFailures >= MAX_FAILURES_PER_PHONE || ipFailures >= MAX_FAILURES_PER_IP
  );
}

/**
 * Log an attempt that actually reached password verification. Requests turned
 * away by the limiter are not logged: they never tested a password, and logging
 * them would let a retry loop hold a legitimate user out indefinitely.
 */
export async function recordAttempt(
  phone: string,
  ip: string | null,
  successful: boolean
): Promise<void> {
  await sql`
    INSERT INTO login_attempts (phone, ip, successful)
    VALUES (${phone}, ${ip}, ${successful})
  `;
}
