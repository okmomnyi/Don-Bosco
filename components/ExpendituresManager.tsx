"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Expenditure manager — the mirror of ContributionsManager, deliberately built
 * to the same shapes and tokens so a treasurer moving between the two pages
 * doesn't have to learn a second interface.
 *
 * Two things it does that the contributions page doesn't:
 *   - it leads with the available balance, because that is the number that
 *     determines whether an expenditure can be recorded at all
 *   - entries are voided with a reason rather than deleted
 */

type ProjectOption = { id: number; name: string; active: boolean };
type Category = { id: number; name: string };

type Expenditure = {
  id: number;
  amount: string;
  payee: string;
  category: string | null;
  project_id: number | null;
  project_name: string | null;
  date: string;
  method: string;
  reference: string | null;
  notes: string | null;
  recorded_by_name: string | null;
};

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

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

function methodLabel(m: string): string {
  return METHODS.find((x) => x.value === m)?.label ?? m;
}

const inputCls =
  "w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none";
const labelCls = "font-mono text-xs uppercase tracking-[0.2em] text-sage";

export default function ExpendituresManager({ today }: { today: string }) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [balance, setBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterQ, setFilterQ] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filteredTotal, setFilteredTotal] = useState("0");
  const [filteredCount, setFilteredCount] = useState(0);
  const [shown, setShown] = useState(0);

  // Form
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Regenerated after each successful save. Sent with the POST so a
  // double-click or a retry on a flaky connection can't record the payment
  // twice — the unique index on idempotency_key rejects the duplicate.
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  );

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/projects");
      const data = await res.json();
      setProjects(data.projects ?? []);
    } catch {
      setError("Couldn't load projects. Reload the page to try again.");
    }
  }, []);

  const loadExpenditures = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterProject) qs.set("projectId", filterProject);
      if (filterQ.trim()) qs.set("q", filterQ.trim());
      if (filterFrom) qs.set("from", filterFrom);
      if (filterTo) qs.set("to", filterTo);

      const res = await fetch(`/api/admin/expenditures?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load expenditure.");
        return;
      }
      setExpenditures(data.expenditures ?? []);
      setFilteredTotal(data.total ?? "0");
      setFilteredCount(data.count ?? 0);
      setShown(data.shown ?? 0);
      setCategories(data.categories ?? []);
      setBalance(data.balance ?? "0");
    } catch {
      setError("Couldn't load expenditure. Check your connection and reload.");
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterQ, filterFrom, filterTo]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadExpenditures();
    }, 250);
    return () => clearTimeout(t);
  }, [loadExpenditures]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.active),
    [projects]
  );
  const filtersActive = Boolean(
    filterProject || filterQ.trim() || filterFrom || filterTo
  );

  const available = Number(balance);
  const overBudget = Number(amount) > 0 && Number(amount) > available;

  function clearFilters() {
    setFilterProject("");
    setFilterQ("");
    setFilterFrom("");
    setFilterTo("");
  }

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/expenditures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payee,
          amount,
          category: category || null,
          projectId: projectId || null,
          date,
          method,
          reference: reference || null,
          notes: notes || null,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't record this payment.");
        return;
      }
      // Keep date, method and project for fast repeated entry.
      setPayee("");
      setAmount("");
      setReference("");
      setNotes("");
      setIdempotencyKey(crypto.randomUUID());
      await loadExpenditures();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Void, not delete. The row stays in the ledger with a reason attached and
   * drops out of every total.
   */
  async function voidEntry(x: Expenditure) {
    setError(null);
    const reason = window.prompt(
      `Void the ${ksh(x.amount)} payment to ${x.payee}?\n\n` +
        "The entry stays in the ledger with your name and this reason against " +
        "it, and comes out of the totals. Say why:"
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setError("A void needs a reason — it's what makes the correction auditable.");
      return;
    }

    const res = await fetch(`/api/admin/ledger/${x.id}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't void that entry.");
      return;
    }
    await loadExpenditures();
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

      {/* Available balance — the constraint on everything below it. */}
      <div className="rounded-4xl border border-ink/10 bg-deep p-8 text-cream md:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
          Available to spend
        </p>
        <p className="mt-6 font-mono text-4xl leading-none md:text-5xl">
          {ksh(balance)}
        </p>
        <p className="mt-3 max-w-sm font-body text-sm text-cream/70">
          Everything contributed, less everything already paid out.
        </p>
      </div>

      {/* Record form */}
      <div className="mt-10 rounded-4xl border border-ink/10 bg-card p-8">
        <h2 className="font-display text-2xl text-ink">Record a payment</h2>
        <form onSubmit={record} className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="x-payee" className={labelCls}>
              Paid to
            </label>
            <input
              id="x-payee"
              className={`mt-2 ${inputCls}`}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              required
              placeholder="Supplier, venue or person"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="x-amount" className={labelCls}>
              Amount (Ksh)
            </label>
            <input
              id="x-amount"
              type="number"
              min="0"
              step="0.01"
              className={`mt-2 ${inputCls}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              aria-describedby={overBudget ? "x-amount-warning" : undefined}
            />
            {overBudget && (
              <p
                id="x-amount-warning"
                className="mt-2 font-body text-xs text-coral"
              >
                That&apos;s more than the {ksh(balance)} available. Record the
                contributions covering it first.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="x-category" className={labelCls}>
              Category
            </label>
            <select
              id="x-category"
              className={`mt-2 ${inputCls}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="x-project" className={labelCls}>
              Project (optional)
            </label>
            <select
              id="x-project"
              className={`mt-2 ${inputCls}`}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">General running costs</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="x-date" className={labelCls}>
              Date
            </label>
            <input
              id="x-date"
              type="date"
              max={today}
              className={`mt-2 ${inputCls}`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="x-method" className={labelCls}>
              Paid by
            </label>
            <select
              id="x-method"
              className={`mt-2 ${inputCls}`}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="x-reference" className={labelCls}>
              Reference (optional)
            </label>
            <input
              id="x-reference"
              className={`mt-2 ${inputCls}`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa code or receipt no."
              autoComplete="off"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="x-notes" className={labelCls}>
              Notes (optional)
            </label>
            <input
              id="x-notes"
              className={`mt-2 ${inputCls}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Matatu hire for the Kilifi trip"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
          >
            {saving ? "Recording…" : "Record payment"}
          </button>
        </form>
      </div>

      {/* List + filters */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">
            {filtersActive ? "Filtered payments" : "Recent payments"}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink/50">
            {filteredCount} {filteredCount === 1 ? "entry" : "entries"} ·{" "}
            {ksh(filteredTotal)} total
            {shown < filteredCount ? ` · showing ${shown}` : ""}
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

      <div className="mt-6 grid gap-4 rounded-3xl border border-ink/10 bg-card p-5 md:grid-cols-4">
        <div>
          <label htmlFor="xf-q" className={labelCls}>
            Payee
          </label>
          <input
            id="xf-q"
            className={`mt-2 ${inputCls}`}
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Name or reference"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="xf-project" className={labelCls}>
            Project
          </label>
          <select
            id="xf-project"
            className={`mt-2 ${inputCls}`}
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {!p.active ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="xf-from" className={labelCls}>
            From
          </label>
          <input
            id="xf-from"
            type="date"
            className={`mt-2 ${inputCls}`}
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="xf-to" className={labelCls}>
            To
          </label>
          <input
            id="xf-to"
            type="date"
            className={`mt-2 ${inputCls}`}
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : expenditures.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">
          {filtersActive
            ? "No payments match these filters."
            : "No payments recorded yet. Record the first one above."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
          {expenditures.map((x) => (
            <li
              key={x.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div>
                <p className="font-body text-sm font-medium text-ink">
                  {x.payee}
                  {x.category && (
                    <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                      {x.category}
                    </span>
                  )}
                  {x.project_name && (
                    <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/70">
                      {x.project_name}
                    </span>
                  )}
                </p>
                <p className="font-mono text-xs text-ink/50">
                  {fmtDate(x.date)} · {methodLabel(x.method)}
                  {x.reference ? ` · ${x.reference}` : ""}
                  {x.recorded_by_name ? ` · by ${x.recorded_by_name}` : ""}
                </p>
                {x.notes && (
                  <p className="mt-1 font-body text-xs text-ink/60">{x.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-sm text-coral">
                  −{ksh(x.amount)}
                </p>
                <button
                  onClick={() => voidEntry(x)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 font-body text-xs text-ink/60 hover:border-coral/50 hover:text-coral"
                >
                  Void
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
