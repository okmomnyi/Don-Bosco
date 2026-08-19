"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The combined statement — every movement of money in date order with the
 * running balance beside it. Built to the same shapes and tokens as the
 * contributions and expenditure pages.
 *
 * Money in is sage, money out is coral, and the sign in front of each amount
 * says the same thing again — colour alone should never be the only carrier of
 * meaning.
 */

type Entry = {
  id: number;
  kind: "contribution" | "expenditure";
  amount: string;
  signed_amount: string;
  running_balance: string;
  date: string;
  category: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  project_id: number | null;
  project_name: string | null;
  counterparty: string;
};

type Position = {
  total_raised: string;
  total_spent: string;
  balance: string;
};

function ksh(v: string | number): string {
  return `Ksh ${Number(v).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const inputCls =
  "w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none";
const labelCls = "font-mono text-xs uppercase tracking-[0.2em] text-sage";

export default function StatementView({ today }: { today: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [position, setPosition] = useState<Position>({
    total_raised: "0",
    total_spent: "0",
    balance: "0",
  });
  const [totalIn, setTotalIn] = useState("0");
  const [totalOut, setTotalOut] = useState("0");
  const [count, setCount] = useState(0);
  const [shown, setShown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (kind) qs.set("kind", kind);

      const res = await fetch(`/api/admin/ledger?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load the statement.");
        return;
      }
      setError(null);
      setEntries(data.entries ?? []);
      setPosition(
        data.position ?? { total_raised: "0", total_spent: "0", balance: "0" }
      );
      setTotalIn(data.totalIn ?? "0");
      setTotalOut(data.totalOut ?? "0");
      setCount(data.count ?? 0);
      setShown(data.shown ?? 0);
    } catch {
      setError("Couldn't load the statement. Check your connection and reload.");
    } finally {
      setLoading(false);
    }
  }, [from, to, kind]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const filtersActive = Boolean(from || to || kind);

  function clearFilters() {
    setFrom("");
    setTo("");
    setKind("");
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink"
        >
          {error}
        </p>
      )}

      {/* Where the group stands, whatever the filter below says. */}
      <div className="rounded-4xl border border-ink/10 bg-deep p-8 text-cream md:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
          Closing balance
        </p>
        <p className="mt-6 font-mono text-4xl leading-none md:text-5xl">
          {ksh(position.balance)}
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-cream/10 pt-6">
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
              Total in
            </dt>
            <dd className="mt-2 font-mono text-lg text-cream">
              {ksh(position.total_raised)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs uppercase tracking-[0.2em] text-cream/50">
              Total out
            </dt>
            <dd className="mt-2 font-mono text-lg text-cream">
              {ksh(position.total_spent)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">
            {filtersActive ? "Filtered statement" : "Full statement"}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink/50">
            {count} {count === 1 ? "entry" : "entries"} · {ksh(totalIn)} in ·{" "}
            {ksh(totalOut)} out
            {shown < count ? ` · showing ${shown}` : ""}
          </p>
        </div>
        {filtersActive && (
          <button
            onClick={clearFilters}
            className="rounded-full border border-ink/15 px-4 py-2 font-body text-xs text-ink/70 hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Date range + direction */}
      <div className="mt-6 grid gap-4 rounded-3xl border border-ink/10 bg-card p-5 md:grid-cols-3">
        <div>
          <label htmlFor="s-from" className={labelCls}>
            From
          </label>
          <input
            id="s-from"
            type="date"
            max={today}
            className={`mt-2 ${inputCls}`}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="s-to" className={labelCls}>
            To
          </label>
          <input
            id="s-to"
            type="date"
            max={today}
            className={`mt-2 ${inputCls}`}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="s-kind" className={labelCls}>
            Direction
          </label>
          <select
            id="s-kind"
            className={`mt-2 ${inputCls}`}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Everything</option>
            <option value="contribution">Money in</option>
            <option value="expenditure">Money out</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">
          {filtersActive
            ? "Nothing moved in that period."
            : "Nothing recorded yet."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-3xl border border-ink/10 bg-card">
          <table className="w-full min-w-[42rem] border-collapse">
            <caption className="sr-only">
              Every contribution and payment in date order, with the running
              balance after each one.
            </caption>
            <thead>
              <tr className="border-b border-ink/10">
                <th
                  scope="col"
                  className="px-5 py-3 text-left font-mono text-xs uppercase tracking-[0.2em] text-sage"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-left font-mono text-xs uppercase tracking-[0.2em] text-sage"
                >
                  Counterparty
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-right font-mono text-xs uppercase tracking-[0.2em] text-sage"
                >
                  In
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-right font-mono text-xs uppercase tracking-[0.2em] text-sage"
                >
                  Out
                </th>
                <th
                  scope="col"
                  className="px-5 py-3 text-right font-mono text-xs uppercase tracking-[0.2em] text-sage"
                >
                  Balance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {entries.map((e) => {
                const isIn = e.kind === "contribution";
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-ink/60">
                      {fmtDate(e.date)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-body text-sm font-medium text-ink">
                        {e.counterparty}
                      </p>
                      <p className="font-mono text-xs text-ink/50">
                        {e.project_name ?? e.category ?? "Other"}
                        {e.reference ? ` · ${e.reference}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-sm text-sage">
                      {isIn ? `+${ksh(e.amount)}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-sm text-coral">
                      {isIn ? "" : `−${ksh(e.amount)}`}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-sm text-ink">
                      {ksh(e.running_balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
