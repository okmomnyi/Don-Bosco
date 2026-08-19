import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import ExpendituresManager from "@/components/ExpendituresManager";
import { checkAdmin, adminDenialRedirect } from "@/lib/auth";
import { todayInNairobi } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function AdminExpendituresPage() {
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
          Expenditure
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />
        <div className="mt-12">
          <ExpendituresManager today={todayInNairobi()} />
        </div>
      </div>
    </main>
  );
}
