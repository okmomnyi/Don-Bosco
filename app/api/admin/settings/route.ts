import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdmin, adminDenialResponse } from "@/lib/auth";

export async function GET() {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  const { rows } = await sql`SELECT value FROM settings WHERE key = 'funds_goal'`;
  return NextResponse.json({ fundsGoal: rows[0]?.value ?? "0" });
}

export async function PATCH(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  let body: { fundsGoal?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // `Number(null)` is 0, so an explicit null would silently zero the goal.
  const goal = body.fundsGoal == null ? NaN : Number(body.fundsGoal);
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
