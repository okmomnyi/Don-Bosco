import { NextResponse } from "next/server";
import { sql, type UserRow } from "@/lib/db";
import {
  verifyPassword,
  normalizePhone,
  signSession,
  COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export async function POST(req: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
  const password = body.password ?? "";

  if (!phone || !password) {
    return NextResponse.json(
      { error: "Phone number or password is incorrect." },
      { status: 401 }
    );
  }

  const { rows } = await sql<UserRow>`
    SELECT id, name, phone, password_hash, role, must_change_password, active, created_at
    FROM users
    WHERE phone = ${phone} AND active = true
  `;
  const user = rows[0];

  // Always run a comparison-ish path to avoid leaking which phones exist.
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !ok) {
    return NextResponse.json(
      { error: "Phone number or password is incorrect." },
      { status: 401 }
    );
  }

  const token = await signSession({
    sub: String(user.id),
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.must_change_password,
    },
  });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return res;
}
