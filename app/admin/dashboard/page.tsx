import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import { checkAdmin, adminDenialRedirect } from "@/lib/auth";
import { sql } from "@/lib/db";

import type { Metadata } from "next";

// Members' names, phone numbers and contribution figures. Never indexed:
// robots.txt is a request, a robots meta tag is honoured even when the
// URL is reached from a link somewhere else.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

function ksh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function AdminDashboardPage() {
  noStore();
  const check = await checkAdmin();
  // An admin still on a temporary password goes to set a real one rather than
  // being bounced to a login page they are already past.
  if (!check.ok) redirect(adminDenialRedirect(check));
  const admin = check.user;

  const [members, position, thisMonth, goalRow] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM users WHERE active = true AND role = 'member'`,
    sql`SELECT total_raised::float8 AS raised,
               total_spent::float8  AS spent,
               balance::float8      AS balance
        FROM fund_position`,
    // "This month" has to be a Nairobi month. The server runs in UTC, so a bare
    // CURRENT_DATE rolls over at 03:00 EAT — on the 1st, the dashboard would
    // show the previous month's figures for the first three hours of the day.
    sql`SELECT
          COALESCE(SUM(amount) FILTER (WHERE kind = 'contribution'), 0)::float8 AS in_total,
          COALESCE(SUM(amount) FILTER (WHERE kind = 'expenditure'),  0)::float8 AS out_total,
          COUNT(*)::int AS count
        FROM ledger_live
        WHERE date >= date_trunc('month', (now() AT TIME ZONE 'Africa/Nairobi')::date)`,
    sql`SELECT value FROM settings WHERE key = 'funds_goal'`,
  ]);

  const memberCount = members.rows[0]?.count ?? 0;
  const totalRaised = position.rows[0]?.raised ?? 0;
  const totalSpent = position.rows[0]?.spent ?? 0;
  const balance = position.rows[0]?.balance ?? 0;
  const monthIn = thisMonth.rows[0]?.in_total ?? 0;
  const monthOut = thisMonth.rows[0]?.out_total ?? 0;
  const monthCount = thisMonth.rows[0]?.count ?? 0;
  const goal = Number(goalRow.rows[0]?.value ?? 0);
  // The goal percentage measures fundraising progress, so it stays gross.
  // Cash on hand is a different question, answered by the balance card.
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

          {/* Balance — cash on hand. The number the group cares about most. */}
          <div className="rounded-4xl border border-ink/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
              Balance
            </p>
            <p className="mt-4 font-mono text-4xl text-ink">{ksh(balance)}</p>
            <p className="mt-2 font-body text-sm text-ink/60">
              {ksh(totalRaised)} in, {ksh(totalSpent)} out
            </p>
          </div>

          {/* Spent */}
          <div className="rounded-4xl border border-ink/10 bg-card p-8">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sage">
              Total spent
            </p>
            <p className="mt-4 font-mono text-4xl text-ink">{ksh(totalSpent)}</p>
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
              This month
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <p className="font-mono text-4xl text-ink">{ksh(monthIn)}</p>
              <p className="font-body text-sm text-ink/60">in</p>
              <p className="font-mono text-4xl text-ink">{ksh(monthOut)}</p>
              <p className="font-body text-sm text-ink/60">out</p>
            </div>
            <p className="mt-2 font-body text-sm text-ink/60">
              across {monthCount} {monthCount === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
