import { formatDate } from "@/lib/engine/dates";

const BLANK = "-";

export type Display = { text: string; title?: string };

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clean(v: number): number {
  return Object.is(v, -0) ? 0 : v;
}

/** A blank cell with the reason in its tooltip, never NaN or Infinity. */
export function blank(reason = "Not applicable"): Display {
  return { text: BLANK, title: reason };
}

export function numberText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return {
    text: clean(v).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }),
  };
}

export function percentText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return { text: `${clean(v * 100).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%` };
}

export function croreText(v: unknown, digits = 2): Display {
  if (!finite(v)) return blank(v == null ? "Not applicable" : "The value could not be computed");
  return { text: `₹ ${clean(v).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}` };
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
