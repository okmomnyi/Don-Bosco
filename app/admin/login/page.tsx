import { HorizonLine } from "@/components/Horizon";
import SignInForm from "@/components/SignInForm";

import type { Metadata } from "next";

// Members' names, phone numbers and contribution figures. Never indexed:
// robots.txt is a request, a robots meta tag is honoured even when the
// URL is reached from a link somewhere else.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-coral">
          Administrators
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink">Admin Sign-in</h1>
        <HorizonLine className="mx-auto mt-8 max-w-xs" />
        <p className="mt-6 font-body text-sm leading-relaxed text-ink/70">
          Sign in to manage members and record contributions.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-md rounded-4xl border border-ink/10 bg-card p-8">
        <SignInForm variant="admin" />

        <p className="mt-6 text-center font-body text-xs text-ink/50">
          Members sign in at the{" "}
          <a href="/portal" className="text-coral underline">
            Member Portal
          </a>{" "}
          instead.
        </p>
      </div>
    </main>
  );
}
