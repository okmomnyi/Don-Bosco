import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Public pages only. Nothing behind a sign-in is listed — the portal and admin
 * pages carry members' names, phone numbers and contribution figures, and each
 * of those pages also sends `robots: noindex` (see app/robots.ts for why both).
 *
 * `lastModified` is a single date bumped when the pages' copy actually changes.
 * Pointing it at `new Date()` would claim every page changed on every crawl,
 * which trains a crawler to ignore the field.
 */
const CONTENT_LAST_UPDATED = new Date("2026-08-20");

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

const PAGES: Entry[] = [
  // The front door.
  { path: "/", changeFrequency: "monthly", priority: 1.0 },
  // What someone considering joining actually needs to read.
  { path: "/values-membership", changeFrequency: "yearly", priority: 0.9 },
  // Recurring events through the youth year.
  { path: "/events", changeFrequency: "monthly", priority: 0.8 },
  // Figures move whenever contributions are recorded.
  { path: "/funds-finance", changeFrequency: "weekly", priority: 0.7 },
  // Required reading, rarely changed, low priority but must be indexable.
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: CONTENT_LAST_UPDATED,
    changeFrequency,
    priority,
  }));
}
