import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdmin, adminDenialResponse, normalizePhone } from "@/lib/auth";

/**
 * Edit a member (name / phone / role) and/or activate-deactivate them.
 * Body may include any of: { name, phone, role, active }.
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

  // Guard: an admin can't deactivate or demote themselves (avoids lock-out).
  if (id === admin.id && (deactivating || demoting)) {
    return NextResponse.json(
      { error: "You can't deactivate or demote your own admin account." },
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

  // Build the update from only the fields provided.
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    await sql`UPDATE users SET name = ${name} WHERE id = ${id}`;
  }

  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: "Enter a valid Kenyan phone number." },
        { status: 400 }
      );
    }
    try {
      await sql`UPDATE users SET phone = ${phone} WHERE id = ${id}`;
    } catch (err: unknown) {
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
    }
  }

  // A role change or a deactivation bumps token_version, which invalidates
  // every session that user already holds. Without it, a demoted admin keeps
  // working admin credentials until their token expires (up to two hours).
  if (body.role !== undefined) {
    await sql`
      UPDATE users
      SET role = ${body.role}, token_version = token_version + 1
      WHERE id = ${id} AND role <> ${body.role}
    `;
  }

  if (body.active !== undefined) {
    await sql`
      UPDATE users
      SET active = ${body.active}, token_version = token_version + 1
      WHERE id = ${id} AND active <> ${body.active}
    `;
  }

  const { rows } = await sql`
    SELECT id, name, phone, role, active, must_change_password
    FROM users WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  return NextResponse.json({ member: rows[0] });
}

/**
 * Permanently delete a member. Their contributions are removed too
 * (contributions.user_id is ON DELETE CASCADE). Intended for cleaning up
 * wrongly-created accounts — use Deactivate (PATCH) to keep history instead.
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

  // ledger_entries.user_id is ON DELETE RESTRICT, so the database refuses to
  // delete anyone who has contributions. That is the point: a mis-click used to
  // erase a member's entire financial history with no way to reconstruct it.
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
