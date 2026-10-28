import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { TAB_IDS, type InputsPage, type NavBar } from "./pages";
import { FILL } from "./blank/helpers";
import { copyProblems } from "./support/copy";
import { OUTPUT_TAB_IDS, schema, tableProblems } from "./support/tables";

test.use({ reducedMotion: "reduce" });

async function runIn(inputs: InputsPage, mode: "default" | "blank") {
  await inputs.goto(mode);
  if (mode === "blank") {
    await inputs.fillAll(FILL);
    await inputs.dialog.dismissAll();
  }
  await inputs.run();
}

async function crawl(page: Page, nav: NavBar, mode: string): Promise<string[]> {
  const found: string[] = [];
  for (const id of TAB_IDS) {
    await nav.go(id);
    await page.waitForTimeout(300);
    found.push(...(await copyProblems(page, `${mode} · ${id}`)));
  }
  return found;
}

for (const mode of ["default", "blank"] as const) {
  test(`copy rules hold on every page in ${mode} mode after a run: spelled out, no brackets, no "/", %, capitals`, async ({ page, inputs, nav }) => {
    await runIn(inputs, mode);
    const found = await crawl(page, nav, mode);
    expect(found, found.join("\n")).toEqual([]);
  });
}

test('every output cell shows a value or "-" and every table fills its width', async ({ page, inputs, nav }) => {
  await runIn(inputs, "default");
  const found: string[] = [];
  for (const tab of OUTPUT_TAB_IDS) {
    await nav.go(tab);
    for (const t of schema.tabs[tab]) found.push(...(await tableProblems(page, t)));
  }
  expect(found, found.join("\n")).toEqual([]);
});

test("the validation popup follows the copy rules", async ({ page, inputs }) => {
  await inputs.goto("blank");
  await inputs.runButton.click();
  await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
  expect(await copyProblems(page, "validation popup")).toEqual([]);
});
