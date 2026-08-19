import Link from "next/link";
import { HorizonLine } from "@/components/Horizon";

export const metadata = {
  title: "Page not found — St. Mary's Senior Youth",
};

/**
 * Custom 404, in the site's own design rather than the framework default.
 * Offers the three places someone who mistyped a URL is actually trying to
 * reach, rather than a dead end.
 */
export default function NotFound() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          404
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          That page isn&apos;t here
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />
        <p className="mt-8 max-w-xl font-body text-sm leading-relaxed text-ink/70">
          The link may be out of date, or the address mistyped. Nothing has been
          lost — here is where most people are heading.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105"
          >
            Home
          </Link>
          <Link
            href="/portal"
            className="rounded-full border border-ink/15 px-6 py-3 font-body text-sm text-ink transition-colors hover:bg-card"
          >
            Member Portal
          </Link>
          <Link
            href="/funds-finance"
            className="rounded-full border border-ink/15 px-6 py-3 font-body text-sm text-ink transition-colors hover:bg-card"
          >
            Funds &amp; Finance
          </Link>
        </div>
      </div>
    </main>
  );
}
