import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { HorizonLine, SunMark } from "@/components/Horizon";
import { sql } from "@/lib/db";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Funds & Finance",
  description:
    "How the group is funded and where the money goes. Live totals raised, spent and held, with progress on each project the group is raising for.",
  alternates: { canonical: "/funds-finance" },
  openGraph: {
    title: "Funds & Finance",
    description:
      "How the group is funded and where the money goes. Live totals raised, spent and held, with progress on each project the group is raising for.",
    url: "/funds-finance",
    type: "website",
  },
};

export const dynamic = "force-dynamic";

const sources = [
  "Member registration and monthly subscription at parish level.",
  "On-going group projects.",
  "Sunday's Ksh 20 subscription and Ksh 50 Dominica contribution.",
  "Any profitable venture undertaken by the group.",
];

type FundPosition = {
  raised: number;
  spent: number;
  balance: number;
  goal: number;
  percent: number;
};

const EMPTY_POSITION: FundPosition = {
  raised: 0,
  spent: 0,
  balance: 0,
  goal: 0,
  percent: 0,
};

/**
 * The group's position, read from the `fund_position` view.
 *
 * The percentage stays gross — raised against the goal — because it measures
 * fundraising progress, not cash on hand. Balance answers the other question
 * and is shown as its own figure.
 *
 * Falls back to zeroes if the database isn't reachable or not yet seeded, so
 * the page always renders (e.g. during local dev before `npm run db:init`).
 */
async function getFundPosition(): Promise<FundPosition> {
  noStore();
  try {
    const [pos, goalRow] = await Promise.all([
      sql`SELECT total_raised::float8 AS raised,
                 total_spent::float8  AS spent,
                 balance::float8      AS balance
          FROM fund_position`,
      sql`SELECT value FROM settings WHERE key = 'funds_goal'`,
    ]);
    const raised = Number(pos.rows[0]?.raised ?? 0);
    const spent = Number(pos.rows[0]?.spent ?? 0);
    const balance = Number(pos.rows[0]?.balance ?? 0);
    const goal = Number(goalRow.rows[0]?.value ?? 0);
    const percent = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    return { raised, spent, balance, goal, percent };
  } catch {
    return EMPTY_POSITION;
  }
}

type ProjectProgress = { id: number; name: string; raised: number; target: number };

/**
 * Active projects with how much each has raised, for the per-project bars.
 *
 * `raised` is contributions only, so a bar never runs backwards when the group
 * spends what it raised. This page deliberately does not publish the itemised
 * expenditure list — it is public and indexed, and naming payees and amounts
 * exposes suppliers and invites outsiders to second-guess individual
 * purchases. The itemised statement lives behind the admin portal.
 */
async function getProjectProgress(): Promise<ProjectProgress[]> {
  noStore();
  try {
    const { rows } = await sql`
      SELECT id, name,
             raised::float8 AS raised,
             target_amount::float8 AS target
      FROM project_totals
      WHERE active = true
      ORDER BY name ASC
    `;
    return rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      raised: Number(r.raised),
      target: Number(r.target),
    }));
  } catch {
    return [];
  }
}

function ksh(amount: number): string {
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export default async function FundsFinancePage() {
  const [position, projects] = await Promise.all([
    getFundPosition(),
    getProjectProgress(),
  ]);
  const FUNDS_RAISED_PERCENT = position.percent;

  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Stewardship
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          Funds & Finance
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />

        <div className="mt-16 grid gap-10 md:grid-cols-[1.1fr_1fr]">
          {/* Ledger / progress */}
          <div className="rounded-4xl border border-ink/10 bg-deep p-8 text-cream md:p-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
              Group review
            </p>
            <p className="mt-6 font-display text-6xl leading-none md:text-7xl">
              {FUNDS_RAISED_PERCENT}%
            </p>
            <p className="mt-3 max-w-sm font-body text-sm text-cream/70">
              of the total amount the group expects to raise this period has
              been contributed so far.
            </p>
            <div className="mt-8 h-2 w-full overflow-hidden rounded-full bg-cream/10">
              <div
                className="h-full rounded-full bg-horizon"
                style={{ width: `${FUNDS_RAISED_PERCENT}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-cream/50">
              <span>0%</span>
              <span>100%</span>
            </div>

            {/* Raised, spent and balance as three figures. Percentage above is
                fundraising progress; balance is what the group actually holds. */}
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-cream/10 pt-6">
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
                  Raised
                </dt>
                <dd className="mt-2 font-mono text-lg text-cream">
                  {ksh(position.raised)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
                  Spent
                </dt>
                <dd className="mt-2 font-mono text-lg text-cream">
                  {ksh(position.spent)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
                  Balance
                </dt>
                <dd className="mt-2 font-mono text-lg text-gold">
                  {ksh(position.balance)}
                </dd>
              </div>
            </dl>

            <Link
              href="/portal"
              className="mt-10 inline-block rounded-full bg-cream px-6 py-3 font-body text-sm font-medium text-deep transition-transform hover:scale-105"
            >
              View my contributions
            </Link>
          </div>

          {/* Sources */}
          <div>
            <h2 className="font-display text-2xl text-ink">
              Where it comes from
            </h2>
            <ul className="mt-6 space-y-5">
              {sources.map((item) => (
                <li key={item} className="flex gap-3">
                  <SunMark className="mt-2 shrink-0" />
                  <span className="font-body text-sm leading-relaxed text-ink/75">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-3xl border border-ink/10 bg-card p-6">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-coral">
                Looking up an old record?
              </p>
              <p className="mt-3 font-body text-sm leading-relaxed text-ink/70">
                Personal contribution history used to be looked up by phone
                number for anyone. That&apos;s changing — every member now
                signs in to the Member Portal to see only their own record,
                kept securely and accurately.
              </p>
            </div>
          </div>
        </div>

        {/* Per-project progress */}
        {projects.length > 0 && (
          <div className="mt-20">
            <h2 className="font-display text-2xl text-ink md:text-3xl">
              By project
            </h2>
            <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-ink/70">
              Each effort the group is raising for, and how far along it is.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {projects.map((p) => {
                const hasTarget = p.target > 0;
                const percent = hasTarget
                  ? Math.min(100, Math.round((p.raised / p.target) * 100))
                  : 0;
                return (
                  <div
                    key={p.id}
                    className="rounded-4xl border border-ink/10 bg-card p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-xl text-ink">{p.name}</p>
                      {hasTarget && (
                        <p className="shrink-0 font-mono text-sm text-ink">
                          {percent}%
                        </p>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-sm text-ink/70">
                      {ksh(p.raised)}
                      {hasTarget ? ` of ${ksh(p.target)}` : " raised"}
                    </p>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-horizon"
                        style={{ width: `${hasTarget ? percent : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
