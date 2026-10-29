import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import type { OptionType } from "../lib/engine/types";
import { mockDefaultInputs, priceLikeTheApp } from "../tests/helpers/mock-market";
import { expect, test } from "./fixtures";
import { close, readCells } from "./support/tables";

// Rules and layout read the settled page; motion is covered by the animation smoke tests.
test.use({ reducedMotion: "reduce" });

const OUTPUT_PAGES = ["summary", "pricer", "product", "vega-hedge", "margin"] as const;
const digits = (s: string) => s.replace(/[^\d]/g, "");

async function strikeState(page: Page) {
  const read = (prefix: string) =>
    page.locator(`[data-testid^="${prefix}"]`).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  return { percents: await read("input-strikePercents-"), levels: (await read("input-strikeLevel-")).map(digits) };
}

/** Headline Premium and Inbuilt, and the client return at 0%, as rendered after a run. */
async function readRun(page: Page, nav: { go: (id: "pricer" | "product") => Promise<void> }) {
  await nav.go("pricer");
  const head = await readCells(page, "pricer-headline");
  const premium = Object.entries(head).find(([k]) => k.endsWith("::Premium In Crore"))![1].value!;
  const inbuilt = Object.entries(head).find(([k]) => k.endsWith("::Actual Inbuilt"))![1].value!;
  await nav.go("product");
  const zero = await page.locator('[data-testid="table-pd-payoff"] [data-cell="0.00%::Client Return"]').textContent();
  return { premium, inbuilt, zero: zero?.trim() };
}

test.describe("Strikes, spreads and per spread option type", () => {
  test("S1 strike and expiry rows fill at least 95% of their panel at 1440 and 390 px", async ({ page, inputs }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await inputs.goto();
      for (const [panel, prefix] of [
        ["strikes", "strike-row-"],
        ["expiries", "expiry-row-"],
      ] as const) {
        const ratios = await page.locator(`#${panel}`).evaluate((section, p) => {
          const inner = section.getBoundingClientRect().width - parseFloat(getComputedStyle(section).paddingLeft) - parseFloat(getComputedStyle(section).paddingRight);
          return Array.from(section.querySelectorAll<HTMLElement>(`[data-testid^="${p}"]`)).map((row) => row.getBoundingClientRect().width / inner);
        }, prefix);
        expect(ratios.length, `${panel} rows at ${width}`).toBeGreaterThan(0);
        for (const r of ratios) expect(r, `${panel} at ${width}`).toBeGreaterThanOrEqual(0.95);
      }
    }
  });

  test("S2 typing 92,625 in Strike Level makes Strike % read 125.00 at a start of 74,100", async ({ inputs }) => {
    await inputs.goto();
    await inputs.fill("spot", "73598.67");
    await inputs.fill("strikePercents-2", "126");
    await inputs.fill("strikeLevel-2", "92625");
    await expect(inputs.field("strikePercents-2")).toHaveValue("125.00");
  });

  test("S3 spot 80,000 makes Strike Level 1 read 1,10,285", async ({ inputs }) => {
    await inputs.goto();
    await inputs.fill("spot", "80000");
    await expect.poll(async () => digits(await inputs.field("strikeLevel-0").inputValue())).toBe("110285");
  });

  test("S4 a Nifty refetch moves every Strike Level and keeps every Strike %", async ({ page, inputs }) => {
    await inputs.goto();
    const before = await strikeState(page);
    await inputs.fill("underlying", "Nifty");
    await inputs.dialog.dismissAll(3_000);
    await expect(inputs.field("spot")).not.toHaveValue("76835.78", { timeout: 30_000 });
    await expect.poll(async () => (await strikeState(page)).levels.every((l, i) => l !== before.levels[i])).toBe(true);
    expect((await strikeState(page)).percents).toEqual(before.percents);
  });

  test("S5 Strike 2 at 128 makes the Spread 1 Sell Level 28.00 and the top participation 11.06", async ({ inputs }) => {
    await inputs.goto();
    await inputs.fill("strikePercents-1", "128");
    await expect(inputs.field("spreads-0-sell")).toHaveValue("28.00");
    await expect(inputs.field("spreads-1-buy")).toHaveValue("28.00");
    await expect(inputs.field("participations-1")).toHaveValue("11.06");
  });

  test("S6 participation 12 shows the coupon error under the field, with no popup, and disables Run", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("participations-1", "12");
    await expect(page.getByTestId("participation-error-1")).toHaveText("The Spreads Pay 122.00%, Above The Coupon Of 102.50%");
    await expect(inputs.dialog.root).toHaveCount(0);
    await expect(inputs.runButton).toBeDisabled();
    await page.getByTestId("spread-1-reset").click();
    await expect(page.getByTestId("participation-error-1")).toHaveCount(0);
    await expect(inputs.runButton).toBeEnabled();
  });

  test("S7 all Put matches main, all Call matches the engine, and the payoff at 0% is 0.00% in both", async ({ page, inputs, nav }) => {
    test.setTimeout(180_000);
    const engine = (types: OptionType[]) => priceLikeTheApp({ ...mockDefaultInputs(), spreadOptionTypes: types });
    const main = { premium: 51.12022123483423, inbuilt: 0.0835573934196645 };

    await inputs.goto();
    await inputs.run();
    const put = await readRun(page, nav);
    expect(close(put.premium, main.premium, 1e-9), `put premium ${put.premium}`).toBe(true);
    expect(close(put.inbuilt, main.inbuilt, 1e-9), `put inbuilt ${put.inbuilt}`).toBe(true);
    expect(put.zero).toBe("0.00%");

    await nav.go("inputs");
    await inputs.fill("spreadOptionTypes-0", "C");
    await inputs.fill("spreadOptionTypes-1", "C");
    await inputs.run();
    const call = await readRun(page, nav);
    const want = engine(["C", "C"]);
    expect(close(call.premium, want.pricer.header.premium / 1e7, 1e-9), `call premium ${call.premium}`).toBe(true);
    expect(close(call.inbuilt, want.summary.actualInbuilt, 1e-9), `call inbuilt ${call.inbuilt}`).toBe(true);
    expect(want.diagnostics.payoffBookGap).toBeLessThan(1e-6);
    expect(call.zero).toBe("0.00%");
  });

  test("S8 no result before Run, and a reload clears everything", async ({ page, inputs, outputs }) => {
    await inputs.goto();
    await outputs.summary.open();
    await outputs.summary.expectGate();
    await page.goto("/");
    await inputs.goto();
    await inputs.run();
    await outputs.summary.expectResults();
    await page.reload();
    await outputs.summary.open();
    await outputs.summary.expectGate();
  });

  test("S9 to S11 tables: no pinned column, scrolling inside the wrapper, Primary SP Dashboard padding", async ({ page, inputs, nav }) => {
    test.setTimeout(180_000);
    await inputs.goto();
    await inputs.run();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of OUTPUT_PAGES) {
        await nav.go(id);
        await expect(page.locator(".data-table-premium").first()).toBeVisible();
        const report = await page.evaluate(() => {
          const cells = Array.from(document.querySelectorAll<HTMLElement>(".data-table-premium th, .data-table-premium td"));
          const stickyLeft = cells.filter((c) => getComputedStyle(c).position === "sticky" && getComputedStyle(c).left !== "auto").length;
          const wraps = Array.from(document.querySelectorAll<HTMLElement>(".data-table-premium")).map((t) => getComputedStyle(t.parentElement!).overflowX);
          const head = document.querySelector<HTMLElement>(".data-table-premium thead th");
          const cell = document.querySelector<HTMLElement>(".data-table-premium tbody tr:not([aria-hidden]) td");
          const pad = (el: HTMLElement | null) => (el ? `${getComputedStyle(el).paddingTop} ${getComputedStyle(el).paddingRight}` : "none");
          return {
            pinned: document.querySelectorAll(".col-pinned").length,
            stickyLeft,
            wraps,
            headPadding: pad(head),
            headFont: head ? getComputedStyle(head).fontSize : "none",
            cellPadding: pad(cell),
            pageWidth: document.documentElement.scrollWidth,
            windowWidth: window.innerWidth,
          };
        });
        const at = `${id} at ${width}`;
        expect(report.pinned, at).toBe(0);
        expect(report.stickyLeft, at).toBe(0);
        for (const o of report.wraps) expect(["auto", "scroll"], at).toContain(o);
        expect(report.pageWidth, at).toBeLessThanOrEqual(report.windowWidth);
        expect(report.headPadding, at).toBe("14px 20px");
        expect(report.headFont, at).toBe("11px");
        expect(report.cellPadding, at).toBe("12px 20px");
      }
    }
  });

  test("S12 every control is glass and text keeps 4.5 to 1 in both themes", async ({ page, inputs, nav }) => {
    test.setTimeout(180_000);
    await inputs.goto();
    await inputs.run();
    for (const theme of ["light", "dark"] as const) {
      if (theme === "dark") await nav.themeToggle.click();
      for (const id of ["inputs", "pricer"] as const) {
        await nav.go(id);
        await page.mouse.move(0, 0);
        // The theme switch transitions colours; axe must read the settled ones.
        await page.evaluate(() =>
          Promise.all(
            document
              .getAnimations()
              .filter((a) => a instanceof CSSTransition)
              .map((a) => a.finished.catch(() => undefined)),
          ),
        );
        const off = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>("button"))
            .filter((b) => b.offsetParent !== null && !b.dataset.testid?.startsWith("run-simulation"))
            .map((b) => {
              const s = getComputedStyle(b);
              const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(s.backgroundColor)?.[1] ?? (s.backgroundColor.startsWith("rgb(") ? 1 : 0));
              return { name: b.getAttribute("aria-label") ?? b.textContent?.trim(), alpha, blur: s.backdropFilter.includes("blur") };
            })
            .filter((b) => !b.blur || b.alpha < 0.12 || b.alpha > 0.36),
        );
        expect(off, `${theme} ${id}`).toEqual([]);
        const axe = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        expect(
          axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(" "))),
          `${theme} ${id} contrast`,
        ).toEqual([]);
      }
    }
  });

  test("S13 Inputs carry none of the removed jargon", async ({ page, inputs }) => {
    await inputs.goto();
    const text = await page.locator("main").innerText();
    for (const re of [/\bUnits\b/, /Outflow Step/, /ROUNDUP/, /slope/i, /Maturity Date/, /Strike \d+ To Strike \d+/]) expect(text, String(re)).not.toMatch(re);
  });
});
