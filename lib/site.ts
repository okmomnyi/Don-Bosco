/**
 * Facts about the group and the parish, in one place, so page metadata and the
 * structured data below can't drift apart from each other.
 *
 * Everything here is verifiable first-party information: the parish details
 * come from St. Mary's own site (stmaryschangamwe.org), and the group details
 * from this site's own Values & Membership page. Nothing is invented — an
 * invented address or phone number in structured data is worse than none,
 * because search engines present it as fact.
 */

/**
 * The canonical public URL, used for `metadataBase`, canonical links, the
 * sitemap and robots.
 *
 * Set NEXT_PUBLIC_SITE_URL in Vercel if the group moves onto a parish
 * subdomain (youth.stmaryschangamwe.org or similar). Until then the Vercel
 * deployment URL is the real address and must stay accurate — a canonical
 * pointing at a domain that doesn't serve the site de-indexes it.
 *
 * No trailing slash: everything appends its own path.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://don-bosco-ashy.vercel.app"
).replace(/\/+$/, "");

/** The group. "CSY" is the Catholic Senior Youth, per its own constitution. */
export const GROUP = {
  name: "St. Mary's Senior Youth",
  longName: "St. Mary's Senior Youth — Changamwe",
  patron: "St. Don Bosco",
  movement: "Catholic Senior Youth (CSY)",
  ageRange: "18-25",
} as const;

/** The parish, from stmaryschangamwe.org. */
export const PARISH = {
  name: "St. Mary's Catholic Church Changamwe",
  shortName: "St. Mary's Changamwe",
  url: "https://www.stmaryschangamwe.org",
  locality: "Changamwe",
  city: "Mombasa",
  region: "Coast",
  postalCode: "80100",
  country: "KE",
  latitude: -4.0435,
  longitude: 39.6682,
} as const;

/** The archdiocese. Mombasa is a Metropolitan See, not a suffragan diocese. */
export const ARCHDIOCESE = {
  name: "Roman Catholic Archdiocese of Mombasa",
} as const;

export const SITE_DESCRIPTION =
  `The senior youth group of ${PARISH.name}. Young, unmarried men and women ` +
  `aged ${GROUP.ageRange} walking together in faith. Membership and values, events ` +
  `through the year, how the group is funded, and the member portal.`;

/**
 * Structured data describing the group and its place in the parish.
 *
 * The group is an Organization whose parent is the parish, whose parent is the
 * archdiocese — which is what actually lets a search engine connect this site
 * to St. Mary's rather than treating it as an unrelated page that happens to
 * share a name.
 *
 * The parish's phone and email are deliberately not repeated here. They are
 * published on the parish's own site, which is the authority for them; copying
 * them into a second site's structured data just creates something else to go
 * stale.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#group`,
    name: GROUP.name,
    alternateName: [GROUP.longName, "Senior Youth Changamwe"],
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    inLanguage: "en-KE",
    parentOrganization: {
      "@type": "Church",
      name: PARISH.name,
      alternateName: PARISH.shortName,
      url: PARISH.url,
      address: {
        "@type": "PostalAddress",
        streetAddress: PARISH.locality,
        addressLocality: PARISH.city,
        addressRegion: PARISH.region,
        postalCode: PARISH.postalCode,
        addressCountry: PARISH.country,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: PARISH.latitude,
        longitude: PARISH.longitude,
      },
      parentOrganization: {
        "@type": "Organization",
        name: ARCHDIOCESE.name,
      },
    },
    location: {
      "@type": "Place",
      name: PARISH.name,
      address: {
        "@type": "PostalAddress",
        addressLocality: PARISH.city,
        addressRegion: PARISH.region,
        addressCountry: PARISH.country,
      },
    },
    areaServed: {
      "@type": "City",
      name: PARISH.city,
      addressCountry: PARISH.country,
    },
    memberOf: {
      "@type": "Organization",
      name: GROUP.movement,
    },
    knowsAbout: [
      "Catholic youth ministry",
      "Catholic Senior Youth",
      "Youth fellowship",
      "Sacramental life",
      GROUP.patron,
    ],
  };
}

/** The site itself, so search engines have a name for the property. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: GROUP.name,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: "en-KE",
    publisher: { "@id": `${SITE_URL}/#group` },
  };
}
