import type { Page } from "@playwright/test";

import { copyViolations } from "../../lib/format/copy-rules";
import { titleCaseViolations } from "../../lib/format/title-case";

/** Titles, tabs, buttons, table headers, popup titles, labels and nav links: the copy the capitalisation rule covers. */
const LABEL_SELECTORS = ["h1", "h2", "h3", "h4", "[role=tab]", "button", "th", "[role=dialog] h2", "label", "[data-title]", "nav a"].join(", ");

/**
 * Visible label text. Sentences nested inside a matched element (p and li, such as card descriptions and section
 * subtitles inside a button) are prose, so they are left to the prose check.
 */
export async function visibleLabels(page: Page): Promise<string[]> {
  return page.evaluate((selectors) => {
    const out = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selectors))) {
      if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
      const own = el.getAttribute("data-title");
      if (own) {
        out.add(own.trim());
        continue;
      }
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const parts: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const prose = node.parentElement?.closest("p, li, select, [aria-hidden=true]");
        if (prose && prose !== el && el.contains(prose)) continue;
        parts.push(node.textContent ?? "");
      }
      const text = parts.join("").replace(/\s+/g, " ").trim();
      if (text) out.add(text);
    }
    return [...out];
  }, LABEL_SELECTORS);
}

/** Visible sentences: paragraphs and list items. Read as written, so CSS upper-casing of kickers is not mistaken for a shortform. */
export async function visibleProse(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main p, main li, [role=dialog] p, [role=dialog] li, footer p"))
      .filter((el) => el.offsetParent || getComputedStyle(el).position === "fixed")
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
}

/** Capitalisation on labels, and the copy rules on labels and prose, as readable lines. */
export async function copyProblems(page: Page, where: string): Promise<string[]> {
  const problems: string[] = [];
  for (const label of await visibleLabels(page)) {
    const caps = titleCaseViolations(label);
    if (caps.length) problems.push(`${where}: "${label}" needs capitals on ${caps.join(", ")}`);
    for (const v of copyViolations(label, "label")) problems.push(`${where}: "${label}" ${v}`);
  }
  for (const text of await visibleProse(page)) {
    for (const v of copyViolations(text, "prose")) problems.push(`${where}: "${text.slice(0, 120)}" ${v}`);
  }
  return problems;
}
