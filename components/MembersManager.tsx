"use client";

import { useEffect, useState } from "react";

type Member = {
  id: number;
  name: string;
  phone: string;
  role: "member" | "admin";
  active: boolean;
  must_change_password: boolean;
  total: string;
};

function ksh(v: string | number): string {
  return `Ksh ${Number(v).toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const inputCls =
  "w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none";
const labelCls = "font-mono text-xs uppercase tracking-[0.2em] text-sage";

export default function MembersManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [adding, setAdding] = useState(false);
  const [tempNotice, setTempNotice] = useState<{ name: string; phone: string; password: string } | null>(null);

  // Per-row edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/members");
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch {
      setError("Couldn't load members.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't add member.");
        return;
      }
      setTempNotice({ name: data.member.name, phone: data.member.phone, password: data.tempPassword });
      setName("");
      setPhone("");
      setRole("member");
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/members/${id}`, {
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

  function startEdit(m: Member) {
    setEditingId(m.id);
    setEditName(m.name);
    setEditPhone(m.phone);
  }

  async function saveEdit(id: number) {
    const ok = await patch(id, { name: editName, phone: editPhone });
    if (ok) setEditingId(null);
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-6 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink">
          {error}
        </p>
      )}

      {/* Temp password notice — shown once after adding */}
      {tempNotice && (
        <div className="mb-8 rounded-4xl border border-gold/50 bg-gold/15 p-6">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-coral">
            Share these details once
          </p>
          <p className="mt-3 font-body text-sm text-ink">
            <strong>{tempNotice.name}</strong> can now sign in at the Member
            Portal with:
          </p>
          <div className="mt-4 grid gap-2 font-mono text-sm text-ink">
            <p>Phone: {tempNotice.phone}</p>
            <p>Temporary password: <strong>{tempNotice.password}</strong></p>
          </div>
          <p className="mt-3 font-body text-xs text-ink/60">
            They&apos;ll be asked to set their own password on first sign-in.
            This temporary password won&apos;t be shown again.
          </p>
          <button
            onClick={() => setTempNotice(null)}
            className="mt-4 rounded-full border border-ink/15 px-4 py-2 font-body text-xs text-ink/70 hover:text-ink"
          >
            Done
          </button>
        </div>
      )}

      {/* Add member */}
      <div className="rounded-4xl border border-ink/10 bg-card p-8">
        <h2 className="font-display text-2xl text-ink">Add a member</h2>
        <form onSubmit={addMember} className="mt-6 grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor="m-name" className={labelCls}>Name</label>
            <input id="m-name" className={`mt-2 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" />
          </div>
          <div>
            <label htmlFor="m-phone" className={labelCls}>Phone</label>
            <input id="m-phone" type="tel" className={`mt-2 ${inputCls}`} value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="07XX XXX XXX" />
          </div>
          <div>
            <label htmlFor="m-role" className={labelCls}>Role</label>
            <select id="m-role" className={`mt-2 ${inputCls}`} value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:opacity-60 md:col-span-3 md:w-fit"
          >
            {adding ? "Adding…" : "Add member"}
          </button>
        </form>
      </div>

      {/* Members list */}
      <h2 className="mt-12 font-display text-2xl text-ink">All members</h2>
      {loading ? (
        <p className="mt-6 font-body text-sm text-ink/60">Loading…</p>
      ) : members.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink/60">No members yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/10 rounded-3xl border border-ink/10 bg-card">
          {members.map((m) => (
            <li key={m.id} className={`px-5 py-4 ${!m.active ? "opacity-60" : ""}`}>
              {editingId === m.id ? (
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-center">
                  <input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input className={inputCls} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(m.id)} className="rounded-full bg-deep px-4 py-2 font-body text-xs text-cream hover:scale-105">Save</button>
                    <button onClick={() => setEditingId(null)} className="rounded-full border border-ink/15 px-4 py-2 font-body text-xs text-ink/70">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-body text-sm font-medium text-ink">
                      {m.name}
                      {m.role === "admin" && (
                        <span className="ml-2 rounded-full bg-coral/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-coral">admin</span>
                      )}
                      {!m.active && (
                        <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/60">inactive</span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-ink/50">{m.phone} · {ksh(m.total)} total</p>
                  </div>
                  <div className="flex flex-wrap gap-2 font-body text-xs">
                    <button onClick={() => startEdit(m)} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 hover:text-ink">Edit</button>
                    <button onClick={() => patch(m.id, { role: m.role === "admin" ? "member" : "admin" })} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 hover:text-ink">
                      {m.role === "admin" ? "Make member" : "Make admin"}
                    </button>
                    <button onClick={() => patch(m.id, { active: !m.active })} className="rounded-full border border-ink/15 px-3 py-1.5 text-ink/70 hover:text-ink">
                      {m.active ? "Deactivate" : "Reactivate"}
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
