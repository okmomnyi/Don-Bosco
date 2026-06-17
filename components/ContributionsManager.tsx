"use client";

import { useEffect, useMemo, useState } from "react";

type MemberOption = { id: number; name: string; phone: string; active: boolean };
type Contribution = {
  id: number;
  amount: string;
  type: "subscription" | "dominica" | "project" | "other";
  date: string;
  notes: string | null;
  member_name: string;
  user_id: number;
};

const TYPES = [
  { value: "subscription", label: "Subscription" },
  { value: "dominica", label: "Dominica" },
  { value: "project", label: "Project" },
  { value: "other", label: "Other" },
] as const;

const TYPE_LABELS: Record<Contribution["type"], string> = {
  subscription: "Subscription",
  dominica: "Dominica",
  project: "Project",
  other: "Other",
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

export default function ContributionsManager({ today }: { today: string }) {
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState<number | null>(null);
  const [showList, setShowList] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<Contribution["type"]>("subscription");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Per-row edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eAmount, setEAmount] = useState("");
  const [eType, setEType] = useState<Contribution["type"]>("subscription");
  const [eDate, setEDate] = useState(today);
  const [eNotes, setENotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/contributions?limit=100"),
      ]);
      const mData = await mRes.json();
      const cData = await cRes.json();
      setMembers((mData.members ?? []).filter((m: MemberOption) => m.active));
      setContributions(cData.contributions ?? []);
    } catch {
      setError("Couldn't load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members
      .filter((m) => m.name.toLowerCase().includes(q) || m.phone.includes(q))
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
    setSaving(true);
    try {
      const res = await fetch("/api/admin/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId, amount, type, date, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't record contribution.");
        return;
      }
      // reset (keep date + type for fast repeated entry)
      setAmount("");
      setNotes("");
      setSearch("");
      setMemberId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError(null);
    const res = await fetch(`/api/admin/contributions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete.");
      return;
    }
    await load();
  }

  function startEdit(c: Contribution) {
    setEditingId(c.id);
    setEAmount(c.amount);
    setEType(c.type);
    setEDate(c.date.slice(0, 10));
    setENotes(c.notes ?? "");
  }

  async function saveEdit(id: number) {
    setError(null);
    const res = await fetch(`/api/admin/contributions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: eAmount, type: eType, date: eDate, notes: eNotes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    setEditingId(null);
    await load();
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink">
          {error}
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
            <label htmlFor="c-type" className={labelCls}>Type</label>
            <select id="c-type" className={`mt-2 ${inputCls}`} value={type} onChange={(e) => setType(e.target.value as Contribution["type"])}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
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
            disabled={saving}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:opacity-60 md:col-span-2 md:w-fit"
          >
            {saving ? "Recording…" : "Record contribution"}
          </button>
        </form>
      </div>

      {/* Recent */}
      <h2 className="mt-12 font-display text-2xl text-ink">Recent contributions</h2>
      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : contributions.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
          {contributions.map((c) => (
            <li key={c.id} className="px-5 py-4">
              {editingId === c.id ? (
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr_auto] md:items-center">
                  <input type="number" min="0" step="0.01" className={inputCls} value={eAmount} onChange={(e) => setEAmount(e.target.value)} />
                  <select className={inputCls} value={eType} onChange={(e) => setEType(e.target.value as Contribution["type"])}>
                    {TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                  <input type="date" className={inputCls} value={eDate} onChange={(e) => setEDate(e.target.value)} />
                  <input className={inputCls} value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notes" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(c.id)} className="rounded-full bg-deep px-4 py-2 font-body text-xs text-cream hover:scale-105">Save</button>
                    <button onClick={() => setEditingId(null)} className="rounded-full border border-ink/15 px-4 py-2 font-body text-xs text-ink/70">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-body text-sm font-medium text-ink">
                      {c.member_name}
                      <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-sage">
                        {TYPE_LABELS[c.type]}
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
                      onClick={() => startEdit(c)}
                      className="rounded-full border border-ink/15 px-3 py-1.5 font-body text-xs text-ink/60 hover:text-ink"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-full border border-ink/15 px-3 py-1.5 font-body text-xs text-ink/60 hover:border-coral/50 hover:text-coral"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
