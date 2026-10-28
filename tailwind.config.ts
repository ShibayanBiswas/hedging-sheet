import type { Config } from "tailwindcss";

/** The spacing scale: 4, 8, 12, 16, 24, 32, 48 and 64 px. Padding, margins and gaps use nothing else. */
const space = {
  0: "0px",
  px: "1px",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  6: "1.5rem",
  8: "2rem",
  12: "3rem",
  16: "4rem",
};

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    /** The type scale lives in app/globals.css as fluid clamp() tokens; these are the only font sizes. */
    fontSize: {
      caption: ["var(--text-caption)", { lineHeight: "var(--leading-caption)" }],
      "table-head": ["var(--text-table-head)", { lineHeight: "var(--leading-table)", fontWeight: "600" }],
      table: ["var(--text-table)", { lineHeight: "var(--leading-table)" }],
      body: ["var(--text-body)", { lineHeight: "var(--leading-body)" }],
      h3: ["var(--text-h3)", { lineHeight: "var(--leading-heading)" }],
      h2: ["var(--text-h2)", { lineHeight: "var(--leading-heading)" }],
      h1: ["var(--text-h1)", { lineHeight: "var(--leading-heading)" }],
      display: ["var(--text-display)", { lineHeight: "var(--leading-heading)" }],
    },
    padding: space,
    margin: { ...space, auto: "auto" },
    gap: space,
    space,
    extend: {
      colors: {
        background: "var(--ar-bg)",
        surface: "var(--ar-surface)",
        panel: "var(--ar-panel)",
        ink: "var(--ar-ink)",
        muted: "var(--ar-muted)",
        gold: { DEFAULT: "#d4b24c", light: "#e5cf94", dark: "#b8860b" },
        maroon: { DEFAULT: "#7a1e2c", dark: "#5c1520" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Times New Roman", "Times", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
