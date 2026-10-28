import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../fixtures";
import { fillBlank } from "./helpers";

test.use({ reducedMotion: "reduce" });

test.describe("B18 Mode switching", () => {
  test("B18.1 Blank to Default prefills the defaults and clears the results", async ({ inputs, nav, outputs }) => {
    await fillBlank(inputs);
    await inputs.run();
    await nav.go("inputs");
    await inputs.setMode("default");
    await expect(inputs.field("spot")).toHaveValue("76835.78");
    await expect(inputs.field("valuationDate")).toHaveValue("2026-10-28");
    await expect(inputs.field("coupon")).toHaveValue("102.50");
    await outputs.summary.open();
    await outputs.summary.expectGate();
  });

  test("B18.2 Default to Blank empties every field and clears the results", async ({ page, inputs, nav, outputs }) => {
    await inputs.goto();
    await inputs.run();
    await nav.go("inputs");
    await inputs.setMode("blank");
    const values = await page.locator('main input[data-testid^="input-"]:not([type="checkbox"]):not([data-testid="input-spreadCount-input"])').evaluateAll((els) =>
      els.map((e) => (e as HTMLInputElement).value).filter(Boolean),
    );
    expect(values).toEqual([]);
    await outputs.summary.open();
    await outputs.summary.expectGate();
  });

  test("B18.3 cancelling the confirm keeps the mode, the inputs and the results", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    await inputs.run();
    await nav.go("inputs");
    await page.getByTestId("mode-default").click();
    await inputs.dialog.expectTitle("Switch Mode And Clear Results");
    await expect(inputs.dialog.ok).toHaveText("Cancel");
    await inputs.dialog.close();
    await expect(page.getByTestId("mode-blank")).toHaveAttribute("aria-selected", "true");
    await expect(inputs.field("coupon")).toHaveValue("102.50");
    await expect(page.getByTestId("strip-simulation")).toHaveText("Up To Date");
  });

  test("B18.4 a reload returns Default Values and nothing is persisted", async ({ page, inputs, nav }) => {
    await fillBlank(inputs);
    await inputs.run();
    await page.reload();
    await nav.go("inputs");
    await expect(page.getByTestId("mode-default")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("strip-simulation")).toHaveText("Not Run");
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
    expect(storage).toEqual({ local: [], session: [] });
  });
});

test.describe("B19 Keyboard", () => {
  test("B19.1 Tab order follows the visual order down the Inputs page", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await page.getByTestId("mode-blank").focus();
    const seen: Array<{ id: string; top: number; left: number }> = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const at = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest("main")) return null;
        const r = el.getBoundingClientRect();
        // Position within the content: sideways rails scroll as focus moves, so add their scroll back.
        let scrolled = 0;
        for (let p = el.parentElement; p; p = p.parentElement) if (p.scrollWidth > p.clientWidth) scrolled += p.scrollLeft;
        return { id: el.dataset.testid ?? el.getAttribute("aria-label") ?? el.tagName, top: r.top + window.scrollY, left: r.left + scrolled };
      });
      if (at) seen.push(at);
    }
    expect(seen.length).toBeGreaterThan(30);
    const backwards = seen.slice(1).filter((cur, k) => {
      const prev = seen[k]!;
      const sameRow = Math.abs(cur.top - prev.top) < 24;
      return sameRow ? cur.left < prev.left - 2 : cur.top < prev.top;
    });
    expect(backwards, JSON.stringify(seen.map((s) => s.id))).toEqual([]);
  });

  test("B19.2 Enter on Run Simulation runs it", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.runButton.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/summary$/);
  });

  test("B19.3 Escape closes a popup and focus returns", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("mode-blank").focus();
    await page.keyboard.press("Enter");
    await inputs.dialog.expectTitle("Switch Mode And Clear Results");
    await expect(inputs.dialog.ok).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(inputs.dialog.root).toHaveCount(0);
    await expect(page.getByTestId("mode-blank")).toBeFocused();

    await inputs.setMode("blank");
    await inputs.runButton.click();
    await inputs.dialog.expectTitle("Missing Or Invalid Inputs");
    await page.keyboard.press("Escape");
    await expect(inputs.field("underlying")).toBeFocused();
  });

  test("B19.4 arrow keys move between the mode tabs and between the section tabs", async ({ page, inputs }) => {
    await inputs.goto();
    await page.getByTestId("mode-default").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("mode-blank")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("mode-default")).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByTestId("mode-blank")).toBeFocused();

    await page.getByTestId("nav-inputs").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("nav-summary")).toBeFocused();
    await page.keyboard.press("End");
    await expect(page.getByTestId("nav-logic-atlas")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("nav-inputs")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("nav-logic-atlas")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/logic-atlas$/);
  });

  test("B19.5 keyboard focus is visible on tabs, links, buttons and fields", async ({ page, inputs, browserName }) => {
    await inputs.goto();
    const ring = async (el: Locator) =>
      el.evaluate((e) => {
        const s = getComputedStyle(e);
        return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && s.boxShadow !== "");
      });
    const viaKeyboard = async (page: Page, testId: string) => {
      const el = page.getByTestId(testId);
      await el.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(el).toBeFocused();
      return el;
    };
    // WebKit, like Safari, only tabs to links with Option+Tab, so the section tab link is checked on the other engines.
    const ids = ["mode-default", "nav-summary", "run-simulation", "input-coupon", "input-underlying", "reset-inputs"].filter((id) => !(browserName === "webkit" && id.startsWith("nav-")));
    for (const id of ids) {
      expect(await ring(await viaKeyboard(page, id)), id).toBe(true);
    }
  });
});
