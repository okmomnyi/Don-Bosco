"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Kept in step with MIN_PASSWORD_LENGTH in app/api/auth/change-password. */
const MIN_PASSWORD_LENGTH = 10;

export default function ChangePasswordForm({
  redirectTo,
  requireCurrent,
}: {
  redirectTo: string;
  /**
   * Whether to ask for the existing password. False only on first sign-in,
   * where the temporary password was presented at login moments ago.
   */
  requireCurrent: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (requireCurrent && !current) {
      setError("Enter your current password.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          requireCurrent
            ? { currentPassword: current, newPassword: password }
            : { newPassword: password }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update password.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 font-body text-sm text-ink"
        >
          {error}
        </p>
      )}

      {requireCurrent && (
        <div>
          <label
            htmlFor="current-password"
            className="font-mono text-xs uppercase tracking-[0.2em] text-sage"
          >
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="The password you use now"
            className="mt-2 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="new-password"
          className="font-mono text-xs uppercase tracking-[0.2em] text-sage"
        >
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          className="mt-2 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="font-mono text-xs uppercase tracking-[0.2em] text-sage"
        >
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="mt-2 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
