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
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  let body: {
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

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter an amount greater than zero." },
        { status: 400 }
      );
    }
    await sql`UPDATE contributions SET amount = ${amount} WHERE id = ${id}`;
  }
  if (body.type !== undefined) {
    if (!isValidType(body.type)) {
      return NextResponse.json({ error: "Invalid type." }, { status: 400 });
    }
    await sql`UPDATE contributions SET type = ${body.type} WHERE id = ${id}`;
  }
  if (body.date !== undefined) {
    await sql`UPDATE contributions SET date = ${body.date} WHERE id = ${id}`;
  }
  if (body.notes !== undefined) {
    await sql`UPDATE contributions SET notes = ${body.notes || null} WHERE id = ${id}`;
  }

  const { rows } = await sql`
    SELECT id, amount::text AS amount, type, date, notes FROM contributions WHERE id = ${id}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ contribution: rows[0] });
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
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  await sql`DELETE FROM contributions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
