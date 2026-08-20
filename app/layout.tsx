import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  SITE_URL,
  SITE_DESCRIPTION,
  GROUP,
  PARISH,
  organizationJsonLd,
  websiteJsonLd,
} from "@/lib/site";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

const TITLE = `${GROUP.name} — ${PARISH.name}`;

export const metadata: Metadata = {
  // metadataBase makes the OG image and canonical URLs absolute. Without it
  // Next emits relative paths and link previews come out blank.
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${GROUP.name}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: GROUP.name,
  // Terms a person in Mombasa would actually type. Not a keyword dump —
  // Google ignores this tag, but Bing and several social crawlers still read it.
  keywords: [
    "St Mary's Senior Youth",
    "Senior Youth Changamwe",
    "Catholic Senior Youth Mombasa",
    "CSY Changamwe",
    "St Mary's Catholic Church Changamwe youth",
    "Catholic youth group Mombasa",
    "Don Bosco Changamwe",
    "youth ministry Changamwe",
  ],
  authors: [{ name: GROUP.name, url: SITE_URL }],
  creator: GROUP.name,
  publisher: PARISH.name,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: GROUP.name,
    locale: "en_KE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  category: "religion",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <head>
        {/* Who this group is and how it relates to the parish and the
            archdiocese. Without it a search engine has no way to connect this
            site to St. Mary's rather than to any other St. Mary's. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd(), websiteJsonLd()]),
          }}
        />
        {/* Set the theme before paint to avoid a flash of the wrong colours. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
