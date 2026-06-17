import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const newPassword = (body.newPassword ?? "").trim();
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const hash = await hashPassword(newPassword);
  await sql`
    UPDATE users
    SET password_hash = ${hash}, must_change_password = false
    WHERE id = ${user.id}
  `;

  return NextResponse.json({ ok: true });
}
