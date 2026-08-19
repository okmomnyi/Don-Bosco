import { db } from "@vercel/postgres";

/**
 * Shared ledger logic — validation, transactional writes, audit logging.
 *
 * Everything that moves money goes through this module. Route handlers parse
 * and authorise; they don't do arithmetic and they don't touch
 * `ledger_entries` directly.
 *
 * Invariants enforced here (the database enforces the rest):
 *   - amounts are positive, ≤ 2dp, within NUMERIC(12,2)
 *   - dates are real calendar dates within a sane window
 *   - the group balance can never go negative
 *   - every write lands in `audit_log` in the SAME transaction
 */

export const PAYMENT_METHODS = ["cash", "mpesa", "bank", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type LedgerKind = "contribution" | "expenditure";

/** Max a single entry may be, matching NUMERIC(12,2). */
const MAX_AMOUNT = 99_999_999.99;

/** Reject dates before the group started keeping digital records. */
const MIN_DATE = "2015-01-01";

export class LedgerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "LedgerError";
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Parse a money value and return it as a **string**, not a number.
 *
 * Rejects NaN, Infinity, zero, negatives, more than two decimal places, and
 * anything above NUMERIC(12,2). Takes strings so that "1500.50" from a form
 * body works, but refuses "1e7" — exponent notation in a money field is
 * always a mistake or an attack, never a treasurer typing.
 *
 * The return value stays textual all the way into the NUMERIC column, so no
 * amount in this system is ever an IEEE-754 float. The bounds check is the one
 * place a number is used, and only to compare against a constant.
 */
export function parseAmount(raw: unknown): string {
  if (raw === undefined || raw === null || raw === "") {
    throw new LedgerError("Enter an amount.");
  }
  // Validate the textual form, not the parsed number. Checking decimal places
  // after Number() can't work — 1500.005 and 1500.01 are indistinguishable
  // once they're floats. This also rejects "1e7", "-50" and " 12 34" outright.
  const s = String(raw).trim();
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) {
    throw new LedgerError(
      "Enter the amount in plain digits, with at most two decimal places."
    );
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    throw new LedgerError("Enter an amount greater than zero.");
  }
  if (n > MAX_AMOUNT) {
    throw new LedgerError("That amount is too large.");
  }
  return s;
}

/** Format a NUMERIC-as-string for display in an error message. */
function formatKsh(amount: string): string {
  const [whole, fraction = "00"] = amount.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `Ksh ${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

/**
 * Validate a YYYY-MM-DD date string.
 *
 * The round-trip check catches "2026-02-31", which passes the regex and which
 * Postgres would reject with an unhandled 500.
 */
export function parseDate(raw: unknown): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new LedgerError("Choose a valid date.");
  }
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) {
    throw new LedgerError("That date doesn't exist.");
  }
  if (raw < MIN_DATE) {
    throw new LedgerError("That date is too far in the past.");
  }
  if (raw > todayInNairobi()) {
    throw new LedgerError("You can't record an entry dated in the future.");
  }
  return raw;
}

/**
 * Today's date in Africa/Nairobi, as YYYY-MM-DD.
 *
 * Serverless runs in UTC; Nairobi is UTC+3. Using `toISOString()` would file
 * anything entered between midnight and 03:00 EAT under the previous day.
 * `en-CA` formats as ISO.
 */
export function todayInNairobi(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Trim to null, and cap length so a paste-bomb can't fill the column. */
export function optionalText(raw: unknown, max = 500): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > max) throw new LedgerError(`That text is too long (max ${max}).`);
  return s;
}

export function requiredText(raw: unknown, field: string, max = 200): string {
  const s = optionalText(raw, max);
  if (!s) throw new LedgerError(`${field} is required.`);
  return s;
}

/**
 * Parse an optional positive integer id from a query string or body.
 *
 * Written explicitly because `Number(null) === 0` and `Number("") === 0` both
 * pass `Number.isInteger` — the bug that emptied the contributions list.
 * Returns undefined for absent, throws for present-but-invalid.
 */
export function parseOptionalId(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new LedgerError("Invalid id.");
  }
  return n;
}

export function parseRequiredId(raw: unknown, field: string): number {
  const n = parseOptionalId(raw);
  if (n === undefined) throw new LedgerError(`${field} is required.`);
  return n;
}

export function parseMethod(raw: unknown): PaymentMethod {
  if (raw === undefined || raw === null || raw === "") return "cash";
  if (!(PAYMENT_METHODS as readonly string[]).includes(String(raw))) {
    throw new LedgerError("Invalid payment method.");
  }
  return raw as PaymentMethod;
}

/** Escape LIKE metacharacters so a search for "%" doesn't match everything. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type ContributionInput = {
  userId: number;
  /** Canonical decimal string from parseAmount — never a float. */
  amount: string;
  projectId?: number;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  idempotencyKey: string | null;
};

type ExpenditureInput = {
  payee: string;
  /** Canonical decimal string from parseAmount — never a float. */
  amount: string;
  category: string | null;
  projectId?: number;
  date: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  idempotencyKey: string | null;
};

/**
 * Advisory lock id for the fund balance. Any transaction that could move the
 * balance takes this first, so two concurrent expenditures can't each read the
 * same balance and both pass the sufficient-funds check.
 */
const BALANCE_LOCK = 4820_1;

export async function recordContribution(
  input: ContributionInput,
  actorId: number
) {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;

    const { rows } = await client.sql`
      INSERT INTO ledger_entries
        (kind, amount, user_id, project_id, date, method, reference, notes,
         recorded_by, idempotency_key)
      VALUES
        ('contribution', ${input.amount}, ${input.userId},
         ${input.projectId ?? null}, ${input.date}, ${input.method},
         ${input.reference}, ${input.notes}, ${actorId}, ${input.idempotencyKey})
      RETURNING id, kind, amount::text AS amount, user_id, project_id,
                date::text AS date, method, reference, notes, created_at
    `;
    const entry = rows[0];

    await client.sql`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, after)
      VALUES (${actorId}, 'ledger.create', 'ledger_entry', ${entry.id},
              ${JSON.stringify(entry)}::jsonb)
    `;

    await client.sql`COMMIT`;
    return entry;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Record money going out.
 *
 * Unlike a contribution this is checked against available funds inside the
 * transaction: you cannot spend money the group does not have. The advisory
 * lock serialises concurrent spends so the check can't be raced.
 */
export async function recordExpenditure(
  input: ExpenditureInput,
  actorId: number
) {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`SELECT pg_advisory_xact_lock(${BALANCE_LOCK})`;

    // The comparison happens in SQL against NUMERIC, so a cent is never lost
    // rounding the balance through a JS float on the way to the check.
    const { rows: pos } = await client.sql<{
      balance: string;
      sufficient: boolean;
    }>`
      SELECT balance::text AS balance,
             (balance >= ${input.amount}::numeric) AS sufficient
      FROM fund_position
    `;

    if (!pos[0]?.sufficient) {
      throw new LedgerError(
        `Only ${formatKsh(pos[0]?.balance ?? "0")} is available. ` +
          "Record the contributions that cover this first.",
        409
      );
    }

    const { rows } = await client.sql`
      INSERT INTO ledger_entries
        (kind, amount, payee, category, project_id, date, method, reference,
         notes, recorded_by, idempotency_key)
      VALUES
        ('expenditure', ${input.amount}, ${input.payee}, ${input.category},
         ${input.projectId ?? null}, ${input.date}, ${input.method},
         ${input.reference}, ${input.notes}, ${actorId}, ${input.idempotencyKey})
      RETURNING id, kind, amount::text AS amount, payee, category, project_id,
                date::text AS date, method, reference, notes, created_at
    `;
    const entry = rows[0];

    await client.sql`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, after)
      VALUES (${actorId}, 'ledger.create', 'ledger_entry', ${entry.id},
              ${JSON.stringify(entry)}::jsonb)
    `;

    await client.sql`COMMIT`;
    return entry;
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Void an entry. Nothing is ever deleted from the ledger — a mistake is
 * corrected by voiding the wrong row (with a reason) and recording the right
 * one, which is what an external auditor expects to see.
 *
 * Voiding a contribution can push the balance negative if the money has since
 * been spent, so that case is refused: reverse the spending first.
 */
export async function voidEntry(
  id: number,
  reason: string,
  actorId: number
) {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    await client.sql`SELECT pg_advisory_xact_lock(${BALANCE_LOCK})`;

    const { rows: before } = await client.sql`
      SELECT id, kind, amount::text AS amount, user_id, payee, project_id,
             date::text AS date, notes, voided_at
      FROM ledger_entries WHERE id = ${id}
    `;
    const entry = before[0];
    if (!entry) throw new LedgerError("Entry not found.", 404);
    if (entry.voided_at) throw new LedgerError("That entry is already voided.", 409);

    if (entry.kind === "contribution") {
      // Same NUMERIC-in-SQL comparison as recordExpenditure: removing this
      // contribution must not push the group balance below zero.
      const { rows: pos } = await client.sql<{ still_solvent: boolean }>`
        SELECT (balance - ${entry.amount}::numeric) >= 0 AS still_solvent
        FROM fund_position
      `;
      if (!pos[0]?.still_solvent) {
        throw new LedgerError(
          "Voiding this contribution would leave the balance negative — " +
            "the money has already been spent. Void the spending first.",
          409
        );
      }
    }

    const { rows: after } = await client.sql`
      UPDATE ledger_entries
      SET voided_at = now(), voided_by = ${actorId}, void_reason = ${reason}
      WHERE id = ${id}
      RETURNING id, kind, amount::text AS amount, voided_at, void_reason
    `;

    await client.sql`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after)
      VALUES (${actorId}, 'ledger.void', 'ledger_entry', ${id},
              ${JSON.stringify(entry)}::jsonb, ${JSON.stringify(after[0])}::jsonb)
    `;

    await client.sql`COMMIT`;
    return after[0];
  } catch (err) {
    await client.sql`ROLLBACK`.catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Map a thrown error to a JSON response body + status. */
export function errorResponse(err: unknown): { body: { error: string }; status: number } {
  if (err instanceof LedgerError) {
    return { body: { error: err.message }, status: err.status };
  }
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "23503") {
      return { body: { error: "That member or project doesn't exist." }, status: 400 };
    }
    if (code === "23505") {
      return { body: { error: "That entry has already been recorded." }, status: 409 };
    }
    if (code === "23514") {
      return { body: { error: "That entry isn't valid." }, status: 400 };
    }
  }
  console.error("[ledger] unhandled error:", err);
  return { body: { error: "Something went wrong. Please try again." }, status: 500 };
}
