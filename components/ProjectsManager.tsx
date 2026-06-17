"use client";

import { useEffect, useState } from "react";

type Project = {
  id: number;
  name: string;
  target_amount: string;
  active: boolean;
  raised: string;
};

function ksh(v: string | number): string {
  return `Ksh ${Number(v).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function pct(raised: string | number, target: string | number): number {
  const t = Number(target);
  if (t <= 0) return 0;
  return Math.min(100, Math.round((Number(raised) / t) * 100));
}

const inputCls =
  "w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none";
const labelCls = "font-mono text-xs uppercase tracking-[0.2em] text-sage";

export default function ProjectsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Overall group goal
  const [goal, setGoal] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);

  // New project form
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [adding, setAdding] = useState(false);

  // Per-row edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [eName, setEName] = useState("");
  const [eTarget, setETarget] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/admin/projects"),
        fetch("/api/admin/settings"),
      ]);
      const pData = await pRes.json();
      const sData = await sRes.json();
      setProjects(pData.projects ?? []);
      setGoal(sData.fundsGoal ?? "0");
    } catch {
      setError("Couldn't load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGoalSaved(false);
    setGoalSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundsGoal: goal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't save goal.");
        return;
      }
      setGoalSaved(true);
    } finally {
      setGoalSaving(false);
    }
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, target: target || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create project.");
        return;
      }
      setName("");
      setTarget("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return false;
    }
    await load();
    return true;
  }

  async function remove(p: Project) {
    setError(null);
    const msg =
      Number(p.raised) > 0
        ? `Delete "${p.name}"? Its ${ksh(p.raised)} of contributions will be kept but un-tagged from any project.`
        : `Delete "${p.name}"?`;
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/admin/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete project.");
      return;
    }
    await load();
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setEName(p.name);
    setETarget(p.target_amount);
  }

  async function saveEdit(id: number) {
    const ok = await patch(id, { name: eName, target: eTarget || 0 });
    if (ok) setEditingId(null);
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink">
          {error}
        </p>
      )}

      {/* Overall group goal */}
      <div className="rounded-4xl border border-ink/10 bg-card p-8">
        <h2 className="font-display text-2xl text-ink">Group funds goal</h2>
        <p className="mt-2 font-body text-sm text-ink/60">
          The overall target shown on the public Funds &amp; Finance page.
        </p>
        <form onSubmit={saveGoal} className="mt-6 flex flex-wrap items-end gap-4">
          <div className="grow">
            <label htmlFor="goal" className={labelCls}>Target (Ksh)</label>
            <input
              id="goal"
              type="number"
              min="0"
              step="1"
              className={`mt-2 ${inputCls}`}
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                setGoalSaved(false);
              }}
            />
          </div>
          <button
            type="submit"
            disabled={goalSaving}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:opacity-60"
          >
            {goalSaving ? "Saving…" : "Save goal"}
          </button>
          {goalSaved && (
            <span className="font-body text-sm text-sage">Saved ✓</span>
          )}
        </form>
      </div>

      {/* New project */}
      <div className="mt-8 rounded-4xl border border-ink/10 bg-card p-8">
        <h2 className="font-display text-2xl text-ink">Create a project</h2>
        <p className="mt-2 font-body text-sm text-ink/60">
          e.g. Tour, Registration, Dominica. Each gets its own progress bar.
        </p>
        <form onSubmit={addProject} className="mt-6 grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="p-name" className={labelCls}>Project name</label>
            <input id="p-name" className={`mt-2 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Annual Tour" />
          </div>
          <div>
            <label htmlFor="p-target" className={labelCls}>Target (Ksh)</label>
            <input id="p-target" type="number" min="0" step="1" className={`mt-2 ${inputCls}`} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0 = no target" />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:opacity-60 md:col-span-3 md:w-fit"
          >
            {adding ? "Creating…" : "Create project"}
          </button>
        </form>
      </div>

      {/* Project cards */}
      <h2 className="mt-12 font-display text-2xl text-ink">Projects</h2>
      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">No projects yet.</p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {projects.map((p) => {
            const percent = pct(p.raised, p.target_amount);
            const hasTarget = Number(p.target_amount) > 0;
            return (
              <div
                key={p.id}
                className={`rounded-4xl border border-ink/10 bg-card p-6 ${!p.active ? "opacity-60" : ""}`}
              >
                {editingId === p.id ? (
                  <div className="space-y-3">
                    <input className={inputCls} value={eName} onChange={(e) => setEName(e.target.value)} />
                    <input type="number" min="0" step="1" className={inputCls} value={eTarget} onChange={(e) => setETarget(e.target.value)} placeholder="Target (Ksh)" />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(p.id)} className="rounded-full bg-deep px-4 py-2 font-body text-xs text-cream hover:scale-105">Save</button>
                      <button onClick={() => setEditingId(null)} className="rounded-full border border-ink/15 px-4 py-2 font-body text-xs text-ink/70">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-xl text-ink">
                        {p.name}
                        {!p.active && (
                          <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/60">hidden</span>
                        )}
                      </p>
                      {hasTarget && (
                        <p className="shrink-0 font-mono text-sm text-ink">{percent}%</p>
                      )}
                    </div>

                    <p className="mt-2 font-mono text-sm text-ink/70">
                      {ksh(p.raised)}
                      {hasTarget ? ` of ${ksh(p.target_amount)}` : " raised"}
                    </p>

                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-horizon" style={{ width: `${hasTarget ? percent : 0}%` }} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 font-body text-xs">
                      <button onClick={() => startEdit(p)} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 hover:text-ink">Edit</button>
                      <button onClick={() => patch(p.id, { active: !p.active })} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 hover:text-ink">
                        {p.active ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => remove(p)} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/60 hover:border-coral/50 hover:text-coral">Delete</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
