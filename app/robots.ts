import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The public pages are meant to be found. The portal and the admin panel are
 * not — they hold members' names, phone numbers and contribution figures, and
 * there is no reason for any of it to appear in a search result.
 *
 * This is a request, not a control: the real protection is `middleware.ts` plus
 * `checkAdmin()` on every route. It stops well-behaved crawlers indexing pages
 * they would only ever see a login redirect for.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/portal/dashboard", "/portal/change-password", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
