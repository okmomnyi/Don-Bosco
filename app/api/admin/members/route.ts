import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  requireAdmin,
  normalizePhone,
  hashPassword,
  generateTempPassword,
} from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { rows } = await sql`
    SELECT
      u.id,
      u.name,
      u.phone,
      u.role,
      u.active,
      u.must_change_password,
      COALESCE(SUM(c.amount), 0)::text AS total
    FROM users u
    LEFT JOIN contributions c ON c.user_id = u.id
    GROUP BY u.id
    ORDER BY u.active DESC, u.name ASC
  `;

  return NextResponse.json({ members: rows });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { name?: string; phone?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  const role = body.role === "admin" ? "admin" : "member";

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json(
      { error: "Enter a valid Kenyan phone number." },
      { status: 400 }
    );
  }

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);

  try {
    const { rows } = await sql`
      INSERT INTO users (name, phone, password_hash, role, must_change_password)
      VALUES (${name}, ${phone}, ${hash}, ${role}, true)
      RETURNING id, name, phone, role, active, must_change_password
    `;
    return NextResponse.json({ member: rows[0], tempPassword }, { status: 201 });
  } catch (err: unknown) {
    // unique_violation on phone
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "A member with that phone number already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
