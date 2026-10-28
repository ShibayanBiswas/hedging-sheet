import type { Page } from "@playwright/test";

import { titleCaseViolations } from "../lib/format/title-case";
import blankFill from "../tests/fixtures/blank-valid-fill.json";
import { expect, test } from "./fixtures";
import { TAB_IDS, type InputMode, type InputsPage, type NavBar } from "./pages";

test.use({ reducedMotion: "reduce" });

/** Headings, tabs, buttons, table headers, popup titles, labels, titled elements and nav links. */
const SELECTORS = ["h1", "h2", "h3", "h4", "[role=tab]", "button", "th", "[role=dialog] h2", "label", "[data-title]", "nav a"].join(", ");

/**
 * Title text of each matched element. Sentences nested inside it (p and li, such as card descriptions and
 * section subtitles inside a button) are prose, not titles, so they are skipped.
 */
async function visibleTitles(page: Page): Promise<string[]> {
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
  }, SELECTORS);
}

async function offenders(page: Page): Promise<string[]> {
  return (await visibleTitles(page))
    .map((text) => ({ text, bad: titleCaseViolations(text) }))
    .filter((r) => r.bad.length)
    .map((r) => `"${r.text}" (${r.bad.join(", ")})`);
}

async function crawl(page: Page, nav: NavBar, mode: InputMode) {
  const found: string[] = [];
  for (const id of TAB_IDS) {
    await nav.go(id);
    await page.waitForTimeout(300);
    for (const o of await offenders(page)) found.push(`${mode} · ${id}: ${o}`);
  }
  return found;
}

/** Fill Blank Inputs from the fixture, then run. Default Values runs as loaded. */
async function prepare(inputs: InputsPage, mode: InputMode) {
  if (mode === "blank") {
    await inputs.fillAll(blankFill.fill as [string, string][]);
    await inputs.dialog.dismissAll();
  }
  await inputs.run();
}

for (const mode of ["default", "blank"] as const) {
  test(`every visible title capitalises every word in ${mode} mode after a run`, async ({ page, inputs, nav }) => {
    const found: string[] = [];
    await inputs.goto(mode);
    if (mode === "blank") {
      await inputs.runButton.click();
      await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
      for (const o of await offenders(page)) found.push(`blank · validation popup: ${o}`);
      await inputs.dialog.dismissAll();
    }
    await prepare(inputs, mode);
    found.push(...(await crawl(page, nav, mode)));
    expect(found, `Words that must start with a capital:\n${found.join("\n")}`).toEqual([]);
  });
}
