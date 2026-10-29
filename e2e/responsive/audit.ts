import type { Page } from "@playwright/test";

import { ICON_SIZES, TYPE_SCALE, type Viewport } from "./viewports";

export type AuditOptions = {
  /** R6: touch targets apply on phones and tablets. */
  touch: boolean;
  /** R7 headings at 1280 px must fit one line. */
  headingsOneLine: boolean;
};

/**
 * R1 to R7 on the current page, run in the browser. Returns one readable line per problem with the check,
 * the selector and the text, so a failure says what to fix and where.
 */
export async function audit(page: Page, where: string, opts: AuditOptions): Promise<string[]> {
  const problems = await page.evaluate(
    ({ scale, icons, opts }) => {
      const out: string[] = [];
      const vw = window.innerWidth;
      const token = (name: keyof typeof scale) => {
        const [min, max] = scale[name];
        return Math.min(max, Math.max(min, min + ((max - min) * (vw - 320)) / 2240));
      };
      const RAILS = ".desk-table-scroll, .nav-pill-shell, .horizontal-rail, .logic-module-rail, [data-scroll-rail]";
      const sel = (el: Element): string => {
        const id = (el as HTMLElement).dataset?.testid;
        if (id) return `[data-testid="${id}"]`;
        const parts: string[] = [];
        let cur: Element | null = el;
        for (let i = 0; cur && i < 4; i++, cur = cur.parentElement) {
          const tid = (cur as HTMLElement).dataset?.testid;
          if (tid) {
            parts.unshift(`[data-testid="${tid}"]`);
            break;
          }
          const cls = typeof cur.className === "string" ? cur.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
          parts.unshift(cur.tagName.toLowerCase() + (cls ? `.${cls}` : ""));
        }
        return parts.join(" > ");
      };
      const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      const shown = (el: Element): boolean => {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.closest("[aria-hidden='true'], [inert], .sr-only");
      };
      /** The visible part of an element, clipped by the scroll rails it sits in. */
      const visibleRect = (el: Element): DOMRect | null => {
        let r = el.getBoundingClientRect();
        let left = r.left,
          top = r.top,
          right = r.right,
          bottom = r.bottom;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll|hidden)/.test(s.overflowX + s.overflowY)) {
            const pr = p.getBoundingClientRect();
            left = Math.max(left, pr.left);
            top = Math.max(top, pr.top);
            right = Math.min(right, pr.right);
            bottom = Math.min(bottom, pr.bottom);
          }
        }
        if (right - left < 1 || bottom - top < 1) return null;
        r = new DOMRect(left, top, right - left, bottom - top);
        return r;
      };
      /** Sticky and fixed bars paint over the page by design, so overlap is judged within a layer. */
      const layerOf = (el: Element): Element | null => {
        for (let p: Element | null = el; p; p = p.parentElement) {
          const pos = getComputedStyle(p).position;
          if (pos === "sticky" || pos === "fixed") return p;
        }
        return null;
      };

      // R1: no sideways scroll on the page itself.
      if (document.documentElement.scrollWidth > window.innerWidth) {
        out.push(`R1 page is ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px window`);
      }

      // R2: text never overflows its box, except inside a scroll rail.
      // A box squeezed to zero width still counts: its text spills out over its neighbours.
      const styled = (el: Element) => {
        for (let p: Element | null = el; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
        }
        return !el.closest("[aria-hidden='true'], [inert], .sr-only");
      };
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el.closest(RAILS) || el.closest("svg")) continue;
        const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (!hasText || !styled(el)) continue;
        const s = getComputedStyle(el);
        if (s.display === "inline") continue;
        if (el.scrollWidth > el.clientWidth + 1 && !/(auto|scroll)/.test(s.overflowX)) {
          out.push(`R2 overflow ${el.scrollWidth}>${el.clientWidth}px at ${sel(el)} "${textOf(el)}"`);
        }
      }

      // Interactive elements as the user sees them.
      const interactive = Array.from(
        document.querySelectorAll<HTMLElement>("a[href], button, input:not([type='hidden']), select, textarea, [role='tab'], [role='button']"),
      ).filter((el) => shown(el) && !el.closest("[data-testid='desk-ambient']"));

      // R3: no two interactive elements on the same layer overlap.
      const boxes = interactive.map((el) => ({ el, r: visibleRect(el), layer: layerOf(el) })).filter((b) => b.r) as Array<{ el: HTMLElement; r: DOMRect; layer: Element | null }>;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!,
            b = boxes[j]!;
          if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 1 && h > 1) out.push(`R3 overlap ${sel(a.el)} "${textOf(a.el)}" with ${sel(b.el)} "${textOf(b.el)}"`);
        }
      }

      // R4: font sizes follow the type scale; nothing below 12 px.
      const expect = (el: Element, names: keyof typeof scale | Array<keyof typeof scale>) => {
        const size = parseFloat(getComputedStyle(el).fontSize);
        const list = Array.isArray(names) ? names : [names];
        if (list.some((n) => Math.abs(size - token(n)) <= 0.6)) return;
        out.push(`R4 ${list.join(" or ")} should be ${list.map((n) => token(n).toFixed(1)).join(" or ")}px, is ${size}px at ${sel(el)} "${textOf(el)}"`);
      };
      const checks: Array<[string, keyof typeof scale | Array<keyof typeof scale>]> = [
        ["h1", "h1"],
        ["h2", "h2"],
        ["h3", "h3"],
        ["h4", "h3"],
        ["th", "table-head"],
        ["td", "table"],
        ["label", ["body", "caption"]],
        ["button", ["body", "caption"]],
        [".text-caption, .hint, .hs-chip, .label-chip", "caption"],
      ];
      for (const [query, name] of checks) {
        for (const el of Array.from(document.querySelectorAll(query))) if (shown(el) && textOf(el)) expect(el, name);
      }
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (!shown(el) || el.closest("svg")) continue;
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
        if (own && parseFloat(getComputedStyle(el).fontSize) < 11.9) out.push(`R4 below 12px: ${getComputedStyle(el).fontSize} at ${sel(el)} "${textOf(el)}"`);
      }
      for (const t of Array.from(document.querySelectorAll("svg text"))) {
        if (shown(t) && parseFloat(getComputedStyle(t).fontSize) < 11.9) out.push(`R4 chart text below 12px at "${textOf(t)}"`);
      }

      // R5: icons use the icon scale, hide from screen readers or carry a label, and use the 1.75 stroke.
      const sizes = Object.values(icons);
      for (const svg of Array.from(document.querySelectorAll<SVGElement>("svg.lucide"))) {
        if (!shown(svg)) continue;
        const r = svg.getBoundingClientRect();
        const w = Math.round(r.width * 10) / 10;
        if (!sizes.some((s) => Math.abs(s - w) < 0.6)) out.push(`R5 icon ${w}px is off the icon scale at ${sel(svg)}`);
        if (svg.getAttribute("aria-hidden") !== "true" && !svg.getAttribute("aria-label")) out.push(`R5 icon needs aria-hidden or a label at ${sel(svg)}`);
        if (Math.abs(parseFloat(getComputedStyle(svg).strokeWidth) - 1.75) > 0.01) out.push(`R5 icon stroke ${getComputedStyle(svg).strokeWidth} at ${sel(svg)}`);
        const nav = svg.closest("nav a, [role='tab']");
        if (nav) {
          const want = vw >= 768 ? icons.md : icons.sm;
          if (Math.abs(w - want) > 0.6) out.push(`R5 tab icon ${w}px should be ${want}px at ${sel(svg)}`);
          continue;
        }
        const holder = svg.closest("button, a, label, .hs-chip");
        if (holder && textOf(holder)) {
          const font = parseFloat(getComputedStyle(holder).fontSize);
          if (Math.abs(w - font) > 2.6) out.push(`R5 icon ${w}px does not match its ${font}px text at ${sel(svg)} "${textOf(holder)}"`);
        }
      }

      // R6: touch targets of at least 44 by 44 px on touch devices.
      if (opts.touch) {
        const targets = interactive.filter((el) => el.matches("button, select, [role='tab'], [role='button'], a.btn-animated, nav a, input[type='checkbox']"));
        for (const el of targets) {
          const box = el.matches("input[type='checkbox']") ? (el.closest("label") ?? el) : el;
          const r = box.getBoundingClientRect();
          if (r.width < 43.5 || r.height < 43.5) out.push(`R6 target ${Math.round(r.width)}x${Math.round(r.height)}px at ${sel(el)} "${textOf(el)}"`);
        }
      }

      // R7: short wording. Descriptions under a name are marked data-desc and do not count.
      const nameOf = (el: Element) => {
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll("[data-desc], svg, kbd, .sr-only").forEach((n) => n.remove());
        return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
      };
      const words = (s: string) => s.split(/\s+/).filter((w) => /[A-Za-z0-9₹%]/.test(w)).length;
      // Button names the Market Data brief fixes word for word.
      const namedByBrief = new Set(["Reload From Desk Database"]);
      for (const el of Array.from(document.querySelectorAll("button, a.btn-animated"))) {
        if (!shown(el) || el.matches("[role='tab']") || el.closest(".logic-module-rail")) continue;
        const n = nameOf(el);
        if (n && words(n) > 3 && !namedByBrief.has(n)) out.push(`R7 button "${n}" has ${words(n)} words`);
      }
      for (const el of Array.from(document.querySelectorAll("[role='tab'], nav a"))) {
        const n = nameOf(el);
        if (shown(el) && n && words(n) > 4) out.push(`R7 tab "${n}" has ${words(n)} words`);
      }
      for (const el of Array.from(document.querySelectorAll("label"))) {
        const n = nameOf(el);
        if (shown(el) && n && words(n) > 5) out.push(`R7 label "${n}" has ${words(n)} words`);
      }
      if (opts.headingsOneLine) {
        for (const el of Array.from(document.querySelectorAll("h1, h2, h3, h4"))) {
          if (!shown(el)) continue;
          const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.15;
          const lines = Math.round(el.getBoundingClientRect().height / lh);
          if (lines > 1) out.push(`R7 heading "${textOf(el)}" takes ${lines} lines at ${vw}px`);
        }
      }
      return out;
    },
    { scale: TYPE_SCALE, icons: ICON_SIZES, opts },
  );
  return problems.map((p) => `${where}: ${p}`);
}

/** R7 at 360 px: headings take at most two lines. */
export async function headingLines(page: Page, where: string): Promise<string[]> {
  const found = await page.evaluate(() =>
    Array.from(document.querySelectorAll("h1, h2, h3, h4"))
      .filter((el) => el.getBoundingClientRect().height > 0)
      .map((el) => {
        const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.15;
        return { text: (el.textContent ?? "").trim().slice(0, 60), lines: Math.round(el.getBoundingClientRect().height / lh) };
      })
      .filter((h) => h.lines > 2)
      .map((h) => `R7 heading "${h.text}" takes ${h.lines} lines at 360px`),
  );
  return found.map((p) => `${where}: ${p}`);
}

export function label(v: Viewport, mode: string, theme = "light") {
  return `${v.name} ${v.width}x${v.height} ${mode} ${theme}`;
}
