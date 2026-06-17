import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { rows } = await sql`SELECT value FROM settings WHERE key = 'funds_goal'`;
  return NextResponse.json({ fundsGoal: rows[0]?.value ?? "0" });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { fundsGoal?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const goal = Number(body.fundsGoal);
  if (!Number.isFinite(goal) || goal < 0) {
    return NextResponse.json(
      { error: "Goal must be zero or a positive number." },
      { status: 400 }
    );
  }

  await sql`
    INSERT INTO settings (key, value)
    VALUES ('funds_goal', ${String(goal)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;

  return NextResponse.json({ fundsGoal: String(goal) });
}
