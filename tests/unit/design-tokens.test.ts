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

const css = fs.readFileSync("app/globals.css", "utf8");
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

const SPACING_PROPS = "p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y";

describe("design tokens", () => {
  it("font sizes come only from the type scale", () => {
    expect(hits(/(?<![\w-])text-(?:xs|sm|base|lg|xl|[2-9]xl|\[[\d.]+(?:px|rem|em)\])(?![\w-])/g)).toEqual([]);
    const declared = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]!.trim());
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

  it("the tokens cover the type, icon and spacing scales", () => {
    for (const t of ["display", "h1", "h2", "h3", "body", "table", "table-head", "caption"]) expect(css).toContain(`--text-${t}:`);
    for (const t of ["xs", "sm", "md", "lg", "xl"]) expect(css).toContain(`--icon-${t}:`);
  });
});
