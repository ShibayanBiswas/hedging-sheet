import type { Page } from "@playwright/test";

import { fillBlank } from "./blank/helpers";
import { expect, test } from "./fixtures";
import { settle } from "./responsive/helpers";

const WIDTHS = [1440, 1280, 1024, 768, 414, 390];

// Measurements read the settled page: under the frozen test clock entry animations never finish.
test.use({ reducedMotion: "reduce" });

/** Real geometry of the Inputs page, read in the browser. Every array holds one readable line per problem. */
function measure(page: Page) {
  return page.evaluate(() => {
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const main = document.querySelector("main")!;
    const mainStyle = getComputedStyle(main);
    const content = main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight);
    const cards = [...document.querySelectorAll<HTMLElement>('main section[id^="group-"]')];
    const narrow: string[] = [];
    const vacant: string[] = [];
    const overlaps: string[] = [];
    for (const card of cards) {
      const box = card.getBoundingClientRect();
      if (box.width / content < 0.98) narrow.push(`${card.id} is ${Math.round(box.width)} of ${Math.round(content)} px`);

      // Rows of controls outside the scrolling tables: each row's last control ends near the card's right edge.
      const controls = [...card.querySelectorAll<HTMLElement>('input:not([type="date"]):not([type="checkbox"]), select, output, button, label:has(input[type="checkbox"]), [data-testid$="-empty"]')].filter((c) => shown(c) && !c.closest('[role="table"], header'));
      const rows: Array<{ top: number; bottom: number; right: number }> = [];
      for (const c of controls.map((x) => x.getBoundingClientRect()).sort((a, b) => a.top - b.top)) {
        const row = rows.find((x) => c.top < x.bottom - 1 && c.bottom > x.top + 1);
        if (row) row.right = Math.max(row.right, c.right);
        else rows.push({ top: c.top, bottom: c.bottom, right: c.right });
      }
      for (const row of rows) if (box.right - row.right > 24) vacant.push(`${card.id}: a row at ${Math.round(row.top)} ends ${Math.round(box.right - row.right)} px from the edge`);
      for (const table of card.querySelectorAll<HTMLElement>('[role="table"]')) {
        const rail = table.parentElement!.getBoundingClientRect();
        if (box.right - rail.right > 24) vacant.push(`${card.id}: a table ends ${Math.round(box.right - rail.right)} px from the edge`);
        if (table.getBoundingClientRect().width < rail.width - 1) vacant.push(`${card.id}: a table is narrower than its box`);
      }

      // No text or control may sit on another within the card.
      const parts = [...card.querySelectorAll<HTMLElement>('input:not([type="date"]), select, button, output, label, h2, .hs-chip, p')].filter((e) => shown(e));
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i]!,
            b = parts[j]!;
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(),
            rb = b.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          // Joined segments share a border on purpose (margin-left: -1px), which Firefox lays out as 1.00003 px.
          if (w > 1.5 && h > 1) overlaps.push(`${card.id}: "${a.textContent?.slice(0, 24) || a.dataset.testid}" on "${b.textContent?.slice(0, 24) || b.dataset.testid}"`);
        }
      }
    }

    const lines = (el: Element) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top);
      let count = 0;
      let bottom = -Infinity;
      for (const r of rects) {
        if (r.top >= bottom - 2) count++;
        bottom = Math.max(bottom, r.bottom);
      }
      return count;
    };
    const labels = [...document.querySelectorAll<HTMLElement>("main section label")].filter(shown);
    const multiLine = labels.filter((l) => lines(l) > 1).map((l) => `"${l.textContent}" on ${lines(l)} lines`);
    const clipped = labels.filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => `"${l.textContent}" is cut off`);
    const rows = [...document.querySelectorAll<HTMLElement>('main section [role="row"]')].filter(shown);
    const tallRows = rows.filter((r) => r.getBoundingClientRect().height > 48).map((r) => `${r.dataset.testid ?? r.textContent?.slice(0, 20)} is ${Math.round(r.getBoundingClientRect().height)} px`);
    const wrappedRows = rows.filter((r) => [...r.querySelectorAll('[role="cell"], [role="columnheader"]')].some((c) => lines(c) > 1 && !c.querySelector("input, button"))).map((r) => r.textContent?.slice(0, 30) ?? "");

    // Every value the user can read: page text, field values and dropdown choices, with the hidden calendar control left out.
    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement!;
      if (!p.closest("script, style") && (n.textContent ?? "").trim()) texts.push(n.textContent!.trim());
    }
    const fields = [...document.querySelectorAll<HTMLInputElement>('main input:not([type="date"]):not([type="checkbox"])')].map((f) => f.value).filter(Boolean);
    const options = [...document.querySelectorAll("main select option")].map((o) => o.textContent ?? "");
    const readable = [...texts, ...fields, ...options];
    const noDates = (s: string) => s.replace(/\d{2}-[A-Z][a-z]{2}-\d{4}/g, "");
    return {
      narrow,
      vacant,
      overlaps,
      multiLine,
      clipped,
      tallRows,
      wrappedRows,
      numericDates: readable.filter((s) => /\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2}/.test(s)),
      indianGrouping: readable.filter((s) => /\d,\d{2},\d{3}/.test(s)),
      ungrouped: fields.filter((s) => /\d{4,}/.test(noDates(s))),
      longDecimals: readable.filter((s) => /\d\.\d{4,}/.test(s)),
      statusChips: cards.map((c) => [...c.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^(Calculated|Edited)$/.test((e.textContent ?? "").trim())).length),
    };
  });
}

async function expectSound(page: Page) {
  await settle(page);
  const m = await measure(page);
  expect(m.narrow, "group cards below 98% of the content width").toEqual([]);
  expect(m.vacant, "vacant space on the right").toEqual([]);
  expect(m.overlaps.slice(0, 10), "overlaps").toEqual([]);
  expect(m.multiLine, "labels on more than one line").toEqual([]);
  expect(m.clipped, "labels cut off").toEqual([]);
  expect(m.tallRows, "table rows above one line").toEqual([]);
  expect(m.wrappedRows, "table cells on more than one line").toEqual([]);
  expect(m.numericDates, "dates in a numeric format").toEqual([]);
  expect(m.indianGrouping, "a second grouping style").toEqual([]);
  expect(m.ungrouped, "fields without a thousands separator").toEqual([]);
  expect(m.longDecimals, "more than 3 decimals").toEqual([]);
  for (const [i, n] of m.statusChips.entries()) expect(n, `status chips in group ${i + 1}`).toBeLessThanOrEqual(1);
}

async function expectOneChipTopRight(page: Page, text: "Calculated" | "Edited") {
  const card = page.getByTestId("group-6");
  await expect(card.getByText(/^(Calculated|Edited)$/)).toHaveCount(1);
  const chip = page.getByTestId("daily-vol-status");
  await expect(chip).toHaveText(text);
  const c = (await chip.boundingBox())!;
  const b = (await card.boundingBox())!;
  const first = (await page.getByTestId("input-dailyVol").boundingBox())!;
  expect(b.x + b.width - (c.x + c.width), "chip at the right edge").toBeLessThanOrEqual(24);
  expect(c.y + c.height, "chip above the fields").toBeLessThanOrEqual(first.y);
  expect(c.y - b.y, "chip at the top").toBeLessThanOrEqual(48);
}

for (const width of WIDTHS) {
  test.describe(`Final Inputs at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("Default Values: full width, no vacant space, single lines, one chip, one number and date style", async ({ page, inputs }) => {
      await inputs.goto();
      await expectSound(page);
      await expectOneChipTopRight(page, "Calculated");
      await inputs.fill("input-annualVol", "18");
      await expectOneChipTopRight(page, "Edited");
      await page.getByTestId("compute-history").click();
      await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
      await expectOneChipTopRight(page, "Calculated");
      await expectSound(page);
    });

    test("Blank Inputs: the same layout once filled; locked steps are slim rows until then", async ({ page, inputs }) => {
      test.setTimeout(180_000);
      await inputs.goto("blank");
      await expectSound(page);
      await expect(page.getByTestId("group-2-locked")).toHaveText("Complete Step 1 First");
      for (const step of [2, 3, 4, 5, 6, 7]) {
        const card = page.getByTestId(`group-${step}`);
        const box = (await card.boundingBox())!;
        // Phones have no room for the title and the chip side by side on the longest titles.
        expect(box.height, `locked group ${step}`).toBeLessThanOrEqual(width < 640 ? 92 : 56);
        await expect(card.locator("input:visible, select:visible")).toHaveCount(0);
      }

      await inputs.fill("input-underlying", "Sensex");
      await inputs.fill("input-valuationDate", "2026-10-28");
      await expect(page.getByTestId("expiries-empty")).toHaveText("Select Number Of Expiry Dates");
      await expectSound(page);

      await fillBlank(inputs);
      await expectSound(page);
      await page.getByTestId("compute-volatility").click();
      await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
      await expectOneChipTopRight(page, "Calculated");
      await expect(page.getByTestId("vol-history-note")).toHaveText(/^\d+ Daily Returns From \d{2}-[A-Z][a-z]{2}-\d{4} To \d{2}-[A-Z][a-z]{2}-\d{4}$/);
    });

    test("the Run bar runs edge to edge, sticks to the bottom and leaves no gap below it", async ({ page, inputs }) => {
      await inputs.goto("blank");
      const bar = page.locator(".hs-run-bar");
      const footer = page.getByTestId("desk-footer");
      // The collapsed steps settle after the mode switch; the bar then rests right on the footer.
      await expect
        .poll(async () => {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const b = (await bar.boundingBox())!;
          return Math.abs(b.y + b.height - (await footer.boundingBox())!.y);
        }, { message: "the footer starts where the bar ends" })
        .toBeLessThanOrEqual(1);
      const a = (await bar.boundingBox())!;
      expect(a.x).toBeLessThanOrEqual(0.5);
      expect(a.x + a.width).toBeGreaterThanOrEqual(width - 0.5);
      expect(a.height, "a slim bar").toBeLessThanOrEqual(60);
      const status = (await page.getByTestId("run-status").boundingBox())!;
      const run = (await inputs.runButton.boundingBox())!;
      expect(status.x, "the status chip sits to the right of Run Simulation").toBeGreaterThanOrEqual(run.x + run.width - 1);
      expect(width - (status.x + status.width), "the status chip ends at the right").toBeLessThanOrEqual(33);

      await page.getByTestId("mode-default").click();
      await page.getByTestId("confirm-switch-mode").click();
      await expect(inputs.field("spot")).not.toHaveValue("", { timeout: 30_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const stuck = (await bar.boundingBox())!;
      expect(Math.abs(stuck.y + stuck.height - 900), "the bar sits on the window's bottom edge").toBeLessThanOrEqual(1);
    });
  });
}

test.describe("Final Inputs at 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** The rows of field tops within a group. */
  const rowsOf = (page: Page, step: number) =>
    page.getByTestId(`group-${step}`).evaluate((card) => {
      const tops = [...card.querySelectorAll<HTMLElement>('input:not([type="date"]):not([type="checkbox"]), select')].filter((e) => !e.closest('[role="table"]')).map((e) => Math.round(e.getBoundingClientRect().top));
      return { rows: new Set(tops).size, fields: tops.length };
    });

  test("Rates, Product Terms and Volatility each fit one row, with Underlying And Market", async ({ page, inputs }) => {
    await inputs.goto();
    for (const step of [1, 4, 5, 6]) expect((await rowsOf(page, step)).rows, `group ${step}`).toBe(1);
    const tiles = (await page.getByTestId("start-level").boundingBox())!;
    const spot = (await inputs.field("spot").boundingBox())!;
    expect(tiles.y, "Start Level on the Spot's row").toBeLessThan(spot.y + spot.height);
    await expect(page.getByTestId("spot-fetched-at")).toHaveText(/^\d{1,2}:\d{2} (am|pm) IST$/);
    // Six fields across: Margin And Desk Terms is 12 fields on 2 rows.
    expect(await rowsOf(page, 7)).toEqual({ rows: 2, fields: 12 });
  });

  test("expiries: the count and hedge dropdown on one row, then 6 equal date cards on the next, dates as 26-Sep-2030, snapping kept", async ({ page, inputs }) => {
    await inputs.goto();
    await settle(page);
    const count = (await inputs.field("expiryCount").boundingBox())!;
    const hedge = (await inputs.field("hedgeExpiryIndex").boundingBox())!;
    expect(Math.abs(hedge.y - count.y), "the hedge dropdown on the count's row").toBeLessThanOrEqual(1);
    const cards = await Promise.all([0, 1, 2, 3, 4, 5].map(async (i) => (await page.getByTestId(`expiry-card-${i}`).boundingBox())!));
    for (const [i, c] of cards.entries()) {
      expect(c.y, `card ${i} below the dropdowns`).toBeGreaterThan(count.y + count.height);
      expect(Math.abs(c.y - cards[0]!.y), `card ${i} on the first card's row`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.width - cards[0]!.width), `card ${i} as wide as the first`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.height - cards[0]!.height), `card ${i} as tall as the first`).toBeLessThanOrEqual(1);
    }
    // Every card says Observation; the hedge expiry alone is framed and named on its edge.
    await expect(page.getByTestId("expiry-card-2")).toHaveClass(/expiry-card-hedge/);
    await expect(page.locator(".expiry-card-hedge")).toHaveCount(1);
    await expect(page.getByTestId("expiry-card-2").getByTestId("expiry-hedge-badge")).toHaveText("Hedge Option Expiry");
    await expect(page.getByTestId("expiry-hedge-badge")).toHaveCount(1);
    for (const i of [0, 1, 2, 3, 4, 5]) await expect(page.getByTestId(`expiry-role-${i}`)).toHaveText("Observation");
    await expect(page.getByRole("textbox", { name: "Expiry 3 · Observation And Hedge Option Expiry" })).toBeVisible();
    await expect(inputs.field("hedgeExpiryIndex").locator("option:checked")).toHaveText("Median · Expiry 3");
    await expect(page.locator("#group-2")).toContainText("The Median Expiry Unless Picked");
    await expect(inputs.field("expiryDates-2")).toHaveValue("26-Sep-2030");
    await inputs.fill("expiryDates-0", "2030-04-01");
    await expect(inputs.field("expiryDates-0")).toHaveValue("25-Apr-2030");
    await expect(inputs.field("expiryDates-0")).toHaveAttribute("data-value", "2030-04-25");
    // The snapping note sits under the role, and the row's cards stay one height.
    await expect(page.getByTestId("expiry-note-0")).toHaveText("Moved To The Last Thursday, 25-Apr-2030");
    await expect(page.getByTestId("expiry-role-0")).toHaveText("Observation");
    const heights = await Promise.all([0, 5].map(async (i) => (await page.getByTestId(`expiry-card-${i}`).boundingBox())!.height));
    expect(Math.abs(heights[0]! - heights[1]!)).toBeLessThanOrEqual(1);
    // Picking another hedge expiry moves the mark.
    await inputs.field("hedgeExpiryIndex").selectOption("4");
    await expect(page.getByTestId("expiry-card-4").getByTestId("expiry-hedge-badge")).toBeVisible();
    await expect(page.locator(".expiry-card-hedge")).toHaveCount(1);
    await expect(page.getByTestId("expiry-card-2")).not.toHaveClass(/expiry-card-hedge/);
  });

  test("a date field takes the desk format, the numeric forms and the calendar; text that is no date reverts with a popup", async ({ page, inputs, dialog }) => {
    await inputs.goto();
    const field = page.getByRole("textbox", { name: "Valuation Date", exact: true });
    await expect(field).toHaveAttribute("data-testid", "input-valuationDate");
    await field.fill("27-Oct-2026");
    await field.press("Enter");
    await expect(field).toHaveAttribute("data-value", "2026-10-27");
    for (const typed of ["26-10-2026", "2026-10-26"]) {
      await field.fill(typed);
      await field.blur();
      await expect(field).toHaveValue("26-Oct-2026");
    }
    await field.fill("not a date");
    await field.blur();
    await dialog.expectTitle("Valuation Date Reverted");
    await dialog.close();
    await expect(field).toHaveValue("26-Oct-2026");

    // The calendar: a real button in the tab order, and the native control behind it only ever holds the picked date.
    const open = page.getByRole("button", { name: "Open Calendar For Valuation Date" });
    await expect(open).toBeVisible();
    await page.keyboard.press("Escape");
    await open.focus();
    expect(await open.evaluate((b) => getComputedStyle(b).outlineStyle)).not.toBe("none");
    const picker = page.getByTestId("group-1").locator('input[type="date"]');
    await expect(picker).toHaveValue("2026-10-26");
    await expect(picker).toHaveAttribute("tabindex", "-1");
    await picker.evaluate((el: HTMLInputElement) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, "2026-10-20");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(field).toHaveValue("20-Oct-2026");
  });

  test("strikes and spreads: full-width tables, one toggle per choice, the Calculated chip once in the Participation Rate heading", async ({ page, inputs }) => {
    await inputs.goto();
    const group = (await page.getByTestId("group-3").boundingBox())!;
    const row = (await page.getByTestId("strike-row-0").boundingBox())!;
    expect(row.width / group.width).toBeGreaterThan(0.97);
    expect(row.height).toBeGreaterThanOrEqual(36);
    expect(row.height).toBeLessThanOrEqual(44);
    await expect(page.getByTestId("strike-row-0").getByRole("radiogroup")).toHaveCount(2);
    const heading = page.getByRole("columnheader", { name: /Participation Rate/ });
    await expect(heading.getByTestId("spread-1-participation-status")).toHaveText("Calculated");
    await expect(page.getByTestId("group-3").getByText(/^(Calculated|Edited)$/)).toHaveCount(1);
    for (const h of ["Strike", "Level %", "Level In Points", "Option Type", "Buy Or Sell", "Units", "Spread", "Buy Level %", "Sell Level %", "Pays"]) {
      await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    }
    // Units line up on the right, whatever their sign.
    const align = await page.getByTestId("strike-units-0").evaluate((e) => {
      const range = document.createRange();
      range.selectNodeContents(e);
      return { gap: e.getBoundingClientRect().right - range.getBoundingClientRect().right, text: e.textContent };
    });
    expect(align.text).toMatch(/^-\d+\.\d{3}$/);
    expect(align.gap).toBeLessThanOrEqual(14);
  });

  test("Blank Inputs: Select Number Of Strikes is one slim row, then the same tables with - placeholders", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await inputs.fill("input-underlying", "Sensex");
    await inputs.fill("input-valuationDate", "2026-10-28");
    await inputs.fill("input-expiryCount", "1");
    await inputs.fill("input-expiryDates-0", "2030-04-25");
    const slim = page.getByTestId("strikes-empty");
    await expect(slim).toHaveText("Select Number Of Strikes");
    expect((await slim.boundingBox())!.height).toBeLessThanOrEqual(44);
    await inputs.fill("input-spreadCount", "1");
    await expect(slim).toHaveCount(0);
    await expect(inputs.field("strikePercents-0")).toHaveAttribute("placeholder", "-");
    await expect(inputs.field("participations-0")).toHaveAttribute("placeholder", "-");
  });

  test("the spot and the strike points group the same way and percent fields keep their unit inside", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.fill("spot", "74151.04");
    await expect(inputs.field("spot")).toHaveValue("74,151.04");
    await expect(inputs.field("strikeLevel-0")).toHaveValue(/^\d{3},\d{3}$/);
    await expect(inputs.field("nbfcRate")).toHaveValue("8.000");
    const field = (await inputs.field("nbfcRate").boundingBox())!;
    const unit = (await inputs.field("nbfcRate").locator("xpath=following-sibling::span").boundingBox())!;
    expect(unit.x + unit.width).toBeLessThanOrEqual(field.x + field.width);
    expect(unit.x).toBeGreaterThan(field.x);
    await expect(page.locator("main")).not.toContainText(/\d,\d{2},\d{3}/);
  });

  test("the Simulation Completed toast sits above the Run bar at the bottom right", async ({ page, inputs }) => {
    await inputs.goto();
    const bar = (await page.locator(".hs-run-bar").boundingBox())!;
    await inputs.runButton.click();
    const toast = (await page.getByTestId("desk-toast").boundingBox())!;
    expect(toast.y + toast.height).toBeLessThanOrEqual(bar.y + 1);
    expect(1440 - (toast.x + toast.width)).toBeLessThanOrEqual(24.5);
  });
});
