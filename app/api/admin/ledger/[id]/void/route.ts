import { NextResponse } from "next/server";
import { checkAdmin, adminDenialResponse } from "@/lib/auth";
import { parseRequiredId, requiredText, voidEntry, errorResponse } from "@/lib/ledger";

/**
 * Void a ledger entry. This is the only way to undo one.
 *
 * There is deliberately no DELETE handler anywhere on the ledger: a financial
 * record that can be removed without trace is not a record. Voiding keeps the
 * row, drops it out of `ledger_live` and therefore out of every total, and
 * writes before/after to `audit_log` in the same transaction.
 *
 * The reason is mandatory, because "why did the March figure change" is the
 * question this whole design exists to be able to answer.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);
  const admin = check.user;

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const id = parseRequiredId(params.id, "An entry id");
    const reason = requiredText(body.reason, "A reason for voiding", 300);
    const entry = await voidEntry(id, reason, admin.id);
    return NextResponse.json({ entry });
  } catch (err) {
    const { body: errBody, status } = errorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
