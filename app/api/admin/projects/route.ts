import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Each project with how much has been raised against it.
  const { rows } = await sql`
    SELECT
      p.id,
      p.name,
      p.target_amount::text AS target_amount,
      p.active,
      COALESCE(SUM(c.amount), 0)::text AS raised
    FROM projects p
    LEFT JOIN contributions c ON c.project_id = p.id
    GROUP BY p.id
    ORDER BY p.active DESC, p.name ASC
  `;

  return NextResponse.json({ projects: rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { name?: string; target?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const target = Number(body.target ?? 0);

  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }
  if (!Number.isFinite(target) || target < 0) {
    return NextResponse.json(
      { error: "Target must be zero or a positive number." },
      { status: 400 }
    );
  }

  try {
    const { rows } = await sql`
      INSERT INTO projects (name, target_amount)
      VALUES (${name}, ${target})
      RETURNING id, name, target_amount::text AS target_amount, active
    `;
    return NextResponse.json({ project: rows[0] }, { status: 201 });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "A project with that name already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
