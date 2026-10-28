"use client";

import { useEffect } from "react";

const RAILS = ".desk-table-scroll, .nav-pill-shell";

/** Marks which sides of a sideways rail still have content, so CSS can draw a shadow or fade on that side. */
function mark(el: HTMLElement) {
  const left = el.scrollLeft > 1;
  const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  el.toggleAttribute("data-scroll-left", left);
  el.toggleAttribute("data-scroll-right", right);
}

/** Keeps the scroll markers of every table rail and the section tabs up to date as pages, sizes and data change. */
export function useScrollRails() {
  useEffect(() => {
    let frame = 0;
    const markAll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.querySelectorAll<HTMLElement>(RAILS).forEach(mark));
    };
    const onScroll = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLElement && el.matches(RAILS)) mark(el);
    };
    markAll();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", markAll);
    const observer = new MutationObserver(markAll);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", markAll);
      observer.disconnect();
    };
  }, []);
}
