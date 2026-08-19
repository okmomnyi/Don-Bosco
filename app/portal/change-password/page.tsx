import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/portal");

  const redirectTo =
    user.role === "admin" ? "/admin/dashboard" : "/portal/dashboard";

  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          {user.must_change_password ? "First sign-in" : "Account"}
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink">
          Set your password
        </h1>
        <HorizonLine className="mx-auto mt-8 max-w-xs" />
        <p className="mt-6 font-body text-sm leading-relaxed text-ink/70">
          {user.must_change_password
            ? "Choose a new password to replace the temporary one you were given."
            : "Choose a new password for your account."}
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-md rounded-4xl border border-ink/10 bg-card p-8">
        <ChangePasswordForm
          redirectTo={redirectTo}
          requireCurrent={!user.must_change_password}
        />
      </div>
    </main>
  );
}
