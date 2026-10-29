import { expect, type Page } from "@playwright/test";

import { test } from "./fixtures";
import { settle } from "./responsive/helpers";

/**
 * Market Data at three widths and both themes. Read-only, so it also runs against a live deployment:
 * nothing is saved, and uploads are refused before any request leaves the browser.
 */
const VIEWS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymdOf = (text: string) => {
  const [d, m, y] = text.trim().split("-");
  return `${y}-${String(MONTHS.indexOf(m!) + 1).padStart(2, "0")}-${d}`;
};

async function openMarketData(page: Page, theme: "light" | "dark") {
  await page.goto("/");
  if (theme === "dark") await page.getByTestId("theme-toggle").click();
  await page.getByTestId("nav-market-data").click();
  await expect(page.getByRole("heading", { level: 1, name: "Market Data" })).toBeVisible();
  await expect(page.getByTestId("vol-grid").locator("[data-kind='date']").first()).toBeVisible({ timeout: 30_000 });
  await settle(page);
}

async function valuationDate(page: Page): Promise<string> {
  return ymdOf(await page.getByTestId("strip-valuation").innerText());
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
  for (const theme of ["light", "dark"] as const) {
    test.describe(`Market Data ${view.width} by ${view.height} ${theme}`, () => {
      test.use({ viewport: view, reducedMotion: "reduce", hasTouch: view.width < 640, isMobile: view.width < 640 });

      test("layout, grid, alignment, units, toolbar, copy and history", async ({ page }) => {
        test.setTimeout(120_000);
        await openMarketData(page, theme);

        // No sideways scroll on the page, and none in the Headline.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        const headline = await page.getByTestId("table-market-headline").evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(headline, "Headline scrolls sideways").toBeLessThanOrEqual(1);
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

        // Volatility headers carry %, and the Deep strike comes from the data.
        const heads = await grid.locator("thead th").allTextContents();
        expect(heads).toContain("Volatility %");
        expect(heads.filter((h) => /^\d+%$/.test(h.trim())).length).toBeGreaterThan(5);
        const dataset = await (await page.request.get("/api/dataset")).json();
        const deep = Number(dataset.surface.deepStrike);
        const expected = deep > 0 ? deep.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
        for (const u of ["nifty", "sensex"]) await expect(page.getByTestId(`deep-strike-${u}`)).toHaveText(expected);

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

        // History tables start on the valuation date by default.
        const today = await valuationDate(page);
        for (const id of ["table-pricing-params", "table-dividends"]) {
          const first = await page.getByTestId(id).locator("tbody tr").first().locator("[data-kind='date']").innerText();
          expect(ymdOf(first) >= today, `${id} starts ${first}`).toBe(true);
        }

        // Sections are on screen without scrolling them into view.
        const hidden = await page.locator("main section.glass").evaluateAll((s) => s.filter((x) => Number(getComputedStyle(x).opacity) < 1).length);
        expect(hidden).toBe(0);

        if (theme === "dark") {
          await page.getByTestId("edit-params").click();
          const ratios = await inputContrasts(page, "[data-testid='surface-params-table'] input.input-glow, [data-testid='rate-curve-editor'] input.input-glow");
          expect(ratios.length).toBeGreaterThan(3);
          expect(Math.min(...ratios), "dark input text contrast").toBeGreaterThanOrEqual(4.5);
          await page.getByTestId("cancel-params").click();
        }
      });
    });
  }
}

test.describe("Market Data behaviour", () => {
  test.use({ reducedMotion: "reduce" });

  test("Show History lists the earlier rows", async ({ page }) => {
    await openMarketData(page, "light");
    const rows = page.getByTestId("table-pricing-params").locator("tbody tr");
    const upcoming = await rows.count();
    await page.getByTestId("pricing-history-toggle").click();
    await expect(page.getByTestId("pricing-history-toggle")).toHaveAttribute("aria-pressed", "true");
    expect(await rows.count()).toBeGreaterThan(upcoming);
  });

  test("editing marks abc and -5 invalid and turns Save off, with no popup", async ({ page }) => {
    await openMarketData(page, "light");
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
    await openMarketData(page, "light");
    const file = page.getByTestId("surface-file");
    await file.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a workbook") });
    await expect(page.getByTestId("market-status")).toContainText("Upload Refused: Choose An Excel Workbook.");
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
    await openMarketData(page, "light");
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
    expect(sections.length).toBeGreaterThan(4);
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
