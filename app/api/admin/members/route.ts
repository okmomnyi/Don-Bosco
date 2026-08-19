import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  checkAdmin,
  adminDenialResponse,
  normalizePhone,
  hashPassword,
  generateTempPassword,
} from "@/lib/auth";

export async function GET() {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  // member_totals already does the aggregate, and it counts contributions
  // only — so group spending can never reduce what a member is shown as having
  // put in.
  const { rows } = await sql`
    SELECT
      u.id,
      u.name,
      u.phone,
      u.role,
      u.active,
      u.must_change_password,
      mt.total::text AS total
    FROM users u
    JOIN member_totals mt ON mt.id = u.id
    ORDER BY u.active DESC, u.name ASC
  `;

  return NextResponse.json({ members: rows });
}

export async function POST(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

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
    // The temporary password is good for a week. An account that is never
    // activated should not stay sign-in-able on a password an admin read out
    // over the phone once and then forgot about.
    const { rows } = await sql`
      INSERT INTO users (name, phone, password_hash, role, must_change_password,
                         temp_password_expires_at)
      VALUES (${name}, ${phone}, ${hash}, ${role}, true, now() + interval '7 days')
      RETURNING id, name, phone, role, active, must_change_password,
                temp_password_expires_at
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
