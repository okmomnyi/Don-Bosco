import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import { checkAdmin, adminDenialRedirect } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** How many entries the page shows. Oldest ones stay in the table. */
const LIMIT = 100;

type AuditRow = {
  id: string;
  actor_id: number | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "ledger.create": "Recorded",
  "ledger.void": "Voided",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * The fields that actually changed between before and after, plus the fields
 * that only exist on one side. Showing the whole JSON blob twice makes the one
 * thing that moved impossible to find.
 */
function diff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): { key: string; from: unknown; to: unknown }[] {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changes: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of Array.from(keys).sort()) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes.push({ key, from, to });
  }
  return changes;
}

export default async function AdminAuditPage() {
  noStore();
  const check = await checkAdmin();
  // An admin still on a temporary password goes to set a real one rather than
  // being bounced to a login page they are already past.
  if (!check.ok) redirect(adminDenialRedirect(check));
  const admin = check.user;

  const [{ rows }, { rows: totals }] = await Promise.all([
    sql<AuditRow>`
      SELECT a.id::text AS id, a.actor_id, u.name AS actor_name, a.action,
             a.entity, a.entity_id, a.before, a.after, a.at
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.at DESC, a.id DESC
      LIMIT ${LIMIT}
    `,
    sql<{ count: number }>`SELECT COUNT(*)::int AS count FROM audit_log`,
  ]);

  const total = totals[0]?.count ?? 0;

  return (
    <main className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <AdminNav name={admin.name} />
        <h1 className="mt-10 font-display text-4xl text-ink md:text-5xl">
          Audit log
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />
        <p className="mt-8 max-w-2xl font-body text-sm leading-relaxed text-ink/70">
          Who changed what, when, and what it was before. Written in the same
          transaction as the change itself, so it cannot disagree with the
          ledger. Nothing here can be edited or removed.
        </p>

        <p className="mt-10 font-mono text-xs text-ink/50">
          {total} {total === 1 ? "entry" : "entries"}
          {total > LIMIT ? ` · showing the most recent ${LIMIT}` : ""}
        </p>

        {rows.length === 0 ? (
          <p className="mt-6 font-body text-sm text-ink/60">
            Nothing recorded yet. The first contribution or payment written
            through the ledger will appear here.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
            {rows.map((row) => {
              const changes = diff(row.before, row.after);
              const isVoid = row.action === "ledger.void";
              return (
                <li key={row.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="font-body text-sm font-medium text-ink">
                      {row.actor_name ?? "A deleted account"}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                          isVoid
                            ? "bg-coral/15 text-coral"
                            : "bg-sage/15 text-sage"
                        }`}
                      >
                        {actionLabel(row.action)}
                      </span>
                      <span className="ml-2 font-mono text-xs text-ink/50">
                        {row.entity}
                        {row.entity_id === null ? "" : ` #${row.entity_id}`}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-ink/50">
                      {fmtWhen(row.at)}
                    </p>
                  </div>

                  {changes.length > 0 && (
                    <dl className="mt-3 grid gap-1.5">
                      {changes.map((c) => (
                        <div
                          key={c.key}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                        >
                          <dt className="font-mono text-xs uppercase tracking-wider text-ink/40">
                            {c.key}
                          </dt>
                          <dd className="font-mono text-xs text-ink/70">
                            {row.before === null ? (
                              <span className="text-sage">
                                {fmtValue(c.to)}
                              </span>
                            ) : (
                              <>
                                <span className="text-coral line-through">
                                  {fmtValue(c.from)}
                                </span>
                                <span className="mx-2 text-ink/30">→</span>
                                <span className="text-sage">
                                  {fmtValue(c.to)}
                                </span>
                              </>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
