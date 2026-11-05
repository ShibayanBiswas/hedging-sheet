import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** Every .tsx under app and components, plus globals.css: the places sizes are written. */
function sources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".tsx")) out.push({ file: p, text: fs.readFileSync(p, "utf8") });
    }
  };
  walk("app");
  walk("components");
  return out;
}

const globals = fs.readFileSync("app/globals.css", "utf8");
const tokens = fs.readFileSync("app/tokens.css", "utf8");
const css = `${tokens}\n${globals}`;
/** The class lists the CSS composes with @apply. */
const cssApplied = (css.match(/@apply[^;]*;/g) ?? []).join("\n");

function hits(re: RegExp): string[] {
  const found: string[] = [];
  for (const { file, text } of sources()) {
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(re)) found.push(`${file}:${i + 1} ${m[0]}`);
    });
  }
  for (const m of cssApplied.matchAll(re)) found.push(`app/globals.css @apply ${m[0]}`);
  return found;
}

const OFF_SCALE_SPACING = 10;

const SPACING_PROPS = "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y";

describe("design tokens", () => {
  it("font sizes come only from the type scale", () => {
    expect(hits(/(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem|em)\])(?![\w-])/g)).toEqual([]);
    const declared = [...globals.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(declared.filter((v) => !/^var\(--text-[a-z-]+\)$|^inherit$/.test(v))).toEqual([]);
  });

  it("padding, margins and gaps use only 4, 8, 12, 16, 24, 32, 48 and 64 px", () => {
    const re = new RegExp(`(?<![\\w-])!?-?(?:${SPACING_PROPS})-(?![xy]-)(?!(?:0|px|1|2|3|4|6|8|12|16|auto)(?![\\w.\\[]))[\\w.\\[\\]()%,-]+`, "g");
    expect(hits(re)).toEqual([]);
  });

  it("lucide icons take an icon token, never a raw size, and keep the default stroke", () => {
    const raw: string[] = [];
    for (const { file, text } of sources()) {
      const imp = /import\s*\{([^}]+)\}\s*from\s*"lucide-react"/.exec(text);
      const names = (imp?.[1] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/).pop()!).filter((n) => /^[A-Z]/.test(n) && !n.startsWith("type "));
      // Icons also arrive as props or fields: <Icon …>, <item.icon …>.
      const tag = new RegExp(`<(?:${[...names, "Icon", "[\\w.]+\\.icon"].join("|")})\\b[^>]*>`, "g");
      for (const m of text.matchAll(tag)) {
        const cls = /className=(\{[^>]*\}|"[^"]*")/.exec(m[0])?.[1] ?? "";
        if (/\b[hw]-\d|\bsize-\d|\[[\d.]+px\]/.test(cls) || !/\bicon-(xs|sm|md|lg|xl|nav)\b/.test(cls)) raw.push(`${file}: ${m[0].slice(0, 120)}`);
        if (/strokeWidth=\{(?!1\.75\})/.test(m[0])) raw.push(`${file}: stroke ${m[0].slice(0, 80)}`);
      }
    }
    expect(raw).toEqual([]);
  });

  it("full-height areas use dvh, not vh", () => {
    expect(hits(/\d(?:\.\d+)?vh\b|min-h-screen|\bh-screen\b/g)).toEqual([]);
    expect(css.match(/\d(?:\.\d+)?vh\b/g) ?? []).toEqual([]);
  });

  it("one token file holds the spacing, type, radius, shadow, accent, motion and numerals", () => {
    for (const t of ["display", "h1", "h2", "h3", "body", "table", "table-head", "caption"]) expect(tokens).toContain(`--text-${t}:`);
    for (const t of ["xs", "sm", "md", "lg", "xl"]) expect(tokens).toContain(`--icon-${t}:`);
    for (const t of [1, 2, 3, 4, 6, 8]) expect(tokens).toContain(`--space-${t}:`);
    for (const t of ["xs", "sm", "md", "lg", "full"]) expect(tokens).toContain(`--radius-${t}:`);
    for (const t of ["--shadow-run:", "--shadow-focus:", "--shadow-invalid:", "--accent:", "--accent-rgb:", "--motion-base:", "--numeric: tabular-nums"]) expect(tokens).toContain(t);
    expect(tokens).not.toMatch(/clamp\(/);
  });

  it("the type scale is 12 px body on phones, 14 px from 640 px, and headings of 18, 20 and 24 px", () => {
    expect(tokens).toMatch(/--text-body: 0\.75rem;/);
    expect(tokens).toMatch(/@media \(min-width: 640px\) \{\s*:root \{\s*--text-body: 0\.875rem;/);
    expect(tokens).toContain("--text-h3: 1.125rem;");
    expect(tokens).toContain("--text-h2: 1.25rem;");
    expect(tokens).toContain("--text-h1: 1.5rem;");
  });

  it("the accent, radii and motion are written only in the token file", () => {
    const tsx = sources().map((f) => f.text).join("\n");
    expect(globals.match(/#7a1e2c|#5a1420|#5c1520|rgba\(122, 30, 44/gi) ?? []).toEqual([]);
    expect(tsx.match(/#7a1e2c|#5a1420|#5c1520|rgba\(122,\s*30,\s*44/gi) ?? []).toEqual([]);
    const radii = [...globals.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(radii.filter((v) => !/^(?:(?:var\(--radius-[a-z]+\)|0)\s*)+$|^inherit$/.test(v))).toEqual([]);
    expect(tsx.match(/\brounded-\[[^\]]+\]/g) ?? []).toEqual([]);
  });

  it("transitions move opacity and transform only, for 150 to 200 ms", () => {
    const transitions = [...globals.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(transitions.filter((v) => !/^(?:(?:transform|opacity) var\(--motion-(?:fast|base)\)(?: var\(--motion-ease\))?,?\s*)+$/.test(v))).toEqual([]);
    expect(hits(/(?<=["'`\s])transition(?:-all|-colors)?(?=["'`\s]|$)(?!\s*=)/g)).toEqual([]);
  });

  it("an overridden Pricer volatility keeps its gold ring over the white table cells", () => {
    const white = globals.search(/\.data-table-premium tbody td,[^{]*\{[^}]*box-shadow: none !important/);
    const ring = globals.search(/\.data-table-premium tbody td\.hs-overridden-cell\s*\{\s*box-shadow: inset 0 0 0 2px rgb\(var\(--gold-rgb\) \/ 0\.65\) !important;/);
    expect(white).toBeGreaterThan(-1);
    expect(ring).toBeGreaterThan(white);
  });

  /**
   * Values kept off the scale on purpose: the Primary SP Dashboard table padding that S9 to S11 pin, the 40 px strike rows and the
   * fine run of the Inputs cards. They only go down: lower this number when one is moved onto the scale.
   */
  it("off-scale padding, margins and gaps in globals.css stay at their counted number", () => {
    const offScale = [...globals.matchAll(/(?:padding|margin|gap)[a-z-]*:\s*([^;]+);/g)]
      .map((m) => m[1]!)
      .flatMap((v) => v.match(/(?<![\w.-])\d*\.?\d+(?:rem|px|em)\b/g) ?? [])
      .filter((v) => parseFloat(v) !== 0);
    expect(offScale.length).toBeLessThanOrEqual(OFF_SCALE_SPACING);
  });
});
