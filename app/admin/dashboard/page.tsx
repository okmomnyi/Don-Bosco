import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

function ksh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const [members, raised, thisMonth, goalRow] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM users WHERE active = true AND role = 'member'`,
    sql`SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM contributions`,
    sql`SELECT COALESCE(SUM(amount), 0)::float8 AS total, COUNT(*)::int AS count
        FROM contributions WHERE date >= date_trunc('month', CURRENT_DATE)`,
    sql`SELECT value FROM settings WHERE key = 'funds_goal'`,
  ]);

  const memberCount = members.rows[0]?.count ?? 0;
  const totalRaised = raised.rows[0]?.total ?? 0;
  const monthTotal = thisMonth.rows[0]?.total ?? 0;
  const monthCount = thisMonth.rows[0]?.count ?? 0;
  const goal = Number(goalRow.rows[0]?.value ?? 0);
  const percent = goal > 0 ? Math.min(100, Math.round((totalRaised / goal) * 100)) : 0;

  return (
    <main className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <AdminNav name={admin.name} />

        <h1 className="mt-10 font-display text-4xl text-ink md:text-5xl">
          Overview
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Funds progress — mirrors the funds-finance ledger block */}
          <div className="rounded-4xl border border-ink/10 bg-deep p-8 text-cream md:row-span-2">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
              Funds goal
            </p>
            <p className="mt-6 font-display text-6xl leading-none md:text-7xl">
              {percent}%
            </p>
            <p className="mt-3 max-w-sm font-body text-sm text-cream/70">
              {ksh(totalRaised)} of {ksh(goal)} raised in total.
            </p>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-cream/10">
              <div
                className="h-full rounded-full bg-horizon"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-cream/50">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Members */}
          <div className="rounded-4xl border border-ink/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
              Active members
            </p>
            <p className="mt-4 font-mono text-4xl text-ink">{memberCount}</p>
          </div>

          {/* This month */}
          <div className="rounded-4xl border border-ink/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
              Contributions this month
            </p>
            <p className="mt-4 font-mono text-4xl text-ink">{ksh(monthTotal)}</p>
            <p className="mt-2 font-body text-sm text-ink/60">
              across {monthCount} {monthCount === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
