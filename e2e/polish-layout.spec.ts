import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { TAB_IDS } from "./pages";
import type { TabId } from "./pages/nav-bar";
import { audit } from "./responsive/audit";
import { settle } from "./responsive/helpers";
import { wrappedCells } from "./support/layout";

/** Three widths by default; E2E_FULL_WIDTHS=1 runs all nine, as test:local:full and test:vercel do. */
const ALL_WIDTHS = [360, 390, 414, 768, 1024, 1280, 1440, 1920, 2560];
const WIDTHS = process.env.E2E_FULL_WIDTHS === "1" ? ALL_WIDTHS : [390, 1024, 2560];
const PHONE_BELOW = 640;
const CONTENT_MAX = 1680;
const ACTION_GAP_MAX = 16;
const TOUCH_MIN = 43.5;

// Measurements read the settled page: under the frozen test clock nothing else may still be moving.
test.use({ reducedMotion: "reduce" });

/** Real geometry of the open tab, read in the browser. Every entry is one readable line per problem. */
function measure(page: Page, tab: TabId) {
  return page.evaluate(
    ({ tab, CONTENT_MAX, ACTION_GAP_MAX, TOUCH_MIN, PHONE_BELOW }) => {
      const out: string[] = [];
      const vw = window.innerWidth;
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest(".sr-only");
      };
      const name = (el: Element) => (el as HTMLElement).dataset?.testid ?? (el.textContent ?? "").trim().slice(0, 30);

      // No sideways scroll on the page.
      const page = document.documentElement.scrollWidth;
      if (page > vw) out.push(`the page is ${page} px wide in a ${vw} px window`);

      // Content stops at 1680 px, centred, and everything lines up with it.
      const main = document.querySelector("main")!;
      const box = main.getBoundingClientRect();
      const style = getComputedStyle(main);
      const left = box.left + parseFloat(style.paddingLeft);
      const right = box.right - parseFloat(style.paddingRight);
      if (right - left > CONTENT_MAX + 0.5) out.push(`content is ${right - left} px wide`);
      if (Math.abs(left - box.left - (box.right - right)) > 1) out.push(`content is not centred: ${left - box.left} and ${box.right - right} px`);
      const edges: Array<[string, Element | null]> = [
        ["header", document.querySelector(".brand-header-row")],
        ["tabs", document.querySelector('nav[aria-label="Sections"]')],
        ["footer", document.querySelector(".desk-footer-grid")],
      ];
      for (const [what, el] of edges) {
        const r = el!.getBoundingClientRect();
        const s = getComputedStyle(el!);
        const l = r.left + parseFloat(s.paddingLeft);
        const e = r.right - parseFloat(s.paddingRight);
        if (Math.abs(l - left) > 1 || Math.abs(e - right) > 1) out.push(`${what} runs ${Math.round(l)} to ${Math.round(e)}, content ${Math.round(left)} to ${Math.round(right)}`);
      }

      // One action group, in one order, at the far right, one height, each with an icon and a label.
      const groups = [...document.querySelectorAll("main [data-testid='tab-actions']")];
      if (groups.length !== 1) out.push(`${groups.length} action groups`);
      const group = groups[0]!;
      const buttons = [...group.querySelectorAll("button")].filter(shown);
      const ids = buttons.map((b) => b.dataset.testid);
      const want = [...(tab === "inputs" ? ["reset-inputs"] : []), "download-excel", `download-pdf-${tab}`];
      if (ids.join() !== want.join()) out.push(`actions are ${ids.join()}, want ${want.join()}`);
      for (const b of buttons) {
        if (!b.querySelector("svg")) out.push(`${name(b)} has no icon`);
        if (!(b.textContent ?? "").trim()) out.push(`${name(b)} has no label`);
        if (b.scrollWidth > b.clientWidth + 1) out.push(`${name(b)} is cut off`);
        if (getComputedStyle(b).backgroundImage !== "none") out.push(`${name(b)} is not the glass style`);
      }
      if (new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().height))).size > 1) out.push(`action heights differ`);
      // Every wrapped row of the group ends at the right.
      const rows = new Map<number, number>();
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        rows.set(Math.round(r.top), Math.max(rows.get(Math.round(r.top)) ?? 0, r.right));
      }
      for (const [top, end] of rows) if (right - end > ACTION_GAP_MAX) out.push(`the actions at ${top} end ${Math.round(right - end)} px from the content edge`);
      if (rows.size && Math.max(...rows.values()) > right + 0.5) out.push(`the actions run past the content edge`);

      // The heading never sits on its actions, and on a phone the actions have their own row.
      const heading = group.parentElement!;
      const title = [...heading.children].filter((c) => c !== group && shown(c));
      for (const t of title) {
        const a = t.getBoundingClientRect();
        const g = group.getBoundingClientRect();
        if (Math.min(a.right, g.right) - Math.max(a.left, g.left) > 1 && Math.min(a.bottom, g.bottom) - Math.max(a.top, g.top) > 1) out.push(`the heading overlaps the actions`);
      }
      if (vw < PHONE_BELOW && title.some((t) => t.getBoundingClientRect().bottom > group.getBoundingClientRect().top + 1)) out.push(`the actions do not have their own row`);

      // Header and footer: nothing cut off, nothing on top of its neighbour.
      const strip = document.querySelector<HTMLElement>("[data-testid='market-strip']")!;
      if (shown(strip) && strip.scrollWidth > strip.clientWidth + 1) out.push(`the market strip shows ${strip.clientWidth} of ${strip.scrollWidth} px`);
      const cells = [...document.querySelectorAll<HTMLElement>(".footer-cell")].filter(shown);
      for (const cell of cells) {
        const r = cell.getBoundingClientRect();
        const ink = [...cell.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().right), 0);
        if (ink > right + 0.5) out.push(`${name(cell)} runs to ${Math.round(ink)}, past the content edge at ${Math.round(right)}`);
        if (ink > r.right + 1) out.push(`${name(cell)} spills out of its cell`);
      }
      for (const a of cells) {
        for (const b of cells) {
          if (a === b) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          if (Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 1 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 1) out.push(`${name(a)} overlaps ${name(b)}`);
        }
      }

      // Tables that are wider than their box scroll inside it and show a fade on the side with more to see.
      for (const rail of document.querySelectorAll<HTMLElement>("main .desk-table-scroll")) {
        if (!shown(rail) || rail.scrollWidth <= rail.clientWidth + 1) continue;
        const after = getComputedStyle(rail.parentElement!, "::after");
        const fades = rail.hasAttribute("data-scroll-right") && after.backgroundImage.includes("gradient") && after.content !== "none";
        if (rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1 && !fades) out.push(`${rail.getAttribute("aria-label")}: no fade hint at the right`);
        if (rail.parentElement!.getBoundingClientRect().height > rail.getBoundingClientRect().height + 1) out.push(`${rail.getAttribute("aria-label")}: the fade is taller than the table`);
      }

      // Touch targets on phones.
      if (vw < PHONE_BELOW) {
        const targets = document.querySelectorAll<HTMLElement>("a[href], button, select, input:not([type='hidden']):not(.date-picker-native), [role='tab'], [role='radio'], summary, .field-tip");
        for (const el of targets) {
          if (!shown(el)) continue;
          const hit = el.matches("input[type='checkbox']") ? (el.closest("label") ?? el) : el;
          const r = hit.getBoundingClientRect();
          if (r.height < TOUCH_MIN || r.width < TOUCH_MIN) out.push(`${name(el)} is ${Math.round(r.width)} by ${Math.round(r.height)} px`);
        }
      }
      return out;
    },
    { tab, CONTENT_MAX, ACTION_GAP_MAX, TOUCH_MIN, PHONE_BELOW },
  );
}

/** R1 to R3 of the responsive audit: no sideways scroll, no text out of its box, no controls on top of each other. */
async function overlaps(page: Page, where: string) {
  const lines = await audit(page, where, { touch: false, headingsOneLine: false });
  return lines.filter((l) => /: R[123] /.test(l));
}

for (const width of WIDTHS) {
  test.describe(`Final polish layout at ${width} px`, () => {
    test.use({ viewport: { width, height: width < PHONE_BELOW ? 844 : 900 }, hasTouch: width < 1024 });

    test("every tab, before and after Run", async ({ page, inputs, nav }) => {
      test.setTimeout(300_000);
      await inputs.goto();
      for (const tab of TAB_IDS) {
        await nav.go(tab);
        await settle(page);
        expect.soft(await measure(page, tab), `${tab} before Run`).toEqual([]);
      }
      await nav.go("inputs");
      await inputs.run();
      for (const tab of TAB_IDS) {
        await nav.go(tab);
        await settle(page);
        expect.soft(await measure(page, tab), `${tab} after Run`).toEqual([]);
        expect.soft(await overlaps(page, tab), `${tab} after Run`).toEqual([]);
        expect.soft((await wrappedCells(page)).slice(0, 10), `${tab}: single-line cells`).toEqual([]);
      }
    });
  });
}

test.describe("Final polish actions", () => {
  test("Blank Inputs keeps Clear All Inputs in the same place, and it still clears", async ({ page, inputs }) => {
    await inputs.goto("blank");
    await expect(inputs.resetButton).toHaveText("Clear All Inputs");
    expect(await measure(page, "inputs")).toEqual([]);
    await inputs.fill("underlying", "Sensex");
    await expect(inputs.field("underlying")).toHaveValue("Sensex");
    await inputs.resetButton.click();
    await expect(inputs.field("underlying")).toHaveValue("");
  });

  test("the title and the mode toggle stay left on Inputs, and Upload Surface stays in the header", async ({ page, inputs }) => {
    await inputs.goto();
    const title = (await inputs.heading.boundingBox())!;
    const toggle = (await inputs.modeSwitch.boundingBox())!;
    const actions = (await page.getByTestId("tab-actions").boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(toggle.x);
    expect(toggle.x + toggle.width).toBeLessThanOrEqual(actions.x);
    await expect(page.getByTestId("site-header").getByTestId("header-upload")).toBeVisible();
    await expect(page.getByTestId("site-header").getByTestId("download-excel")).toHaveCount(0);
  });

  test("Market Data downloads sit in the heading row and the surface buttons keep their own row under the description", async ({ page, inputs, marketData }) => {
    await inputs.goto();
    await marketData.open();
    await expect(page.getByTestId("tab-actions").getByTestId("download-pdf-market-data")).toBeVisible();
    const toolbar = page.getByTestId("surface-toolbar");
    await expect(toolbar.getByTestId("upload-surface")).toBeVisible();
    await expect(toolbar.getByTestId("download-excel")).toHaveCount(0);
    const description = (await page.getByText("Expiries beyond").boundingBox())!;
    expect((await toolbar.boundingBox())!.y).toBeGreaterThanOrEqual(description.y + description.height - 1);
  });
});

test.describe("Final polish first paint", () => {
  test("the server's HTML is visible as it arrives, with no script needed to reveal it", async ({ request }) => {
    for (const path of ["/", "/summary", "/market-data", "/logic-atlas"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toContain("desk-page-enter");
      expect(html.match(/style="[^"]*opacity:\s*0/g) ?? [], path).toEqual([]);
    }
  });

  test("under reduced motion nothing fades: no entrance animation runs on any tab", async ({ page, inputs, nav }) => {
    await inputs.goto();
    for (const tab of TAB_IDS) {
      await nav.go(tab);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation && a.animationName === "hs-enter").length);
      expect(running, tab).toBe(0);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector(".desk-page-enter")!).opacity), tab).toBe("1");
    }
  });
});
