import Link from "next/link";
import { HorizonLine, SunMark } from "@/components/Horizon";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const sources = [
  "Member registration and monthly subscription at parish level.",
  "On-going group projects.",
  "Sunday's Ksh 20 subscription and Ksh 50 Dominica contribution.",
  "Any profitable venture undertaken by the group.",
];

/**
 * Live progress: SUM(contributions.amount) / settings.funds_goal * 100.
 * Falls back to 0% if the database isn't reachable or not yet seeded, so the
 * page always renders (e.g. during local dev before `npm run db:init`).
 */
async function getFundsRaisedPercent(): Promise<number> {
  try {
    const [raised, goalRow] = await Promise.all([
      sql`SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM contributions`,
      sql`SELECT value FROM settings WHERE key = 'funds_goal'`,
    ]);
    const total = Number(raised.rows[0]?.total ?? 0);
    const goal = Number(goalRow.rows[0]?.value ?? 0);
    if (goal <= 0) return 0;
    return Math.min(100, Math.round((total / goal) * 100));
  } catch {
    return 0;
  }
}

export default async function FundsFinancePage() {
  const FUNDS_RAISED_PERCENT = await getFundsRaisedPercent();

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
      </div>
    </main>
  );
}
