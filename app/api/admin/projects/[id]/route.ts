import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdmin, adminDenialResponse } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
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
    // `Number(null)` is 0, so an explicit null would silently zero the target.
    const target = body.target == null ? NaN : Number(body.target);
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
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  // Ledger entries reference the project with ON DELETE RESTRICT, so the
  // database refuses to delete a project that has money against it. Previously
  // this was ON DELETE SET NULL, which silently orphaned the money: the rows
  // stayed but lost their project and vanished from every per-project report.
  try {
    await sql`DELETE FROM projects WHERE id = ${id}`;
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
            "This project has money recorded against it. Hide it instead of deleting.",
        },
        { status: 409 }
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
