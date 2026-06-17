import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin, normalizePhone } from "@/lib/auth";

/**
 * Edit a member (name / phone / role) and/or activate-deactivate them.
 * Body may include any of: { name, phone, role, active }.
 */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
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

  // Guard: an admin can't deactivate or demote themselves (avoids lock-out).
  if (id === admin.id && (body.active === false || body.role === "member")) {
    return NextResponse.json(
      { error: "You can't deactivate or demote your own admin account." },
      { status: 400 }
    );
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

  if (body.role !== undefined) {
    const role = body.role === "admin" ? "admin" : "member";
    await sql`UPDATE users SET role = ${role} WHERE id = ${id}`;
  }

  if (body.active !== undefined) {
    await sql`UPDATE users SET active = ${body.active} WHERE id = ${id}`;
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
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid member id." }, { status: 400 });
  }
  if (id === admin.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }

  const { rowCount } = await sql`DELETE FROM users WHERE id = ${id}`;
  if (rowCount === 0) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
