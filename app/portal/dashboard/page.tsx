import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { HorizonLine, SunMark } from "@/components/Horizon";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentUser } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** A member's own contribution, as read from `ledger_live`. */
type MemberEntry = {
  id: number;
  amount: string; // NUMERIC arrives as a string; it is never parsed to a float
  category: string | null;
  project_id: number | null;
  project_name: string | null;
  date: string;
  notes: string | null;
  method: string;
};

/**
 * Format a NUMERIC-as-string without going through a float. Summing or
 * re-parsing money in JavaScript is what made a member's total drift a cent
 * away from the admin's; the total below is computed by Postgres and formatted
 * here as text.
 */
function ksh(amount: string): string {
  const [whole, fraction = "0"] = amount.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `Ksh ${negative ? "-" : ""}${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  noStore();
  const user = await getCurrentUser();
  if (!user) redirect("/portal");
  if (user.must_change_password) redirect("/portal/change-password");

  // Members see their own contributions only — never group spending, which
  // belongs on a group statement rather than a page that reads as "your money".
  const [{ rows }, { rows: totals }] = await Promise.all([
    sql<MemberEntry>`
      SELECT l.id, l.amount::text AS amount, l.category, l.project_id, l.date::text AS date,
             l.notes, l.method, p.name AS project_name
      FROM ledger_live l
      LEFT JOIN projects p ON p.id = l.project_id
      WHERE l.user_id = ${user.id} AND l.kind = 'contribution'
      ORDER BY l.date DESC, l.id DESC
    `,
    sql<{ total: string }>`
      SELECT total::text AS total FROM member_totals WHERE id = ${user.id}
    `,
  ]);

  // Summed by Postgres over NUMERIC, and kept as a string all the way to the
  // screen, so it always agrees with the figure the admin sees.
  const total = totals[0]?.total ?? "0";

  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
              Member Portal
            </p>
            <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
              Hello, {user.name.split(" ")[0]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {user.role === "admin" && (
              <Link
                href="/admin/dashboard"
                className="rounded-full border border-coral/40 bg-coral/10 px-5 py-2 font-body text-sm text-ink transition-colors hover:bg-coral/20"
              >
                Admin panel
              </Link>
            )}
            <SignOutButton redirectTo="/portal" />
          </div>
        </div>
        <HorizonLine className="mt-8 max-w-xs" />

        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_1.4fr]">
          {/* Your total — ledger styling echoing the funds-finance block */}
          <div className="rounded-4xl border border-ink/10 bg-deep p-8 text-cream md:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
              Your total
            </p>
            <p className="mt-6 font-mono text-4xl leading-none md:text-5xl">
              {ksh(total)}
            </p>
            <p className="mt-3 max-w-sm font-body text-sm text-cream/70">
              contributed across {rows.length}{" "}
              {rows.length === 1 ? "entry" : "entries"} on record.
            </p>
          </div>

          {/* Contribution history */}
          <div>
            <h2 className="font-display text-2xl text-ink">
              Your contributions
            </h2>

            {rows.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-ink/10 bg-card p-6">
                <p className="font-body text-sm leading-relaxed text-ink/70">
                  No contributions recorded yet. As your group leader records
                  them, they&apos;ll appear here.
                </p>
              </div>
            ) : (
              <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-4 px-5 py-4"
                  >
                    <div className="flex gap-3">
                      <SunMark className="mt-1.5 shrink-0" />
                      <div>
                        <p className="font-body text-sm font-medium text-ink">
                          {r.project_name ?? r.category ?? "Other"}
                        </p>
                        <p className="font-mono text-xs text-ink/50">
                          {formatDate(r.date)}
                        </p>
                        {r.notes && (
                          <p className="mt-1 font-body text-xs text-ink/60">
                            {r.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 font-mono text-sm text-ink">
                      {ksh(r.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
