import { ImageResponse } from "next/og";

/**
 * The card that appears when a link to the site is shared — in the WhatsApp
 * group, on Facebook, anywhere that reads OG tags. Built with `next/og`, which
 * ships with Next, so this adds no dependency and no image file to maintain.
 *
 * It reuses the site's own dawn palette rather than a stock image: deep
 * background, the coral-to-gold horizon, the sun sitting on the line.
 */
// Edge runtime: the Node build of @vercel/og resolves its bundled font through
// fileURLToPath, which throws on a Windows path containing spaces or brackets.
export const runtime = "edge";

export const alt = "Don Bosco Senior Youth — Changamwe Parish";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16242A",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#6E8C7C",
              fontFamily: "monospace",
            }}
          >
            Changamwe Parish
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 88,
              lineHeight: 1.05,
              color: "#F2F5F4",
              maxWidth: 900,
            }}
          >
            St. Mary&apos;s Senior Youth
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              lineHeight: 1.4,
              color: "rgba(242,245,244,0.7)",
              maxWidth: 780,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Young people walking together in faith at Don Bosco.
          </div>
        </div>

        {/* The horizon: the site's signature motif, sun sitting on the line. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", position: "relative", height: 64 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 30,
                height: 4,
                background: "linear-gradient(90deg, #FF8552 0%, #FFD56B 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 520,
                top: 6,
                width: 52,
                height: 52,
                borderRadius: 26,
                background: "linear-gradient(135deg, #FF8552 0%, #FFD56B 100%)",
              }}
            />
          </div>
        </div>
      </div>
    ),
    size
  );
}
