import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  let body: { name?: string; target?: number | string; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    try {
      await sql`UPDATE projects SET name = ${name} WHERE id = ${id}`;
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
      ) {
        return NextResponse.json(
          { error: "Another project already uses that name." },
          { status: 409 }
        );
      }
      throw err;
    }
  }

  if (body.target !== undefined) {
    const target = Number(body.target);
    if (!Number.isFinite(target) || target < 0) {
      return NextResponse.json(
        { error: "Target must be zero or a positive number." },
        { status: 400 }
      );
    }
    await sql`UPDATE projects SET target_amount = ${target} WHERE id = ${id}`;
  }

  if (body.active !== undefined) {
    await sql`UPDATE projects SET active = ${body.active} WHERE id = ${id}`;
  }

  const { rows } = await sql`
    SELECT id, name, target_amount::text AS target_amount, active
    FROM projects WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ project: rows[0] });
}

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
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  // Contributions reference the project with ON DELETE SET NULL, so deleting a
  // project keeps the contribution records (they just lose their project tag).
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
