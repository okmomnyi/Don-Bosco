"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MemberOption = { id: number; name: string; phone: string; active: boolean };
type ProjectOption = { id: number; name: string; active: boolean };
type Contribution = {
  id: number;
  amount: string;
  /** Legacy category label; null on anything recorded since the ledger. */
  type: "subscription" | "dominica" | "project" | "other" | null;
  project_id: number | null;
  project_name: string | null;
  date: string;
  notes: string | null;
  member_name: string;
  user_id: number;
};

const TYPE_LABELS: Record<string, string> = {
  subscription: "Subscription",
  dominica: "Dominica",
  project: "Project",
  other: "Other",
};

/**
 * What to show as a contribution's category: its project, or the legacy label
 * carried over by the ledger migration. New entries have no legacy label at
 * all, so "Other" is the last resort rather than an empty badge.
 */
function categoryLabel(c: Contribution): string {
  return c.project_name ?? (c.type ? TYPE_LABELS[c.type] : null) ?? "Other";
}

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

export default function ContributionsManager({ today }: { today: string }) {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters (for tracking a specific payment)
  const [filterQ, setFilterQ] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filteredTotal, setFilteredTotal] = useState("0");
  const [filteredCount, setFilteredCount] = useState(0);
  const [shownCount, setShownCount] = useState(0);

  // Form
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // One key per entry being typed. It goes with the POST and is regenerated on
  // success, so a double-tap or a retry on a slow connection cannot record the
  // same payment twice.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Per-row void state
  const [voidingId, setVoidingId] = useState<number | null>(null);

  // Members + projects load once (used by the form and the filter dropdown).
  const loadOptions = useCallback(async () => {
    try {
      const [mRes, pRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/projects"),
      ]);
      const mData = await mRes.json();
      const pData = await pRes.json();
      // Inactive members stay in the list. A contribution recorded against
      // someone who was later deactivated still has to be correctable — void
      // and re-record needs them selectable, or the mistake is permanent.
      setMembers(mData.members ?? []);
      setProjects(pData.projects ?? []); // keep all (filter dropdown needs hidden ones too)
    } catch {
      setError("Couldn't load data.");
    }
  }, []);

  // The contributions list re-fetches whenever a filter changes.
  const loadContributions = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterProject) qs.set("projectId", filterProject);
      if (filterQ.trim()) qs.set("q", filterQ.trim());
      if (filterFrom) qs.set("from", filterFrom);
      if (filterTo) qs.set("to", filterTo);
      const res = await fetch(`/api/admin/contributions?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't load contributions.");
        return;
      }
      setContributions(data.contributions ?? []);
      setFilteredTotal(data.total ?? "0");
      setFilteredCount(data.count ?? 0);
      setShownCount(data.shown ?? (data.contributions ?? []).length);
    } catch {
      setError("Couldn't load data.");
    } finally {
      setLoading(false);
    }
  }, [filterProject, filterQ, filterFrom, filterTo]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  // Debounce so typing in the member search doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      loadContributions();
    }, 250);
    return () => clearTimeout(t);
  }, [loadContributions]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.active),
    [projects]
  );
  const filtersActive = Boolean(
    filterProject || filterQ.trim() || filterFrom || filterTo
  );

  function clearFilters() {
    setFilterProject("");
    setFilterQ("");
    setFilterFrom("");
    setFilterTo("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = q
      ? members.filter(
          (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q)
        )
      : members;
    // Active members first; deactivated ones are still reachable below them.
    return [...matches]
      .sort((a, b) => Number(b.active) - Number(a.active))
      .slice(0, 8);
  }, [search, members]);

  function pickMember(m: MemberOption) {
    setMemberId(m.id);
    setSearch(`${m.name} (${m.phone})`);
    setShowList(false);
  }

  async function record(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!memberId) {
      setError("Choose a member from the list.");
      return;
    }
    if (!projectId) {
      setError("Choose a project.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          amount,
          projectId,
          date,
          notes,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't record contribution.");
        return;
      }
      // reset (keep date + project for fast repeated entry)
      setAmount("");
      setNotes("");
      setSearch("");
      setMemberId(null);
      setIdempotencyKey(crypto.randomUUID());
      await loadContributions();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Correct a mistake by voiding the entry and recording the right one.
   *
   * There is no edit and no delete: a financial record that can be changed or
   * removed without trace is not a record. Voiding keeps the row, takes it out
   * of every total, and writes who did it and why to the audit log.
   */
  async function voidContribution(c: Contribution) {
    setError(null);
    const reason = window.prompt(
      `Void ${ksh(c.amount)} from ${c.member_name} on ${fmtDate(c.date)}?

` +
        "The entry is kept and marked voided, not deleted. Give a reason:"
    );
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError("A reason is required to void an entry.");
      return;
    }
    setVoidingId(c.id);
    try {
      const res = await fetch(`/api/admin/ledger/${c.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't void that entry.");
        return;
      }
      await loadContributions();
    } finally {
      setVoidingId(null);
    }
  }

  const noProjects = activeProjects.length === 0;

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink">
          {error}
        </p>
      )}

      {noProjects && (
        <p className="mb-6 rounded-2xl border border-gold/50 bg-gold/15 px-4 py-3 font-body text-sm text-ink">
          You have no active projects yet. Create one on the{" "}
          <a href="/admin/projects" className="font-medium text-coral underline">
            Projects
          </a>{" "}
          page first — contributions are recorded against a project.
        </p>
      )}

      {/* Record form */}
      <div className="rounded-4xl border border-ink/10 bg-card p-8">
        <h2 className="font-display text-2xl text-ink">Record a contribution</h2>
        <form onSubmit={record} className="mt-6 grid gap-5 md:grid-cols-2">
          {/* Searchable member select */}
          <div className="relative md:col-span-2">
            <label htmlFor="c-member" className={labelCls}>Member</label>
            <input
              id="c-member"
              className={`mt-2 ${inputCls}`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setMemberId(null);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
              placeholder="Search by name or phone…"
              autoComplete="off"
            />
            {showList && filtered.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-ink/15 bg-card-solid shadow-lg">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => pickMember(m)}
                      className="block w-full px-4 py-2.5 text-left font-body text-sm text-ink hover:bg-paper"
                    >
                      {m.name}{" "}
                      <span className="font-mono text-xs text-ink/50">{m.phone}</span>
                      {!m.active && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-ink/40">
                          inactive
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="c-amount" className={labelCls}>Amount (Ksh)</label>
            <input id="c-amount" type="number" min="0" step="0.01" className={`mt-2 ${inputCls}`} value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="c-project" className={labelCls}>Project</label>
            <select id="c-project" className={`mt-2 ${inputCls}`} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              <option value="" disabled>Choose a project…</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="c-date" className={labelCls}>Date</label>
            <input id="c-date" type="date" className={`mt-2 ${inputCls}`} value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="c-notes" className={labelCls}>Notes (optional)</label>
            <input id="c-notes" className={`mt-2 ${inputCls}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Sunday collection" />
          </div>

          <button
            type="submit"
            disabled={saving || noProjects}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:opacity-60 md:col-span-2 md:w-fit"
          >
            {saving ? "Recording…" : "Record contribution"}
          </button>
        </form>
      </div>

      {/* Recent + filters */}
      <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">
            {filtersActive ? "Filtered contributions" : "Recent contributions"}
          </h2>
          <p className="mt-1 font-mono text-xs text-ink/50">
            {filteredCount} {filteredCount === 1 ? "entry" : "entries"} ·{" "}
            {ksh(filteredTotal)} total
            {shownCount < filteredCount ? ` · showing ${shownCount}` : ""}
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

      {/* Filter bar */}
      <div className="mt-6 grid gap-4 rounded-3xl border border-ink/10 bg-card p-5 md:grid-cols-4">
        <div>
          <label htmlFor="f-q" className={labelCls}>Member</label>
          <input id="f-q" className={`mt-2 ${inputCls}`} value={filterQ} onChange={(e) => setFilterQ(e.target.value)} placeholder="Name or phone" autoComplete="off" />
        </div>
        <div>
          <label htmlFor="f-project" className={labelCls}>Project</label>
          <select id="f-project" className={`mt-2 ${inputCls}`} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{!p.active ? " (hidden)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className={labelCls}>From</label>
          <input id="f-from" type="date" className={`mt-2 ${inputCls}`} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="f-to" className={labelCls}>To</label>
          <input id="f-to" type="date" className={`mt-2 ${inputCls}`} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : contributions.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">
          {filtersActive ? "No contributions match these filters." : "Nothing recorded yet."}
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
          {contributions.map((c) => (
            <li key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-body text-sm font-medium text-ink">
                      {c.member_name}
                      <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                        {categoryLabel(c)}
                      </span>
                    </p>
                    <p className="font-mono text-xs text-ink/50">
                      {fmtDate(c.date)}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-sm text-ink">{ksh(c.amount)}</p>
                    <button
                      onClick={() => voidContribution(c)}
                      disabled={voidingId === c.id}
                      className="rounded-full border border-ink/15 px-3 py-1.5 font-body text-xs text-ink/60 hover:border-coral/50 hover:text-coral disabled:opacity-50"
                    >
                      {voidingId === c.id ? "Voiding…" : "Void"}
                    </button>
                  </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
