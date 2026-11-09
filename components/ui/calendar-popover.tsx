"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { addDays, formatDate, istTodayYmd, parseYmd } from "@/lib/engine/dates";
import { WEEKDAY_NAMES } from "@/lib/engine/schedule";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Space between the calendar and its field, and between the calendar and the window's edges. */
const GAP = 4;
const EDGE = 8;

const pad = (n: number) => String(n).padStart(2, "0");

function partsOf(ymd: string) {
  const d = parseYmd(ymd);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
}

/** A day of a month numbered from 0, which may run past December; a day past the month's end becomes its last day. */
function dayIn(year: number, month: number, day: number): string {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

function shiftMonths(ymd: string, months: number): string {
  const p = partsOf(ymd);
  return dayIn(p.year, p.month + months, p.day);
}

/** The close of the one open calendar, so opening another closes it. */
let closeOpenCalendar: (() => void) | null = null;

/**
 * The desk's own calendar for a date field. Browsers refuse to open the native date picker from a page framed by another
 * origin, as SP Workstation frames this app, so the calendar is drawn here. It sits on the page body in fixed position, below
 * its field or above it, inside the window, so no card, table rail, phone width or short frame cuts it off.
 */
export function CalendarPopover({
  value,
  label,
  anchor,
  toggle,
  onPick,
  onClose,
}: {
  /** yyyy-mm-dd, or "" while the field is empty. */
  value: string;
  /** The field's name, for the dialog: Choose Expiry 3. */
  label: string;
  /** The field row the calendar opens against. */
  anchor: RefObject<HTMLElement | null>;
  /** The button that opened it: a click on it toggles rather than counts as outside, and focus goes back to it. */
  toggle: RefObject<HTMLButtonElement | null>;
  onPick: (ymd: string) => void;
  onClose: () => void;
}) {
  const [today] = useState(() => istTodayYmd(new Date()));
  /** The day that takes keyboard focus in the grid; its month is the month on show. */
  const [focus, setFocus] = useState(() => value || today);
  const box = useRef<HTMLDivElement>(null);
  /** Focus follows the focused day only on opening and after a key in the grid, never after a header control. */
  const moveFocus = useRef(true);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  const close = (refocus: boolean) => {
    latestClose.current();
    if (refocus) toggle.current?.focus({ preventScroll: true });
  };

  // Below the field when it fits, else above it, else on the roomier side kept inside the window, scrolling inside itself when
  // the window is shorter than the calendar. It follows the field as the page or a card scrolls.
  useLayoutEffect(() => {
    const place = () => {
      const el = box.current;
      const at = anchor.current;
      if (!el || !at) return;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const a = at.getBoundingClientRect();
      const room = vh - 2 * EDGE;
      const height = Math.min(el.scrollHeight, room);
      const below = vh - a.bottom - GAP - EDGE;
      const above = a.top - GAP - EDGE;
      const top = height <= below ? a.bottom + GAP : height <= above ? a.top - GAP - height : below >= above ? vh - EDGE - height : EDGE;
      el.style.maxHeight = `${room}px`;
      // Kept inside even while the field itself is scrolled out of a frame that just got shorter.
      el.style.top = `${Math.min(Math.max(EDGE, top), vh - EDGE - height)}px`;
      el.style.left = `${Math.max(EDGE, Math.min(a.left, vw - el.offsetWidth - EDGE))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  // A press or focus outside closes it, and only one calendar is open at a time.
  useEffect(() => {
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !toggle.current?.contains(t)) latestClose.current();
    };
    const mine = () => latestClose.current();
    closeOpenCalendar?.();
    closeOpenCalendar = mine;
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      if (closeOpenCalendar === mine) closeOpenCalendar = null;
    };
  }, [toggle]);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    box.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus]);

  const pick = (ymd: string) => {
    onPick(ymd);
    close(true);
  };

  const { year, month, day } = partsOf(focus);
  const thisYear = partsOf(today).year;
  const years = Array.from({ length: Math.max(thisYear + 15, year) - Math.min(thisYear - 10, year) + 1 }, (_, i) => Math.min(thisYear - 10, year) + i);
  const first = dayIn(year, month, 1);
  const start = addDays(first, -partsOf(first).weekday);
  const weeks = Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));

  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    // Tab cycles through the calendar's own controls: it is drawn at the end of the page, so leaving it would lose the field.
    if (e.key !== "Tab") return;
    const stops = [...e.currentTarget.querySelectorAll<HTMLElement>("button, select")].filter((el) => el.tabIndex >= 0);
    const at = stops.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    stops[e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at + 1) % stops.length]?.focus();
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = (e.target as HTMLElement).dataset.date ?? focus;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(at);
      return;
    }
    const weekday = partsOf(at).weekday;
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(at, -1),
      ArrowRight: () => addDays(at, 1),
      ArrowUp: () => addDays(at, -7),
      ArrowDown: () => addDays(at, 7),
      Home: () => addDays(at, -weekday),
      End: () => addDays(at, 6 - weekday),
      PageUp: () => shiftMonths(at, -1),
      PageDown: () => shiftMonths(at, 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const next = move();
    if (next === focus) return;
    moveFocus.current = true;
    setFocus(next);
  };

  return createPortal(
    <div ref={box} role="dialog" aria-modal="true" aria-label={`Choose ${label}`} className="hs-calendar" onKeyDown={onDialogKey}>
      <div className="hs-calendar-head">
        <button type="button" className="glass-control hs-calendar-nav" aria-label="Previous Month" title="Previous Month" onClick={() => setFocus(shiftMonths(focus, -1))}>
          <ChevronLeft className="icon-sm" aria-hidden />
        </button>
        <select className="glass-select hs-calendar-select hs-calendar-month" aria-label="Month" value={month} onChange={(e) => setFocus(dayIn(year, Number(e.target.value), day))}>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select className="glass-select hs-calendar-select" aria-label="Year" value={year} onChange={(e) => setFocus(dayIn(Number(e.target.value), month, day))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button type="button" className="glass-control hs-calendar-nav" aria-label="Next Month" title="Next Month" onClick={() => setFocus(shiftMonths(focus, 1))}>
          <ChevronRight className="icon-sm" aria-hidden />
        </button>
      </div>
      <div role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`} className="hs-calendar-grid" onKeyDown={onGridKey}>
        <div role="row" className="hs-calendar-row">
          {WEEKDAY_NAMES.map((name) => (
            <span key={name} role="columnheader" aria-label={name} className="hs-calendar-weekday">
              {name.slice(0, 2)}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="hs-calendar-row">
            {week.map((d) => {
              const p = partsOf(d);
              return (
                <button
                  key={d}
                  type="button"
                  role="gridcell"
                  data-date={d}
                  tabIndex={d === focus ? 0 : -1}
                  aria-selected={d === value}
                  aria-current={d === today ? "date" : undefined}
                  aria-label={`${WEEKDAY_NAMES[p.weekday]} ${formatDate(d)}`}
                  className={cn("hs-calendar-day", p.month !== month && "hs-calendar-day--outside")}
                  onClick={() => pick(d)}
                >
                  {p.day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
