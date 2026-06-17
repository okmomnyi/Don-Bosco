"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/values-membership", label: "Values & Membership" },
  { href: "/funds-finance", label: "Funds & Finance" },
  { href: "/events", label: "Events" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-lg font-medium leading-tight text-ink">
          St. Mary&apos;s Senior Youth
          <span className="block font-body text-xs font-normal text-sage">
            Don Bosco · Changamwe Parish
          </span>
        </Link>

        <nav className="hidden items-center gap-8 font-body text-sm md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
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
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-horizon" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle />
          <Link
            href="/portal"
            className="rounded-full bg-deep px-5 py-2 font-body text-sm font-medium text-cream transition-transform hover:scale-105"
          >
            Member Portal
          </Link>
        </div>
      </div>

      <nav className="flex items-center justify-center gap-5 overflow-x-auto border-t border-ink/10 px-4 py-2 font-body text-xs md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap ${
              pathname === link.href ? "text-ink" : "text-ink/60"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
