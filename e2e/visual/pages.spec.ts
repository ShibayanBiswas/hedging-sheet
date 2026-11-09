import type { Page } from "@playwright/test";

import { fillBlank } from "../blank/helpers";
import { expect, test } from "../fixtures";
import type { InputsPage } from "../pages";
import { TAB_IDS } from "../pages";
import { masks, settle } from "../responsive/helpers";

/**
 * The one set of pixel baselines: the 8 tabs at 390, 768, 1440 and 1920 px in both modes after a run, whole pages, and every
 * popup, dialog and toast at 390 and 1440 px. Clocks, fetch times and live spots are masked and motion is reduced.
 * Baselines are Linux only, from the CI image.
 */
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

/** A whole-page screenshot leaves the sticky Run bar over the middle of the page: it rests at its place in the flow instead. */
const restRunBar = (page: Page) => page.addStyleTag({ content: ".hs-run-bar { position: static !important; }" });

async function shootEveryTab(page: Page, nav: { go: (id: (typeof TAB_IDS)[number]) => Promise<void> }, prefix: string) {
  await restRunBar(page);
  await expect(page.getByTestId("desk-toast")).toHaveCount(0, { timeout: 15_000 });
  for (const id of TAB_IDS) {
    await nav.go(id);
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page);
    await expect(page).toHaveScreenshot(`${prefix}-${id}.png`, { mask: masks(page), fullPage: true, timeout: 60_000 });
  }
}

for (const v of VIEWPORTS) {
  test.describe(`${v.width} px`, () => {
    test.use({ viewport: v, reducedMotion: "reduce" });

    test(`visual baselines ${v.width} Default Values, every tab after a run`, async ({ page, inputs, nav }) => {
      test.setTimeout(240_000);
      await inputs.goto();
      await inputs.run();
      await shootEveryTab(page, nav, `default-${v.width}`);
    });

    test(`visual baselines ${v.width} Blank Inputs, every tab after a run, and the empty start`, async ({ page, inputs, nav }) => {
      test.setTimeout(360_000);
      await inputs.goto("blank");
      await restRunBar(page);
      await settle(page);
      await expect(page).toHaveScreenshot(`blank-${v.width}-inputs-empty.png`, { mask: masks(page), fullPage: true, timeout: 60_000 });
      await fillBlank(inputs);
      await inputs.run();
      await shootEveryTab(page, nav, `blank-${v.width}`);
    });
  });
}

type Context = { page: Page; inputs: InputsPage };

/** A toast clears itself after 4 s; from here on it is held, so a slow machine compares the same picture every time. */
const holdToasts = (page: Page) =>
  page.evaluate(() => {
    const { setTimeout: start } = window;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => (ms === 4_000 ? 0 : start(fn, ms, ...rest))) as typeof window.setTimeout;
  });

/** Each opens one popup, dialog or toast, from a fresh page. */
const POPUPS: Array<{ name: string; open: (c: Context) => Promise<void> }> = [
  {
    name: "switch-mode",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.getByTestId("mode-blank").click();
      await inputs.dialog.expectTitle("Switch Mode And Clear Results");
    },
  },
  {
    name: "missing-inputs",
    open: async ({ inputs }) => {
      await inputs.goto("blank");
      await inputs.expectValidationDialog();
    },
  },
  {
    name: "field-reverted",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      const field = page.getByRole("textbox", { name: "Valuation Date", exact: true });
      await field.fill("not a date");
      await field.blur();
      await inputs.dialog.expectTitle("Valuation Date Reverted");
    },
  },
  {
    name: "fetch-failed",
    open: async ({ page, inputs }) => {
      await inputs.goto("blank");
      await inputs.fill("underlying", "Sensex");
      await page.route("**/api/market/levels", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Yahoo is down" }) }));
      await page.getByTestId("fetch-live-spot").click();
      await inputs.dialog.expectTitle("Fetch Failed");
    },
  },
  {
    name: "could-not-solve",
    open: async ({ inputs }) => {
      await inputs.goto();
      await inputs.fill("premiumRate", "100");
      await inputs.runButton.click();
      await inputs.dialog.expectTitle("Could Not Solve");
    },
  },
  {
    name: "priced-on-loaded-surface",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.route("**/api/dataset**", (route) => route.abort("internetdisconnected"));
      await inputs.runButton.click();
      await inputs.dialog.expectTitle("Priced On The Loaded Surface");
    },
  },
  {
    name: "bulk-edit-expiries",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.getByTestId("expiries-bulk").click();
      await expect(page.getByTestId("bulk-expiries")).toBeVisible();
    },
  },
  {
    name: "bulk-edit-strikes",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.getByTestId("strikes-bulk").click();
      await expect(page.getByTestId("bulk-strikes")).toBeVisible();
    },
  },
  {
    name: "command-palette",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.keyboard.press("Control+k");
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    // Cancelled by the end of the test: nothing reaches the test database.
    name: "desk-key",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await page.getByTestId("nav-market-data").click();
      await page.getByTestId("edit-params").click();
      await page.getByTestId("param-cap-buying").fill("7.1");
      await page.getByTestId("param-cap-buying").blur();
      await page.getByTestId("save-params").click();
      await expect(page.getByTestId("desk-key-dialog")).toBeVisible();
    },
  },
  {
    name: "toast-simulation-completed",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await holdToasts(page);
      await inputs.run();
      await expect(page.getByTestId("desk-toast")).toHaveText("Simulation Completed");
    },
  },
  {
    name: "toast-excel-saved",
    open: async ({ page, inputs }) => {
      await inputs.goto();
      await inputs.run();
      // The run's own toast leaves first, so only the download's toast is in the picture.
      await expect(page.getByTestId("desk-toast")).toHaveCount(0, { timeout: 15_000 });
      await holdToasts(page);
      await page.getByTestId("tab-actions").getByTestId("download-excel").click();
      await expect(page.getByTestId("desk-toast")).toHaveText(/^Saved /, { timeout: 30_000 });
    },
  },
];

for (const width of [390, 1440]) {
  test.describe(`popups at ${width} px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce" });

    for (const popup of POPUPS) {
      test(`visual baselines popup ${popup.name} at ${width}`, async ({ page, inputs }) => {
        await popup.open({ page, inputs });
        // A click can leave the page behind a popup scrolled by a varying amount.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await settle(page);
        // Only what sits behind a popup: a mask paints on top, so a mask on a field would cover the popup itself. The mock spot and clock are fixed.
        await expect(page).toHaveScreenshot(`popup-${width}-${popup.name}.png`, { mask: [page.getByTestId("market-strip"), page.getByTestId("desk-footer")] });
      });
    }

    test(`visual baselines states at ${width}: not run, then Inputs Changed`, async ({ page, inputs, nav }) => {
      await inputs.goto();
      await nav.go("summary");
      await settle(page);
      await expect(page).toHaveScreenshot(`state-${width}-not-run.png`, { mask: masks(page) });
      await nav.go("inputs");
      await inputs.run();
      await nav.go("inputs");
      await inputs.fill("notionalCr", "150");
      await inputs.dialog.dismissAll();
      await nav.go("summary");
      await expect(page.getByText("Inputs Changed · Run Again")).toBeVisible();
      await expect(page.getByTestId("desk-toast")).toHaveCount(0, { timeout: 15_000 });
      await settle(page);
      await expect(page).toHaveScreenshot(`state-${width}-inputs-changed.png`, { mask: masks(page) });
    });
  });
}

test.describe("animation smoke", () => {
  test("the mode pill moves to the chosen mode", async ({ page, inputs }) => {
    await inputs.goto();
    const before = await inputs.modeActive.boundingBox();
    await inputs.setMode("blank");
    await expect
      .poll(async () => (await inputs.modeActive.boundingBox())?.x ?? 0, { timeout: 3_000 })
      .toBeGreaterThan((before?.x ?? 0) + 50);
    await expect(page.getByTestId("mode-blank").getByTestId("mode-active")).toHaveCount(1);
  });

  test("run steps appear in order and results reveal within 1.5 s of the run finishing", async ({ page, inputs }) => {
    await inputs.goto();
    // Recorded in the page, so a busy test machine cannot miss a step between two polls.
    await page.evaluate(() => {
      const w = window as unknown as { __steps: string[] };
      w.__steps = [];
      const button = document.querySelector('[data-testid="run-simulation"]')!;
      new MutationObserver(() => {
        const step = /Step (\d) Of 4/.exec(button.textContent ?? "")?.[1];
        if (step && w.__steps[w.__steps.length - 1] !== step) w.__steps.push(step);
      }).observe(button, { subtree: true, childList: true, characterData: true });
    });
    await inputs.runButton.click();
    await expect(page).toHaveURL(/\/summary$/, { timeout: 10_000 });
    const seen = await page.evaluate(() => (window as unknown as { __steps: string[] }).__steps);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect([...seen].sort()).toEqual(seen);
    const done = Date.now();
    await expect(page.getByTestId("table-summary-headline")).toBeVisible({ timeout: 1_500 });
    expect(Date.now() - done).toBeLessThan(1_500);
  });
});
