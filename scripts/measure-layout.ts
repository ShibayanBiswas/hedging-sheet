/**
 * Measures the sign-off layout checks on a running app, read only: press Run, then crawl every tab.
 *   npx tsx scripts/measure-layout.ts https://hedging-sheet.vercel.app
 * Prints one JSON line per width with: numbers above 3 decimals per tab, sticky left cells, the tallest header and cell,
 * the tallest table wrapper against its scroll height, the footer's right gap, the gap below the Inputs content,
 * and elements with a background image or a tinted background.
 */
import { chromium, type Page } from "@playwright/test";

const BASE = (process.argv[2] ?? "http://localhost:3006").replace(/\/$/, "");
const TABS = ["summary", "pricer", "product", "vega-hedge", "margin", "market-data", "logic-atlas"] as const;

async function measure(page: Page) {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>("main th, main td"));
    const decimals = cells
      .map((c) => (c.textContent ?? "").trim())
      .filter((t) => /\d\.\d{4,}/.test(t));
    const stickyLeft = cells.filter((c) => getComputedStyle(c).position === "sticky" && getComputedStyle(c).left !== "auto").length;
    const tallestHead = Math.max(0, ...Array.from(document.querySelectorAll<HTMLElement>("main th")).map((c) => c.getBoundingClientRect().height));
    const tallestCell = Math.max(0, ...Array.from(document.querySelectorAll<HTMLElement>("main td")).map((c) => c.getBoundingClientRect().height));
    const wraps = Array.from(document.querySelectorAll<HTMLElement>("main table")).map((t) => {
      const w = t.parentElement!;
      return { client: w.clientHeight, scroll: w.scrollHeight, overflowY: getComputedStyle(w).overflowY };
    });
    // A control may carry a faint neutral fill; everything else is white or transparent with no image.
    const control = "button, [role='tab'], select, input, a.glass-control, .glass-control, .glass-active-pill, .hs-segment-glow";
    const tintedList = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => getComputedStyle(el).display !== "none" && !el.closest("svg"))
      .flatMap((el) => {
        const s = getComputedStyle(el);
        if (s.backgroundImage !== "none") return [`image ${el.tagName}.${String(el.className).slice(0, 40)}`];
        const [r, g, b, a = "1"] = s.backgroundColor.match(/[\d.]+/g) ?? ["0", "0", "0", "0"];
        const alpha = s.backgroundColor === "transparent" ? 0 : Number(a);
        if (alpha === 0 || (+r! === 255 && +g! === 255 && +b! === 255)) return [];
        const neutral = Math.max(+r!, +g!, +b!) - Math.min(+r!, +g!, +b!) <= 40 && alpha <= 0.12;
        if (neutral && el.closest(control)) return [];
        if (neutral && el.matches(".data-table-premium td")) return [];
        return [`${s.backgroundColor} ${el.tagName}.${String(el.className).slice(0, 50)} "${(el.textContent ?? "").trim().slice(0, 20)}"`];
      });
    return {
      decimals: decimals.length,
      sample: decimals.slice(0, 3),
      stickyLeft,
      tallestHead: Math.round(tallestHead),
      tallestCell: Math.round(tallestCell),
      wraps,
      tinted: tintedList.length,
      tintedSample: tintedList.slice(0, 12),
    };
  });
}

async function footerGap(page: Page) {
  return page.evaluate(() => {
    const f = document.querySelector<HTMLElement>("[data-testid='desk-footer']");
    if (!f) return null;
    const box = f.getBoundingClientRect();
    const right = Math.max(...Array.from(f.querySelectorAll<HTMLElement>("*")).filter((e) => e.children.length === 0 && (e.textContent ?? "").trim()).map((e) => e.getBoundingClientRect().right));
    return Math.round(box.right - right);
  });
}

async function inputsGap(page: Page) {
  return page.evaluate(() => {
    const f = document.querySelector<HTMLElement>("[data-testid='desk-footer']")!;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section"));
    const last = Math.max(...sections.map((s) => s.getBoundingClientRect().bottom + window.scrollY));
    const run = document.querySelector<HTMLElement>("[data-testid='run-simulation']");
    const runBottom = run ? run.getBoundingClientRect().bottom + window.scrollY : 0;
    return Math.round(f.getBoundingClientRect().top + window.scrollY - Math.max(last, runBottom));
  });
}

async function main() {
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await page.goto(BASE + "/");
    await page.waitForFunction(() => (document.querySelector<HTMLInputElement>("[data-testid=input-spot]")?.value ?? "") !== "", null, { timeout: 60_000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const out: Record<string, unknown> = { width, inputsGap: await inputsGap(page), footerRightGap: await footerGap(page), inputs: await measure(page) };
    await page.getByTestId("run-simulation").click();
    await page.waitForURL(/\/summary$/, { timeout: 60_000 });
    for (let i = 0; i < 6; i++) {
      await page.getByTestId("desk-dialog-ok").click({ timeout: 1500 }).catch(() => undefined);
      await page.waitForTimeout(300);
    }
    for (const tab of TABS) {
      await page.getByTestId(`nav-${tab}`).click();
      await page.waitForURL(new RegExp(`/${tab}$`));
      await page.waitForTimeout(700);
      out[tab] = await measure(page);
    }
    console.log(JSON.stringify(out));
    await page.close();
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
