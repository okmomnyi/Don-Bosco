import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Flip between light/dark via CSS variables (see globals.css).
        // `paper` = page surfaces + inputs; `ink` = body text + borders.
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        // Fixed brand tokens — identical in both themes.
        deep: "#16242A",
        cream: "#F2F5F4", // always-light text/buttons sitting on dark surfaces
        coral: "#FF8552",
        gold: "#FFD56B",
        sage: "#6E8C7C",
        // Card surfaces (flip via CSS variables).
        card: "var(--card)",
        "card-solid": "var(--card-solid)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        horizon: "linear-gradient(90deg, #FF8552 0%, #FFD56B 100%)",
        dawn: "linear-gradient(180deg, #16242A 0%, #2F4A4A 55%, #FF8552 100%)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
