import type { Config } from "tailwindcss";

/** The spacing scale from app/tokens.css: 4, 8, 12, 16, 24, 32, 48 and 64 px. Padding, margins and gaps use nothing else. */
const space = {
  0: "0px",
  px: "1px",
  1: "var(--space-1)",
  2: "var(--space-2)",
  3: "var(--space-3)",
  4: "var(--space-4)",
  6: "var(--space-6)",
  8: "var(--space-8)",
  12: "var(--space-12)",
  16: "var(--space-16)",
};

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    /** The type scale lives in app/tokens.css; these are the only font sizes. */
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
    borderRadius: {
      none: "0px",
      sm: "var(--radius-xs)",
      DEFAULT: "var(--radius-xs)",
      md: "var(--radius-sm)",
      lg: "var(--radius-sm)",
      xl: "var(--radius-md)",
      "2xl": "var(--radius-lg)",
      full: "var(--radius-full)",
    },
    extend: {
      colors: {
        background: "var(--ar-bg)",
        surface: "var(--ar-surface)",
        panel: "var(--ar-panel)",
        ink: "var(--ar-ink)",
        muted: "var(--ar-muted)",
        gold: { DEFAULT: "rgb(var(--gold-rgb) / <alpha-value>)", light: "#e5cf94", dark: "rgb(var(--gold-dark-rgb) / <alpha-value>)" },
        maroon: { DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)", dark: "var(--accent-dark)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
