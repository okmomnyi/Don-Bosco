"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Shared sign-in form used by the member portal (`/portal`) and the admin
 * sign-in page (`/admin/login`). Posts to /api/auth/login and routes on
 * success based on role + whether a password change is required.
 *
 * In `admin` mode, a successful login by a non-admin account is rejected with
 * a clear message and the session is immediately cleared.
 */
export default function SignInForm({
  variant = "member",
}: {
  variant?: "member" | "admin";
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      if (!res.ok) {
        setError("Phone number or password is incorrect.");
        return;
      }

      const data = await res.json();
      const role = data?.user?.role as "member" | "admin" | undefined;

      if (variant === "admin") {
        if (role !== "admin") {
          // Not an admin — drop the session we just created.
          await fetch("/api/auth/logout", { method: "POST" });
          setError("This account isn't an administrator. Use the Member Portal.");
          return;
        }
        router.push("/admin/dashboard");
        router.refresh();
        return;
      }

      // Member portal
      if (data?.user?.mustChangePassword) {
        router.push("/portal/change-password");
      } else {
        router.push("/portal/dashboard");
      }
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

      <div>
        <label
          htmlFor="phone"
          className="font-mono text-xs uppercase tracking-[0.2em] text-sage"
        >
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          className="mt-2 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="font-mono text-xs uppercase tracking-[0.2em] text-sage"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-2 w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 font-body text-sm text-ink placeholder:text-ink/30 focus:border-coral focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
