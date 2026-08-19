import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SITE_URL } from "@/lib/site";

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

const description =
  "Young, unmarried men and women aged 18-25 walking together in faith at Don Bosco, Changamwe Parish.";

export const metadata: Metadata = {
  // metadataBase makes the OG image URL absolute. Without it Next emits a
  // relative path and link previews come out blank when shared.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "St. Mary's Senior Youth — Don Bosco, Changamwe Parish",
    template: "%s — St. Mary's Senior Youth",
  },
  description,
  openGraph: {
    title: "St. Mary's Senior Youth — Don Bosco, Changamwe Parish",
    description,
    url: SITE_URL,
    siteName: "St. Mary's Senior Youth",
    locale: "en_KE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "St. Mary's Senior Youth — Don Bosco, Changamwe Parish",
    description,
  },
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
