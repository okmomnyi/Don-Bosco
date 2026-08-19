import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { checkAdmin, adminDenialResponse } from "@/lib/auth";
import {
  parseAmount,
  parseDate,
  parseOptionalId,
  parseMethod,
  optionalText,
  requiredText,
  escapeLike,
  recordExpenditure,
  errorResponse,
} from "@/lib/ledger";

/**
 * Money out — the mirror of the contributions route.
 *
 * Two differences, both deliberate: a `payee` takes the place of a member id,
 * because spending recorded against a member's user_id would silently reduce
 * their contribution total; and `projectId` is optional, because general
 * running costs (M-Pesa charges, stationery) belong to no project.
 */
export async function GET(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);

  try {
    const params = new URL(req.url).searchParams;
    const limitRaw = params.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 100;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 && limit <= 1000 ? limit : 100;

    const where: string[] = ["l.kind = 'expenditure'"];
    const values: (string | number)[] = [];

    const projectId = parseOptionalId(params.get("projectId"));
    if (projectId !== undefined) {
      values.push(projectId);
      where.push(`l.project_id = $${values.length}`);
    }
    const category = (params.get("category") ?? "").trim();
    if (category) {
      values.push(category);
      where.push(`l.category = $${values.length}`);
    }
    const q = (params.get("q") ?? "").trim();
    if (q) {
      values.push(`%${escapeLike(q)}%`);
      where.push(
        `(l.payee ILIKE $${values.length} ESCAPE '\\' OR l.reference ILIKE $${values.length} ESCAPE '\\')`
      );
    }
    const from = params.get("from");
    if (from) {
      values.push(parseDate(from));
      where.push(`l.date >= $${values.length}`);
    }
    const to = params.get("to");
    if (to) {
      values.push(parseDate(to));
      where.push(`l.date <= $${values.length}`);
    }
    const whereSql = `WHERE ${where.join(" AND ")}`;

    const totalsText = `
      SELECT COALESCE(SUM(l.amount), 0)::text AS total, COUNT(*)::int AS count
      FROM ledger_live l
      ${whereSql}
    `;
    const listText = `
      SELECT
        l.id, l.amount::text AS amount, l.payee, l.category, l.date::text AS date, l.notes,
        l.method, l.reference,
        l.project_id, p.name AS project_name,
        rb.name AS recorded_by_name
      FROM ledger_live l
      LEFT JOIN projects p ON p.id = l.project_id
      LEFT JOIN users rb ON rb.id = l.recorded_by
      ${whereSql}
      ORDER BY l.date DESC, l.id DESC
      LIMIT $${values.length + 1}
    `;

    // The form needs the category list and the current balance, so they come
    // back with the list rather than costing a second round trip.
    const [totals, list, categories, position] = await Promise.all([
      sql.query(totalsText, values),
      sql.query(listText, [...values, safeLimit]),
      sql`SELECT id, name FROM expense_categories WHERE active = true ORDER BY name ASC`,
      sql`SELECT balance::text AS balance FROM fund_position`,
    ]);

    return NextResponse.json({
      expenditures: list.rows,
      total: totals.rows[0]?.total ?? "0",
      count: totals.rows[0]?.count ?? 0,
      shown: list.rows.length,
      categories: categories.rows,
      balance: position.rows[0]?.balance ?? "0",
    });
  } catch (err) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  const check = await checkAdmin();
  if (!check.ok) return adminDenialResponse(check);
  const admin = check.user;

  let body: {
    payee?: string;
    amount?: number | string;
    category?: string;
    projectId?: number | string | null;
    date?: string;
    method?: string;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const entry = await recordExpenditure(
      {
        payee: requiredText(body.payee, "Who was paid"),
        amount: parseAmount(body.amount),
        category: optionalText(body.category, 100),
        projectId: parseOptionalId(body.projectId),
        date: parseDate(body.date),
        method: parseMethod(body.method),
        reference: optionalText(body.reference, 100),
        notes: optionalText(body.notes),
        idempotencyKey: optionalText(body.idempotencyKey, 100),
      },
      admin.id
    );
    return NextResponse.json({ expenditure: entry }, { status: 201 });
  } catch (err) {
    const { body: errBody, status } = errorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
