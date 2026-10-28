import type { KeyboardEvent } from "react";

/**
 * Arrow keys move focus between the items of a tab list or tab bar; Home and End jump to the ends.
 * Activation stays with Enter or Space, so a mode switch never fires from an arrow press.
 */
export function moveFocusWithArrows(e: KeyboardEvent<HTMLElement>, itemSelector: string) {
  const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
  if (!keys.includes(e.key)) return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(itemSelector));
  const at = items.findIndex((el) => el === document.activeElement);
  if (at < 0 || !items.length) return;
  e.preventDefault();
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
  items[next]!.focus();
}
