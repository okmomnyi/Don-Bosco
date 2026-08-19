import { NextResponse } from "next/server";
import { db, sql } from "@/lib/db";
import {
  checkAdmin,
  adminDenialResponse,
  normalizePhone,
  hashPassword,
  generateTempPassword,
} from "@/lib/auth";

/** Columns safe to read into the audit log — never the password hash. */
const SAFE_COLUMNS = `id, name, phone, role, active, must_change_password`;

/**
 * Edit a member (name / phone / role), activate-deactivate them, or issue a
 * fresh temporary password.
 *
 * Body may include any of: { name, phone, role, active, resetPassword }.
 *
 * The whole thing is one transaction with a single UPDATE (M1). The previous
 * version issued a separate UPDATE per supplied field, so a failure partway
 * through left a half-applied edit — a phone changed but the role not — with
 * no error surfaced to the caller.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);
  const admin = check.user;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }

  let body: {
    name?: string;
    phone?: string;
    role?: string;
    active?: boolean;
    resetPassword?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Validate the role up front against an explicit allowlist. The old code
  // coerced anything that wasn't "admin" to "member", so the self-demotion
  // guard below (which tested for the literal "member") could be walked past
  // with PATCH {"role":"x"}.
  if (body.role !== undefined && body.role !== "admin" && body.role !== "member") {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const demoting = body.role === "member";
  const deactivating = body.active === false;
  const resetting = body.resetPassword === true;

  // Guard: an admin can't deactivate or demote themselves (avoids lock-out).
  if (id === admin.id && (deactivating || demoting)) {
    return NextResponse.json(
      { error: "You can't deactivate or demote your own admin account." },
      { status: 400 }
    );
  }
  // Nor issue themselves a temporary password: it would sign them out and hand
  // them a password meant to be read aloud to somebody else.
  if (id === admin.id && resetting) {
    return NextResponse.json(
      {
        error:
          "To change your own password, use Set your password in the portal. A reset issues a temporary one for someone else.",
      },
      { status: 400 }
    );
  }

  // Guard: never let the last active admin be demoted or deactivated. Without
  // this, two admins can demote each other and recovery needs shell access.
  if (demoting || deactivating) {
    const { rows: adminCount } = await sql<{ n: number }>`
      SELECT COUNT(*)::int AS n
      FROM users
      WHERE role = 'admin' AND active = true AND id <> ${id}
    `;
    if ((adminCount[0]?.n ?? 0) === 0) {
      return NextResponse.json(
        {
          error: demoting
            ? "This is the last active admin — promote someone else first."
            : "This is the last active admin — promote someone else before deactivating them.",
        },
        { status: 400 }
      );
    }
  }

  let name: string | null = null;
  if (body.name !== undefined) {
    name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
  }

  let phone: string | null = null;
  if (body.phone !== undefined) {
    phone = normalizePhone(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid Kenyan phone number." },
        { status: 400 }
      );
    }
  }

  // Hashing is slow, so it happens before the transaction opens rather than
  // holding a row lock for the length of a bcrypt round.
  let tempPassword: string | null = null;
  let tempHash: string | null = null;
  if (resetting) {
    tempPassword = generateTempPassword();
    tempHash = await hashPassword(tempPassword);
  }

  const client = await db.connect();
  try {
    await client.sql`BEGIN`;

    const { rows: beforeRows } = await client.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const before = beforeRows[0];
    if (!before) {
      await client.sql`ROLLBACK`;
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    // One statement. COALESCE leaves any field that wasn't supplied alone, and
    // token_version is bumped only when something happened that should evict
    // that user's live sessions.
    const { rows: afterRows } = await client.query(
      `UPDATE users SET
         name   = COALESCE($2::text, name),
         phone  = COALESCE($3::text, phone),
         role   = COALESCE($4::text, role),
         active = COALESCE($5::boolean, active),
         password_hash            = COALESCE($6::text, password_hash),
         must_change_password     = CASE WHEN $7::boolean THEN true
                                         ELSE must_change_password END,
         temp_password_expires_at = CASE WHEN $7::boolean
                                         THEN now() + interval '7 days'
                                         ELSE temp_password_expires_at END,
         token_version = token_version + CASE
           WHEN $7::boolean THEN 1
           WHEN $4::text IS NOT NULL AND role <> $4::text THEN 1
           WHEN $5::boolean IS NOT NULL AND active <> $5::boolean THEN 1
           ELSE 0 END
       WHERE id = $1
       RETURNING ${SAFE_COLUMNS}`,
      [id, name, phone, body.role ?? null, body.active ?? null, tempHash, resetting]
    );
    const after = afterRows[0];

    await client.sql`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after)
      VALUES (${admin.id}, ${resetting ? "user.reset_password" : "user.update"},
              'user', ${id},
              ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb)
    `;

    await client.sql`COMMIT`;

    // The temporary password is returned exactly once, the same way account
    // creation does it. It is never stored anywhere in readable form.
    return NextResponse.json(
      tempPassword ? { member: after, tempPassword } : { member: after }
    );
  } catch (err: unknown) {
    await client.sql`ROLLBACK`.catch(() => {});
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Another member already uses that phone number." },
        { status: 409 }
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Permanently delete a member. Only possible for someone with no money against
 * their name — ledger_entries.user_id is ON DELETE RESTRICT, which is the whole
 * point: a mis-click used to erase a member's entire financial history.
 * Use Deactivate (PATCH) to retire someone who has contributed.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);
  const admin = check.user;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }

  try {
    const { rowCount } = await sql`DELETE FROM users WHERE id = ${id}`;
    if (rowCount === 0) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23503"
    ) {
      return NextResponse.json(
        {
          error:
            "This member has contributions recorded against them. Deactivate them instead — it keeps the record and removes them from the active list.",
        },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
