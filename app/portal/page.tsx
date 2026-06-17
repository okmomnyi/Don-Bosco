import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import SignInForm from "@/components/SignInForm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  // Already signed in? Go straight to the dashboard.
  const session = await getSession();
  if (session) {
    redirect("/portal/dashboard");
  }

  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Members only
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink">Member Portal</h1>
        <HorizonLine className="mx-auto mt-8 max-w-xs" />
        <p className="mt-6 font-body text-sm leading-relaxed text-ink/70">
          Sign in with your phone number to view your contribution history.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-md rounded-4xl border border-ink/10 bg-card p-8">
        <SignInForm variant="member" />

        <p className="mt-6 text-center font-body text-xs text-ink/50">
          New here, or never set a password? Speak to your group leader to
          get set up.
        </p>
      </div>
    </main>
  );
}
