import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { MAX_EXPIRIES, MIN_EXPIRIES, snapExpiry } from "@/lib/engine/schedule";
import { MAX_LEG_QUANTITY, MAX_LEGS, MAX_SPREADS, MIN_LEGS, MIN_SPREADS } from "@/lib/engine/structure";
import type { CustomLeg, OptionType, StrikeSide, Underlying } from "@/lib/engine/types";

/** At most this many rows in one paste: 10 expiries, or 10 strikes for 6 spreads. */
const MAX_PASTE_ROWS = Math.max(MAX_EXPIRIES, MAX_SPREADS + 4);

type BulkRow<T> = { raw: string; value: T | null; note?: string; error?: string };
export type BulkResult<T> = { rows: Array<BulkRow<T>>; error: string | null; ok: boolean };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Rows of a pasted block: one per line, cells split on tabs, commas or semicolons; empty lines dropped. */
function splitRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/[\t,;]/).map((c) => c.trim()))
    .filter((cells) => cells.some(Boolean));
}

/** A typed date as yyyy-mm-dd: 2030-04-25, 25-Apr-2030, 25 Apr 30, 25/04/2030, 25-04-2030. Null when it is not a real date. */
export function parsePastedDate(text: string): string | null {
  const t = text.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{2}|\d{4})$/.exec(t))) {
    const mi = MONTHS.indexOf(match[2]!.toLowerCase());
    if (mi < 0) return null;
    [d, m, y] = [Number(match[1]), mi + 1, Number(match[3])];
    if (y < 100) y += 2000;
  } else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t))) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else return null;
  const ymd = `${y}-${pad(m)}-${pad(d)}`;
  return isValidYmd(ymd) ? ymd : null;
}

/**
 * Pasted expiries: one date per cell, across or down. Each moves to its month's last expiry weekday;
 * every one must fall after the Valuation Date and after the one before.
 */
export function parseExpiryPaste(text: string, ctx: { valuationDate: string; underlying: Underlying }): BulkResult<string> {
  const cells = splitRows(text).flat().filter(Boolean);
  if (!cells.length) return { rows: [], error: "Paste one date per line or per cell.", ok: false };
  if (cells.length > MAX_PASTE_ROWS) return { rows: [], error: `At most ${MAX_PASTE_ROWS} expiries can be pasted; this paste has ${cells.length}.`, ok: false };
  let prev: string | null = null;
  const rows = cells.map((raw): BulkRow<string> => {
    const parsed = parsePastedDate(raw);
    if (!parsed) return { raw, value: null, error: "Not a date. Use 25-Apr-2030 or 2030-04-25." };
    const snapped = snapExpiry(parsed, ctx.underlying);
    const note = snapped !== parsed ? `Moved To ${formatDate(snapped)}` : undefined;
    if (isValidYmd(ctx.valuationDate) && snapped <= ctx.valuationDate) return { raw, value: snapped, note, error: "Falls on or before the Valuation Date." };
    if (prev && snapped <= prev) return { raw, value: snapped, note, error: "Does not fall after the expiry above." };
    prev = snapped;
    return { raw, value: snapped, note };
  });
  const tooFew = rows.length < MIN_EXPIRIES;
  return { rows, error: tooFew ? `Paste at least ${MIN_EXPIRIES} expiry.` : null, ok: !tooFew && rows.every((r) => !r.error) };
}

export type PastedStrike = { percent: number; optionType: OptionType; side: StrikeSide | "" };

const TYPE: Record<string, OptionType> = { p: "P", put: "P", c: "C", call: "C" };
const SIDE: Record<string, StrikeSide> = { b: "B", buy: "B", s: "S", sell: "S" };

/**
 * Pasted strikes, one per line: Level %, then optionally Option Type (Put or Call) and Buy Or Sell.
 * 5 to 10 rows, one per strike of 1 to 6 spreads, in strictly descending order of level.
 */
export function parseStrikePaste(text: string): BulkResult<PastedStrike> {
  const lines = splitRows(text);
  if (!lines.length) return { rows: [], error: "Paste one strike per line: Level %, Option Type, Buy Or Sell.", ok: false };
  if (lines.length > MAX_PASTE_ROWS) return { rows: [], error: `At most ${MAX_PASTE_ROWS} strikes can be pasted; this paste has ${lines.length}.`, ok: false };
  let prev = Infinity;
  const rows = lines.map((cells): BulkRow<PastedStrike> => {
    const raw = cells.join(" · ");
    const percent = Number((cells[0] ?? "").replace(/[%\s]/g, ""));
    if (!cells[0] || !Number.isFinite(percent)) return { raw, value: null, error: "The level is not a number." };
    if (!(percent > 0 && percent <= 500)) return { raw, value: null, error: "The level must be above 0% and at most 500%." };
    const typeText = (cells[1] ?? "p").toLowerCase();
    const optionType = TYPE[typeText];
    if (!optionType) return { raw, value: null, error: "Option Type must be Put or Call." };
    const sideText = (cells[2] ?? "").toLowerCase();
    const side: StrikeSide | "" | undefined = sideText ? SIDE[sideText] : "";
    if (side === undefined) return { raw, value: null, error: "Buy Or Sell must be Buy or Sell." };
    const value = { percent, optionType, side };
    if (!(percent < prev)) return { raw, value, error: "Levels must fall from one row to the next." };
    prev = percent;
    return { raw, value };
  });
  const min = MIN_SPREADS + 4;
  const max = MAX_SPREADS + 4;
  const countError = rows.length < min || rows.length > max ? `Paste ${min} to ${max} strikes, for 1 to ${MAX_SPREADS} spreads.` : null;
  return { rows, error: countError, ok: !countError && rows.every((r) => !r.error) };
}

/**
 * Pasted Custom Option Book legs, one per line: Level %, Put or Call, Buy or Sell, then the Quantity, 1 when left out.
 * 1 to 10 rows in any order; a level may repeat.
 */
export function parseLegPaste(text: string): BulkResult<CustomLeg> {
  const lines = splitRows(text);
  if (!lines.length) return { rows: [], error: "Paste one leg per line: Level %, Put Or Call, Buy Or Sell, Quantity.", ok: false };
  if (lines.length > MAX_LEGS) return { rows: [], error: `At most ${MAX_LEGS} legs can be pasted; this paste has ${lines.length}.`, ok: false };
  const rows = lines.map((cells): BulkRow<CustomLeg> => {
    const raw = cells.join(" · ");
    const percent = Number((cells[0] ?? "").replace(/[%\s]/g, ""));
    if (!cells[0] || !Number.isFinite(percent)) return { raw, value: null, error: "The level is not a number." };
    if (!(percent > 0 && percent <= 500)) return { raw, value: null, error: "The level must be above 0% and at most 500%." };
    const optionType = TYPE[(cells[1] ?? "").toLowerCase()];
    if (!optionType) return { raw, value: null, error: "Option Type must be Put or Call." };
    const side = SIDE[(cells[2] ?? "").toLowerCase()];
    if (!side) return { raw, value: null, error: "Buy Or Sell must be Buy or Sell." };
    const quantity = cells[3] ? Number(cells[3].replace(/,/g, "")) : 1;
    if (!(Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_LEG_QUANTITY)) {
      return { raw, value: null, error: `The quantity must be above 0 and at most ${MAX_LEG_QUANTITY}; Buy Or Sell gives the sign.` };
    }
    return { raw, value: { percent, optionType, side, quantity } };
  });
  const countError = rows.length < MIN_LEGS ? `Paste ${MIN_LEGS} to ${MAX_LEGS} legs.` : null;
  return { rows, error: countError, ok: !countError && rows.every((r) => !r.error) };
}
