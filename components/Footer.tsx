import Link from "next/link";
import { HorizonLine } from "./Horizon";

const links = [
  { href: "/values-membership", label: "Values & Membership" },
  { href: "/funds-finance", label: "Funds & Finance" },
  { href: "/events", label: "Events" },
  { href: "/portal", label: "Member Portal" },
];

export default function Footer() {
  return (
    <footer className="mt-24 bg-deep text-cream">
      <HorizonLine className="opacity-50" />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-display text-xl">St. Mary&apos;s Senior Youth</p>
            <p className="mt-3 max-w-xs font-body text-sm text-cream/70">
              A community of young, unmarried men and women aged 18–25,
              walking together in faith at Don Bosco, Changamwe Parish.
            </p>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">
              Find your way
            </p>
            <ul className="mt-4 space-y-2 font-body text-sm text-cream/80">
              {links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-cream">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-gold">
              Motto
            </p>
            <p className="mt-4 max-w-xs font-display text-base leading-relaxed text-cream/90">
              &ldquo;In every young person, a point of goodness is
              accessible.&rdquo;
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-cream/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-cream/40">
            &copy; {new Date().getFullYear()} St. Mary&apos;s Senior Youth,
            Changamwe Parish.
          </p>
          <div className="flex gap-5 font-body text-xs text-cream/60">
            <Link href="/privacy" className="hover:text-cream">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-cream">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
