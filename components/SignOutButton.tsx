"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignOutButton({
  redirectTo = "/portal",
  className,
}: {
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className={
        className ??
        "rounded-full border border-ink/15 px-5 py-2 font-body text-sm text-ink/70 transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-60"
      }
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
