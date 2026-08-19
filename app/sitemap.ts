import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The public pages only. Nothing behind a sign-in is listed — see app/robots.ts
 * for why.
 */
const PUBLIC_PATHS = [
  "/",
  "/values-membership",
  "/funds-finance",
  "/events",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/funds-finance" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
