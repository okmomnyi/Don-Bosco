import { HorizonLine } from "@/components/Horizon";
import {
  MassIcon,
  FellowshipIcon,
  GamesIcon,
  FestivalIcon,
  SeminarIcon,
} from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Opening and closing Mass, weekly Wednesday fellowship at Changamwe Catholic Church, the 1st May games day, festivals and seminars through the youth year.",
  alternates: { canonical: "/events" },
  openGraph: {
    title: "Events",
    description:
      "Opening and closing Mass, weekly Wednesday fellowship at Changamwe Catholic Church, the 1st May games day, festivals and seminars through the youth year.",
    url: "/events",
    type: "website",
  },
};

const events = [
  {
    icon: MassIcon,
    title: "Opening & Closing Mass",
    tagline: "Begin with grace, journey in faith.",
    schedule: "Start and end of the youth year",
    copy: "Come offer up your week and your year, meet your community, and let the Holy Spirit set your heart on fire.",
  },
  {
    icon: FellowshipIcon,
    title: "Fellowship",
    tagline: "Faith is better shared.",
    schedule: "Every Wednesday · 5 PM · Changamwe Catholic Church",
    copy: "No judgement, just real talk, good vibes, and a community that has your back. Come as you are, make lifelong friends, and walk this journey together.",
  },
  {
    icon: GamesIcon,
    title: "Games",
    tagline: "Joy in action, faith in motion.",
    schedule: "Every year · 1st May",
    copy: "Unplug, team up, and let your competitive spirit shine — get ready for high energy, big laughs, and unforgettable memories.",
  },
  {
    icon: FestivalIcon,
    title: "Festivals",
    tagline: "A celebration of faith, art and culture.",
    schedule: "Throughout the year",
    copy: "God is the ultimate creator, and we celebrate His beauty through music, dance and creative expression — coming alive in the joy of the Gospel.",
  },
  {
    icon: SeminarIcon,
    title: "Seminars",
    tagline: "Deepen your roots, ignite your purpose.",
    schedule: "Throughout the year",
    copy: "Big questions about life, faith and the modern world? Our interactive sessions offer real answers, practical tools and inspiring insights for navigating your youth with confidence.",
  },
];

export default function EventsPage() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Together
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          Events
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {events.map(({ icon: Icon, title, tagline, schedule, copy }) => (
            <article
              key={title}
              className="rounded-4xl border border-ink/10 bg-card p-8 transition-colors hover:border-ink/20"
            >
              <Icon className="h-7 w-7 text-coral" />
              <h2 className="mt-5 font-display text-2xl text-ink">{title}</h2>
              <p className="mt-1 font-body text-sm font-medium text-ink/60">
                {tagline}
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-sage">
                {schedule}
              </p>
              <p className="mt-4 font-body text-sm leading-relaxed text-ink/70">
                {copy}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
