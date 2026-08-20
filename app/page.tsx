import Link from "next/link";
import ParishLink from "@/components/ParishLink";
import { PARISH } from "@/lib/site";
import { HorizonLine, HorizonScene } from "@/components/Horizon";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "St. Mary's Senior Youth — Changamwe",
  },
  description:
    "The senior youth group of St. Mary's Catholic Church, Changamwe. Membership and values, events through the year, how the group is funded, and the member portal.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "St. Mary's Senior Youth — Changamwe",
    description:
      "The senior youth group of St. Mary's Catholic Church, Changamwe. Membership and values, events through the year, how the group is funded, and the member portal.",
    url: "/",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative px-6 pb-20 pt-20 md:pb-28 md:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
            Motto
          </p>
          <h1 className="mt-6 font-display text-4xl font-medium leading-[1.15] text-ink md:text-6xl">
            In every young person, a point of goodness is accessible.
          </h1>
          <HorizonLine className="mx-auto mt-10 max-w-xs" />
          <p className="mx-auto mt-10 max-w-2xl font-body text-base leading-relaxed text-ink/70 md:text-lg">
            Welcome to the Senior Youth of Don Bosco, Changamwe Parish — a
            community of young, unmarried men and women aged 18 to 25,
            walking together in faith.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-body text-sm text-ink/60">
            We are the senior youth of{" "}
            <ParishLink className="font-medium text-ink underline decoration-coral/50 underline-offset-4 transition-colors hover:decoration-coral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral">
              {PARISH.name}
            </ParishLink>
            .
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/values-membership"
              className="rounded-full bg-deep px-6 py-3 font-body text-sm font-medium text-cream transition-transform hover:scale-105"
            >
              How to join
            </Link>
            <Link
              href="/events"
              className="rounded-full border border-ink/15 px-6 py-3 font-body text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              See what&apos;s on
            </Link>
          </div>
        </div>
      </section>

      {/* Mission / Vision */}
      <section className="px-6">
        <div className="mx-auto grid max-w-5xl gap-px overflow-hidden rounded-4xl border border-ink/10 bg-ink/10 md:grid-cols-2">
          <div className="bg-paper p-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-coral">
              Mission
            </p>
            <p className="mt-4 font-display text-2xl text-ink">What we do</p>
            <p className="mt-4 font-body text-sm leading-relaxed text-ink/70">
              To adopt a preventive system founded on reason and religion
              that compensates for the errors committed by the young — not
              by condoning them, but by using them as stepping stones to the
              formation of a solid character, permeated by Christian
              principles and the doctrines of the Catholic church.
            </p>
          </div>
          <div className="bg-paper p-10">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-coral">
              Vision
            </p>
            <p className="mt-4 font-display text-2xl text-ink">
              Where we&apos;re going
            </p>
            <p className="mt-4 font-body text-sm leading-relaxed text-ink/70">
              To create a bridge from a teenage appreciation of the church to
              a fully-integrated youth, through the promotion of a Christian
              point of view.
            </p>
          </div>
        </div>
      </section>

      {/* Journey / navigation cards */}
      <section className="relative mt-24 overflow-hidden bg-dawn px-6 py-20 text-cream">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-gold">
            Find your way
          </p>
          <h2 className="mt-4 max-w-xl font-display text-3xl leading-tight md:text-4xl">
            Everything you need, from membership to contributions.
          </h2>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: "/values-membership",
                title: "Values & Membership",
                copy: "What it means to belong, and what's expected of every member.",
              },
              {
                href: "/funds-finance",
                title: "Funds & Finance",
                copy: "How the group is funded, and where contributions go.",
              },
              {
                href: "/events",
                title: "Events",
                copy: "Mass, fellowship, games, festivals and seminars.",
              },
              {
                href: "/portal",
                title: "Member Portal",
                copy: "Sign in to view your own contribution history.",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-3xl border border-cream/15 bg-cream/5 p-6 transition-colors hover:bg-cream/10"
              >
                <p className="font-display text-lg">{card.title}</p>
                <p className="mt-2 font-body text-sm text-cream/70">
                  {card.copy}
                </p>
                <span className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.25em] text-gold transition-transform group-hover:translate-x-1">
                  Open →
                </span>
              </Link>
            ))}
          </div>
        </div>
        <HorizonScene
          variant="set"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full text-cream opacity-20"
        />
      </section>
    </main>
  );
}
