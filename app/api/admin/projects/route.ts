import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdmin, adminDenialResponse } from "@/lib/auth";

export async function GET() {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  // Read the view rather than re-deriving the arithmetic here. `raised` counts
  // contributions only, so a project's progress bar never goes backwards when
  // the group spends the money it raised; `spent` and `net` are separate.
  const { rows } = await sql`
    SELECT
      id,
      name,
      target_amount::text AS target_amount,
      active,
      raised::text AS raised,
      spent::text  AS spent,
      net::text    AS net
    FROM project_totals
    ORDER BY active DESC, name ASC
  `;

  return NextResponse.json({ projects: rows });
}

export async function POST(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

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
