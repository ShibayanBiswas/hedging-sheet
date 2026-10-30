import { formatDate } from "@/lib/engine/dates";

const BLANK = "-";

export type Display = { text: string; title?: string };

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** No number shows more than 3 decimal places, on screen or in Excel. */
export const MAX_DECIMALS = 3;

function places(digits: number): number {
  return Math.max(0, Math.min(MAX_DECIMALS, Math.round(digits)));
}

/** A value that rounds to zero shows as 0, never as -0.000. */
function clean(v: number, digits = MAX_DECIMALS): number {
  const rounded = Number(v.toFixed(places(digits)));
  return Object.is(rounded, -0) || rounded === 0 ? 0 : v;
}

/** A blank cell with the reason in its tooltip, never NaN or Infinity. */
export function blank(reason = "Not applicable"): Display {
  return { text: BLANK, title: reason };
}

function grouped(v: number, digits: number): string {
  const d = places(digits);
  return clean(v, d).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function numberText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return { text: grouped(v, digits) };
}

export function percentText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return { text: `${grouped(v * 100, digits)}%` };
}

export function croreText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return { text: `₹ ${grouped(v, digits)}` };
}

export function dateText(v: string | null | undefined): Display {
  const text = formatDate(v ?? null);
  return text === BLANK ? blank("No date applies") : { text };
}

export function fmtNumber(v: unknown, digits = 2): string {
  return numberText(v, digits).text;
}

export function fmtPercent(v: unknown, digits = 2): string {
  return percentText(v, digits).text;
}

export function fmtCrore(v: unknown, digits = 2): string {
  return croreText(v, digits).text;
}

const IST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function istParts(d: Date): Record<string, string> {
  return Object.fromEntries(IST_PARTS.formatToParts(d).map((p) => [p.type, p.value]));
}

/** "12:11 pm IST": the time format of the footer and the Market Data status row. */
export function fmtIstTime(iso: string): string {
  const p = istParts(new Date(iso));
  return `${p.hour}:${p.minute} ${p.dayPeriod!.toLowerCase()} IST`;
}

/** 30-Oct-2026 · 12:11:30 pm IST, the footer's Desk Clock. */
export function fmtDeskClock(d: Date): string {
  const p = istParts(d);
  return `${p.day}-${p.month}-${p.year} · ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod!.toLowerCase()} IST`;
}
