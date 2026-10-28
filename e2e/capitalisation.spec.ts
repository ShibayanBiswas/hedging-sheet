import type { Page } from "@playwright/test";

import { titleCaseViolations } from "../lib/format/title-case";
import { FILL } from "./blank/helpers";
import { expect, test } from "./fixtures";
import { TAB_IDS, type NavBar } from "./pages";
import { visibleLabels } from "./support/copy";

test.use({ reducedMotion: "reduce" });

async function offenders(page: Page): Promise<string[]> {
  return (await visibleLabels(page))
    .map((text) => ({ text, bad: titleCaseViolations(text) }))
    .filter((r) => r.bad.length)
    .map((r) => `"${r.text}" (${r.bad.join(", ")})`);
}

async function crawl(page: Page, nav: NavBar, mode: string) {
  const found: string[] = [];
  for (const id of TAB_IDS) {
    await nav.go(id);
    await page.waitForTimeout(300);
    for (const o of await offenders(page)) found.push(`${mode} · ${id}: ${o}`);
  }
  return found;
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
      await inputs.fillAll(FILL);
      await inputs.dialog.dismissAll();
    }
    await inputs.run();
    found.push(...(await crawl(page, nav, mode)));
    expect(found, `Words that must start with a capital:\n${found.join("\n")}`).toEqual([]);
  });
}
