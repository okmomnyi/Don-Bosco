/**
 * The canonical public URL, used for `metadataBase`, the sitemap and robots.
 *
 * Override with NEXT_PUBLIC_SITE_URL once the group has its own domain — the
 * default is the current Vercel deployment. Without an absolute base, Next
 * cannot build absolute OG image URLs and link previews come out blank.
 *
 * No trailing slash: everything here appends its own path.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://don-bosco-ashy.vercel.app"
).replace(/\/+$/, "");
