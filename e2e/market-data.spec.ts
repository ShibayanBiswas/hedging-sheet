import { expect, type Page } from "@playwright/test";

import { test } from "./fixtures";
import { settle } from "./responsive/helpers";

/**
 * Market Data at three widths. Read-only, so it also runs against a live deployment:
 * nothing is saved, and uploads are refused before any request leaves the browser.
 */
const VIEWS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

async function openMarketData(page: Page) {
  await page.goto("/");
  await page.getByTestId("nav-market-data").click();
  await expect(page.getByRole("heading", { level: 1, name: "Market Data" })).toBeVisible();
  await expect(page.getByTestId("vol-grid").locator("[data-kind='date']").first()).toBeVisible({ timeout: 30_000 });
  await settle(page);
}

/** WCAG contrast of an element's text against its own background. */
async function inputContrasts(page: Page, selector: string): Promise<number[]> {
  return page.locator(selector).evaluateAll((els) => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const c = [r!, g!, b!].map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    return els
      .filter((el) => el.getBoundingClientRect().width > 0 && !(el as HTMLInputElement).disabled)
      .map((el) => {
        const s = getComputedStyle(el);
        const a = lum(rgb(s.color));
        const b = lum(rgb(s.backgroundColor));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
  });
}

for (const view of VIEWS) {
  {
    test.describe(`Market Data ${view.width} by ${view.height}`, () => {
      test.use({ viewport: view, reducedMotion: "reduce", hasTouch: view.width < 640, isMobile: view.width < 640 });

      test("layout, grid, alignment, units, toolbar, copy and the removed tables", async ({ page }) => {
        test.setTimeout(120_000);
        await openMarketData(page);

        // No sideways scroll on the page; the Headline keeps each cell on one line and scrolls inside its box.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await expect(page.getByTestId("table-market-headline")).toContainText("Fetched At");

        // The header row stays put while the grid scrolls; no column is pinned, so the Expiry column scrolls away.
        const grid = page.getByTestId("vol-grid");
        const scrolled = await grid.evaluate(async (box) => {
          box.scrollLeft = 400;
          box.scrollTop = 300;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const b = box.getBoundingClientRect();
          const head = box.querySelector("thead th")!.getBoundingClientRect();
          const firstCell = box.querySelector<HTMLElement>("tbody td[data-kind='date']")!.getBoundingClientRect();
          return { top: head.top - b.top, left: firstCell.left - b.left, scrolled: box.scrollLeft > 0 && box.scrollTop > 0 };
        });
        expect(scrolled.scrolled).toBe(true);
        expect(Math.abs(scrolled.top), "sticky header").toBeLessThanOrEqual(2);
        expect(scrolled.left, "first column scrolls with the grid").toBeLessThan(-100);

        // Numbers right aligned, dates left aligned.
        const misaligned = await page.locator("main [data-kind]").evaluateAll((cells) =>
          cells
            .filter((c) => c.getBoundingClientRect().width > 0)
            .filter((c) => {
              const kind = c.getAttribute("data-kind");
              const align = getComputedStyle(c).textAlign;
              if (kind === "date") return align !== "left" && align !== "start";
              if (kind === "text") return false;
              return align !== "right" && align !== "end";
            })
            .map((c) => `${c.getAttribute("data-kind")} "${c.textContent?.trim()}"`),
        );
        expect(misaligned).toEqual([]);

        // Volatility headers carry %; the Deep strike shows as Deep, never 500, and its volatility is the 55% one.
        const heads = await grid.locator("thead th").allTextContents();
        expect(heads).toContain("Volatility %");
        expect(heads.filter((h) => /^\d+%$/.test(h.trim())).length).toBeGreaterThan(5);
        for (const u of ["nifty", "sensex"]) await expect(page.getByTestId(`deep-strike-${u}`)).toHaveText("Deep");
        await expect(grid).not.toContainText("500.00");
        const pairs = await grid.locator("tbody tr").evaluateAll((rows) =>
          rows
            .map((r) => Array.from(r.querySelectorAll("td")).map((c) => c.textContent?.trim() ?? ""))
            .filter((cells) => cells.length > 3 && /\d{2}-\w{3}-\d{4}|\w{3} \d{2}/.test(cells[0]!))
            .map((cells) => [cells[1], cells[2]]),
        );
        expect(pairs.length).toBeGreaterThan(3);
        for (const [deep, at55] of pairs) expect(deep).toBe(at55);

        // One toolbar, every button the same height, 40 to 44 px, and at least 44 px square on phones.
        const sizes = await page.getByTestId("surface-toolbar").locator("button").evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).map((r) => ({ w: r.width, h: r.height })));
        expect(sizes.map((s) => Math.round(s.h)).every((h) => h === Math.round(sizes[0]!.h))).toBe(true);
        expect(sizes[0]!.h).toBeGreaterThanOrEqual(40);
        expect(sizes[0]!.h).toBeLessThanOrEqual(44.5);
        if (view.width < 640) expect(sizes.every((s) => s.w >= 44 && s.h >= 44)).toBe(true);
        await expect(page.getByTestId("surface-toolbar").locator("button")).toHaveText([
          "Edit Surface",
          "Upload Surface",
          "Download Current Surface",
          "Download Sample",
          "Reload From Desk Database",
        ]);

        // Copy rules: no Vol, Params, percent or brackets anywhere, and no lowercase or, and, not in labels.
        const text = await page.locator("body").innerText();
        expect(text).not.toMatch(/\bVols?\b|\bParams\b|\bpercent\b|[()[\]{}]/);
        const labels = await page.locator("main th, main button, main label, main h1, main h2, main h3, [data-testid='market-strip']").allTextContents();
        expect(labels.filter((l) => /\b(or|and|not)\b/.test(l))).toEqual([]);

        // The forward grid, rate curve and dividend tables, and the Used In, Linked and Rate Used columns, are not shown.
        for (const gone of ["Used In", "Linked To Premium Growth Rate", "Rate Used", "Pricing Parameters By Expiry", "Rate Curve As Read", "Implied Dividends"]) {
          expect(text, gone).not.toContain(gone);
        }
        for (const id of ["table-pricing-params", "table-rate-curve-used", "table-dividends"]) await expect(page.getByTestId(id)).toHaveCount(0);
        expect(await page.getByTestId("rate-curve-editor").locator("thead th").allTextContents()).toEqual(["Tenor In Years", "Rate %"]);
        expect(await page.getByTestId("surface-params-table").locator("thead th").allTextContents()).toEqual(["Parameter", "Value"]);

        // Sections are on screen without scrolling them into view.
        const hidden = await page.locator("main section.glass").evaluateAll((s) => s.filter((x) => Number(getComputedStyle(x).opacity) < 1).length);
        expect(hidden).toBe(0);

        await page.getByTestId("edit-params").click();
        const ratios = await inputContrasts(page, "[data-testid='surface-params-table'] input.input-glow, [data-testid='rate-curve-editor'] input.input-glow");
        expect(ratios.length).toBeGreaterThan(3);
        expect(Math.min(...ratios), "input text contrast").toBeGreaterThanOrEqual(4.5);
        await page.getByTestId("cancel-params").click();
      });
    });
  }
}

test.describe("Market Data behaviour", () => {
  test.use({ reducedMotion: "reduce" });

  test("editing marks abc and -5 invalid and turns Save off, with no popup", async ({ page }) => {
    await openMarketData(page);
    await page.getByTestId("edit-surface").click();
    const save = page.getByTestId("save-surface");
    await expect(save).toBeEnabled();
    for (const bad of ["abc", "-5"]) {
      const cell = page.locator('[data-testid^="vol-cell-"]').first();
      await cell.fill(bad);
      await expect(cell).toHaveAttribute("aria-invalid", "true");
      await expect(save).toBeDisabled();
      await expect(page.getByTestId("surface-invalid")).toBeVisible();
      await expect(page.getByTestId("desk-dialog")).toHaveCount(0);
      await cell.fill("20.5");
      await expect(cell).not.toHaveAttribute("aria-invalid", "true");
      await expect(save).toBeEnabled();
    }
    await page.getByTestId("discard-surface").click();
  });

  test("a text file and a workbook over 4.5 megabytes are refused inline, before any request", async ({ page }) => {
    let sent = 0;
    await page.route("**/api/uploads/**", (route) => {
      sent += 1;
      return route.abort();
    });
    await openMarketData(page);
    const file = page.getByTestId("surface-file");
    await file.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a workbook") });
    await expect(page.getByTestId("market-status")).toContainText("Upload Refused: Choose An Excel File.");
    await file.setInputFiles({ name: "big.xlsx", mimeType: "application/octet-stream", buffer: Buffer.alloc(Math.ceil(4.6 * 1024 * 1024)) });
    await expect(page.getByTestId("market-status")).toContainText("Over The 4.5 Megabyte Limit");
    await expect(page.getByTestId("desk-dialog")).toHaveCount(0);
    await expect(page.getByTestId("desk-key-dialog")).toHaveCount(0);
    expect(sent).toBe(0);
  });

  test("the upload, surface and parameter routes refuse a request without the Desk Key", async ({ request }) => {
    expect((await request.post("/api/uploads/vol-surface", { multipart: { file: { name: "x.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("PK") } } })).status()).toBe(401);
    expect((await request.post("/api/surface", { data: {} })).status()).toBe(401);
    expect((await request.post("/api/params", { data: {} })).status()).toBe(401);
  });

  test("Download Sample and Download Current Surface give non-empty workbooks", async ({ page }) => {
    await openMarketData(page);
    for (const id of ["download-sample", "download-surface"]) {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(id).click()]);
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
      const stream = await download.createReadStream();
      let size = 0;
      for await (const chunk of stream) size += (chunk as Buffer).length;
      expect(size, id).toBeGreaterThan(1000);
    }
  });

  test("with reduced motion every section is fully visible within 500 ms of load", async ({ page }) => {
    await page.goto("/market-data");
    await page.waitForTimeout(500);
    const sections = await page.locator("main section").evaluateAll((s) => s.map((x) => Number(getComputedStyle(x).opacity)));
    // Headline, Volatility Surface and Surface Parameters.
    expect(sections.length).toBe(3);
    expect(sections.every((o) => o === 1)).toBe(true);
  });
});

test.describe("Inputs page units and buttons", () => {
  test("Compute From History has no icon, and Shock Sigmas, Shock Days and Volatility Multiplier show no unit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("compute-history")).toBeVisible({ timeout: 30_000 });
    expect(await page.getByTestId("compute-history").locator("svg").count()).toBe(0);
    for (const id of ["input-stressSigmas", "input-stressDays", "input-stressVolMultiplier", "input-decay", "input-tenorDays", "input-notionalCr"]) {
      const extra = await page.getByTestId(id).evaluate((input) => (input.parentElement?.innerText ?? "").trim());
      expect(extra, id).toBe("");
    }
  });
});
