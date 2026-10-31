import type { Page } from "@playwright/test";

/** Phone, the 1024 px tab break, and the desk desktop. */
export const WIDTHS = [1440, 1024, 390] as const;

/** Space between the footer's right edge and its rightmost text. */
export function footerRightGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const f = document.querySelector<HTMLElement>("[data-testid='desk-footer']")!;
    const leaves = Array.from(f.querySelectorAll<HTMLElement>("*")).filter((e) => e.children.length === 0 && (e.textContent ?? "").trim() && e.getBoundingClientRect().width > 0);
    return Math.round(f.getBoundingClientRect().right - Math.max(...leaves.map((e) => e.getBoundingClientRect().right)));
  });
}

/** Space between the last Inputs section, or the Run bar, and the footer. */
export function inputsBottomGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const footer = document.querySelector<HTMLElement>("[data-testid='desk-footer']")!;
    const bottoms = Array.from(document.querySelectorAll<HTMLElement>("main section")).map((s) => s.getBoundingClientRect().bottom);
    const run = document.querySelector<HTMLElement>("[data-testid='run-simulation']");
    if (run) bottoms.push(run.getBoundingClientRect().bottom);
    return Math.round(footer.getBoundingClientRect().top - Math.max(...bottoms));
  });
}

/** Table cells pinned to the left edge. */
export function stickyLeftCells(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main th, main td"))
      .filter((c) => getComputedStyle(c).position === "sticky" && getComputedStyle(c).left !== "auto")
      .map((c) => (c.textContent ?? "").trim().slice(0, 30)),
  );
}

/** Header and body cells whose text breaks onto a second line. */
export function wrappedCells(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main th, main td")).flatMap((cell) => {
      // Rectangles of the text itself; a new line starts below the bottom of the line before it.
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!(n.textContent ?? "").trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        rects.push(...Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0));
      }
      rects.sort((a, b) => a.top - b.top);
      let lines = 0;
      let bottom = -Infinity;
      for (const r of rects) {
        if (r.top >= bottom - 2) lines++;
        bottom = Math.max(bottom, r.bottom);
      }
      return lines > 1 ? [`"${(cell.textContent ?? "").trim().slice(0, 40)}" on ${lines} lines`] : [];
    }),
  );
}

/**
 * Backgrounds that are not plain white: any image or gradient, and any colour. Controls may carry a faint neutral
 * fill, at most 12% opaque; the desk's own neutral table stripes count as controls of the table.
 */
export function tintedBackgrounds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const control = "button, [role='tab'], [role='radio'], select, input, textarea, a, .data-table-premium td, .data-table-premium th";
    return Array.from(document.querySelectorAll<HTMLElement>("body, body *"))
      .filter((el) => !el.closest("svg") && getComputedStyle(el).display !== "none")
      .flatMap((el) => {
        const s = getComputedStyle(el);
        const name = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`;
        if (s.backgroundImage !== "none") return [`${name} has a background image`];
        const [r, g, b, a = "1"] = s.backgroundColor.match(/[\d.]+/g) ?? ["0", "0", "0", "0"];
        const alpha = Number(a);
        if (alpha === 0 || (Number(r) === 255 && Number(g) === 255 && Number(b) === 255)) return [];
        const neutral = Math.max(+r!, +g!, +b!) - Math.min(+r!, +g!, +b!) <= 40 && alpha <= 0.12;
        if (neutral && el.closest(control)) return [];
        return [`${name} has ${s.backgroundColor}`];
      });
  });
}

/** Tables over 12 rows: each must scroll inside a box no taller than min(70vh, 40rem), with a sticky header. */
export function longTableProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const cap = Math.min(window.innerHeight * 0.7, 640) + 1;
    for (const table of Array.from(document.querySelectorAll<HTMLTableElement>("main table"))) {
      if (table.tBodies[0] == null || table.tBodies[0].rows.length <= 12) continue;
      const box = table.parentElement!;
      const name = table.closest("[data-testid^='table-']")?.getAttribute("data-testid") ?? "table";
      const s = getComputedStyle(box);
      if (!/auto|scroll/.test(s.overflowY)) out.push(`${name}: the box does not scroll`);
      if (box.clientHeight > cap) out.push(`${name}: the box is ${box.clientHeight}px, above ${Math.round(cap)}px`);
      const th = table.querySelector("thead th");
      if (th && getComputedStyle(th).position !== "sticky") out.push(`${name}: the header is not sticky`);
    }
    return out;
  });
}
