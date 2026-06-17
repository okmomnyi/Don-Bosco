import { NextResponse } from "next/server";
import { sql, CONTRIBUTION_TYPES } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

function isValidType(t: unknown): t is ContributionType {
  return (
    typeof t === "string" &&
    (CONTRIBUTION_TYPES as readonly string[]).includes(t)
  );
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "50");
  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : 50;

  const { rows } = await sql`
    SELECT
      c.id, c.amount::text AS amount, c.type, c.date, c.notes,
      u.name AS member_name, u.id AS user_id
    FROM contributions c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.date DESC, c.id DESC
    LIMIT ${safeLimit}
  `;

  return NextResponse.json({ contributions: rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: {
    userId?: number;
    amount?: number | string;
    type?: string;
    date?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const userId = Number(body.userId);
  const amount = Number(body.amount);
  const { type, date, notes } = body;

  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Select a member." }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Enter an amount greater than zero." },
      { status: 400 }
    );
  }
  if (!isValidType(type)) {
    return NextResponse.json({ error: "Choose a contribution type." }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Choose a date." }, { status: 400 });
  }

  try {
    const { rows } = await sql`
      INSERT INTO contributions (user_id, amount, type, date, recorded_by, notes)
      VALUES (${userId}, ${amount}, ${type}, ${date}, ${admin.id}, ${notes ?? null})
      RETURNING id, amount::text AS amount, type, date, notes
    `;
    return NextResponse.json({ contribution: rows[0] }, { status: 201 });
  } catch (err: unknown) {
    // foreign_key_violation — member doesn't exist
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23503"
    ) {
      return NextResponse.json({ error: "That member doesn't exist." }, { status: 400 });
    }
    throw err;
  }
}
