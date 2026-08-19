import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Same attributes as when it was set, or the browser treats it as a
  // different cookie and the old one survives.
  res.cookies.set(COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
