import { redirect } from "next/navigation";
import { HorizonLine } from "@/components/Horizon";
import AdminNav from "@/components/AdminNav";
import ContributionsManager from "@/components/ContributionsManager";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminContributionsPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  // Default the date picker to today (server time).
  const today = new Date().toISOString().slice(0, 10);

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
