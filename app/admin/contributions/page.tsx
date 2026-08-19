import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import ContributionsManager from "@/components/ContributionsManager";
import { checkAdmin, adminDenialRedirect } from "@/lib/auth";
import { todayInNairobi } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function AdminContributionsPage() {
  const check = await checkAdmin();
  // An admin still on a temporary password goes to set a real one rather than
  // being bounced to a login page they are already past.
  if (!check.ok) redirect(adminDenialRedirect(check));
  const admin = check.user;

  // Default the date picker to today in Nairobi, not in UTC. The server runs
  // in UTC, so between midnight and 03:00 EAT `toISOString()` returned
  // yesterday — a treasurer entering Sunday's collection late at night filed
  // it under Saturday.
  const today = todayInNairobi();

  return (
    <main className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <AdminNav name={admin.name} />
        <h1 className="mt-10 font-display text-4xl text-ink md:text-5xl">
          Contributions
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />
        <div className="mt-12">
          <ContributionsManager today={today} />
        </div>
      </div>
    </main>
  );
}
