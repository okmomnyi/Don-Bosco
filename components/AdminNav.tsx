"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

/**
 * Highlighting below uses `pathname.startsWith(link.href)`, so no href here may
 * be a prefix of another. None currently is — check that before adding one.
 */
const links = [
  { href: "/admin/dashboard", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/contributions", label: "Contributions" },
  { href: "/admin/expenditures", label: "Expenditure" },
  { href: "/admin/statement", label: "Statement" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-6">
      <div className="flex items-center gap-6">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-coral">
          Admin
        </p>
        <nav className="flex items-center gap-5 font-body text-sm">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative pb-1 transition-colors ${
                  active ? "text-ink" : "text-ink/60 hover:text-ink"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-0.5 left-0 h-0.5 w-full bg-horizon" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden font-body text-sm text-ink/60 sm:inline">
          {name}
        </span>
        <SignOutButton redirectTo="/admin/login" />
      </div>
    </div>
  );
}
