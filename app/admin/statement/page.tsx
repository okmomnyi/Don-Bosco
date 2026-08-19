import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import StatementView from "@/components/StatementView";
import { checkAdmin, adminDenialRedirect } from "@/lib/auth";
import { todayInNairobi } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function AdminStatementPage() {
  const check = await checkAdmin();
  // An admin still on a temporary password goes to set a real one rather than
  // being bounced to a login page they are already past.
  if (!check.ok) redirect(adminDenialRedirect(check));
  const admin = check.user;

  return (
    <main className="px-6 py-12 md:py-16">
      <div className="mx-auto max-w-5xl">
        <AdminNav name={admin.name} />
        <h1 className="mt-10 font-display text-4xl text-ink md:text-5xl">
          Statement
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />
        <p className="mt-8 max-w-2xl font-body text-sm leading-relaxed text-ink/70">
          Every contribution and every payment in one list, in date order, with
          the balance after each one. This is the record to read from at a
          meeting.
        </p>
        <div className="mt-12">
          <StatementView today={todayInNairobi()} />
        </div>
      </div>
    </main>
  );
}
