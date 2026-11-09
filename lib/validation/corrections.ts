import { lastWeekdayOfMonth } from "@/lib/dates";
import { addDays, daysBetween, formatDate, isValidYmd, parseYmd } from "@/lib/engine/dates";
import { autoHedgeStrike, DEFAULT_TERMS, defaultInputs } from "@/lib/engine/defaults";
import { EXPIRY_WEEKDAY, maturityDate, snapExpiry, WEEKDAY_NAMES } from "@/lib/engine/schedule";
import { deriveTerms, derivedSides } from "@/lib/engine/structure";
import type { StrikeSide } from "@/lib/engine/types";
import { annualVolFromDaily, dailyVolFromAnnual } from "@/lib/engine/volatility";
import { fmtNumber, fmtPercent } from "@/lib/format";
import type { DeskInputs } from "@/lib/inputs/draft";
import { numberFieldRules, validateDeskInputs, type FieldError, type NumberFieldRule } from "@/lib/validation/inputRules";

/**
 * Auto-correction of a value that breaks a rule. A committed value (on leaving the field or Enter) that breaks a rule becomes
 * the nearest valid value, or the Default Values value where nothing is nearer, and the field says so in a note. Only the field
 * being committed changes. Run Simulation corrects whatever is left the same way, on the field each rule names, so a
 * correctable value never blocks a run; an empty field in Blank Inputs and text that is no number or date still do.
 * docs/input-parameters-guide.md lists every rule with what it corrects to.
 */

export type Correction<T> = { value: T; note: string };

export type CorrectionContext = {
  /** The India calendar date: a Valuation Date never passes it. */
  today: string;
  /** The underlying's last close, the Spot's default; absent until the close has arrived. */
  spot?: number | null;
};

/** Strikes step one whole point inside a neighbour, as the desk's levels and the one point outflow step do. */
const STRIKE_STEP = 1;
const MAX_STRIKE = 500;
/** The Default Values level of each strike role, used when a strike of zero has no nearer valid level. */
const ROLE_DEFAULT = { target: 137, protection: 85, outflow: 84, floor: 70 } as const;
const EPS = 1e-9;

const round3 = (x: number) => Math.round(x * 1000) / 1000;
const shownStrike = (x: number) => `${fmtNumber(x, 3)}%`;

/** Digits each number field shows, so a note reads the value as the field does. */
const DIGITS: Record<string, number> = { spot: 2, hedgeStrike: 0, decay: 2, floorUnits: 2, notionalCr: 2, stressSigmas: 0, stressVolMultiplier: 2 };

function shown(rule: Pick<NumberFieldRule, "field" | "percent" | "integer">, x: number): string {
  if (rule.percent) return fmtPercent(x, 3);
  if (rule.integer) return fmtNumber(x, 0);
  if (/^participations\./.test(rule.field)) return fmtNumber(x, 2);
  if (/^customLegs\.\d+\.percent$/.test(rule.field)) return shownStrike(x);
  if (/^customLegs\.\d+\.quantity$/.test(rule.field)) return fmtNumber(x, 2);
  return fmtNumber(x, DIGITS[rule.field] ?? 2);
}

const note = (what: string, value: string) => `${what}, ${value}`;

/** Spot, Hedge Strike, Coupon and the like cannot be zero or below; rates, costs and the floor reduction may be 0. */
const positiveOnly = (rule: NumberFieldRule) => !rule.minInclusive || rule.min >= 1;

function defaultFor(inputs: DeskInputs, field: string, ctx: CorrectionContext): number | null {
  if (field === "spot") return ctx.spot != null && ctx.spot > 0 ? ctx.spot : null;
  if (field === "hedgeStrike") return inputs.underlying && Number.isFinite(inputs.spot) && inputs.spot > 0 ? autoHedgeStrike(inputs.spot, inputs.underlying) : null;
  if (field === "dailyVol") return defaultInputs().dailyVol;
  if (/^participations\./.test(field)) return 1;
  if (/^customLegs\.\d+\.percent$/.test(field)) return 100;
  if (/^customLegs\.\d+\.quantity$/.test(field)) return 1;
  const v = (DEFAULT_TERMS as Record<string, unknown>)[field];
  return typeof v === "number" ? v : null;
}

/**
 * A number against its own range: a sign typo on a field that cannot be negative is made positive, a decimal in a whole
 * number field is rounded, the Hedge Strike goes to the nearest 100, a value above the maximum is lowered to it, a rate below 0%
 * is raised to 0%, and zero where zero is not allowed takes the Default Values value. Null when the value is fine.
 */
function fitRange(inputs: DeskInputs, rule: NumberFieldRule, v: number, ctx: CorrectionContext): Correction<number> | null {
  let x = v;
  let what: string | null = null;
  if (x < 0 && positiveOnly(rule)) {
    x = -x;
    what = "Made Positive";
  }
  if (rule.integer && !Number.isInteger(x)) {
    x = Math.round(x);
    what = "Rounded To A Whole Number";
  }
  if (rule.step && Math.abs(x / rule.step - Math.round(x / rule.step)) > EPS) {
    x = Math.round(x / rule.step) * rule.step;
    what = `Rounded To The Nearest ${fmtNumber(rule.step, 0)}`;
  }
  if (x > rule.max) {
    x = rule.max;
    what = "Lowered To The Maximum";
  }
  const low = rule.minInclusive ? x < rule.min : x <= rule.min;
  if (low) {
    if (!positiveOnly(rule)) {
      x = rule.min;
      what = "Raised To The Minimum";
    } else {
      const fallback = defaultFor(inputs, rule.field, ctx);
      if (fallback == null) {
        // Nothing to fall back on, such as a Spot of 0 before the close has arrived: the field keeps what it had.
        const current = currentNumber(inputs, rule.field);
        return { value: current, note: Number.isFinite(current) ? note("Kept, It Must Be Above Zero", shown(rule, current)) : "Kept Empty, It Must Be Above Zero" };
      }
      x = fallback;
      what = rule.field === "spot" ? "Set To The Last Close" : rule.field === "hedgeStrike" ? "Set To The Auto Hedge Strike" : "Set To The Default";
    }
  }
  return what ? { value: x, note: note(what, shown(rule, x)) } : null;
}

function currentNumber(inputs: DeskInputs, field: string): number {
  const leg = /^customLegs\.(\d+)\.(percent|quantity)$/.exec(field);
  if (leg) return inputs.customLegs?.[Number(leg[1])]?.[leg[2] as "percent" | "quantity"] ?? NaN;
  const part = /^participations\.(\d+)$/.exec(field);
  if (part) return inputs.participations[Number(part[1])] ?? NaN;
  const strike = /^strikePercents\.(\d+)$/.exec(field);
  if (strike) return inputs.strikePercents[Number(strike[1])] ?? NaN;
  const v = inputs[field as keyof DeskInputs];
  return typeof v === "number" ? v : NaN;
}

const ruleFor = (inputs: DeskInputs, field: string) => numberFieldRules(inputs).find((r) => r.field === field);

/** The strike a Product Payoff row may take: strictly between its neighbours, above 0, at most 500, and the protection strike at most 100%. */
function strikeRoom(inputs: DeskInputs, i: number) {
  const k = inputs.strikePercents;
  const n = k.length - 4;
  const above = i > 0 && Number.isFinite(k[i - 1]) ? k[i - 1]! : Infinity;
  const below = i < k.length - 1 && Number.isFinite(k[i + 1]) ? k[i + 1]! : 0;
  const cap = i === n + 1 ? 100 : MAX_STRIKE;
  const role: keyof typeof ROLE_DEFAULT | null = i === 0 ? "target" : i === n + 1 ? "protection" : i === n + 2 ? "outflow" : i === n + 3 ? "floor" : null;
  return { above, below, cap, role };
}

/** One point inside the bound when that keeps the strike clear of the other neighbour, else the middle of the gap. */
function inside(lo: number, hi: number, near: "lo" | "hi", hiInclusive: boolean): number | null {
  const step = near === "hi" ? (hiInclusive ? hi : hi - STRIKE_STEP) : lo + STRIKE_STEP;
  const ok = (x: number) => x > lo + EPS && (hiInclusive ? x <= hi + EPS : x < hi - EPS);
  if (ok(step)) return round3(step);
  const mid = round3((lo + Math.min(hi, MAX_STRIKE)) / 2);
  return ok(mid) ? mid : null;
}

/**
 * A Product Payoff strike keeps its row's role, target, spread level, protection, outflow or floor, so it is clamped between
 * its neighbours rather than re-sorted: one point inside the neighbour it crossed, or the middle when the gap is narrower.
 */
export function correctStrike(inputs: DeskInputs, i: number, v: number): Correction<number> | null {
  const { above, below, cap, role } = strikeRoom(inputs, i);
  let x = v;
  let what: string | null = null;
  const zero = x === 0;
  if (x < 0) {
    x = -x;
    what = "Made Positive";
  }
  if (x > cap) {
    x = cap;
    what = cap === 100 ? "Lowered To Zero Protection" : "Lowered To The Maximum";
  }
  const hi = Math.min(above, cap);
  const hiInclusive = cap < above;
  const fits = (y: number) => y > below + EPS && (hiInclusive ? y <= hi + EPS : y < hi - EPS);
  if (!fits(x)) {
    const roleDefault = role ? ROLE_DEFAULT[role] : null;
    let y: number | null;
    if (zero && roleDefault != null && fits(roleDefault)) {
      y = roleDefault;
      what = "Set To The Default";
    } else if (x >= hi - EPS && !(hiInclusive && x <= hi + EPS)) {
      y = inside(below, hi, "hi", hiInclusive);
      what = above <= cap ? `Lowered Below Strike ${i}` : "Lowered To The Maximum";
    } else {
      y = inside(below, hi, "lo", hiInclusive);
      what = below > 0 ? `Raised Above Strike ${i + 2}` : "Raised Above Zero";
    }
    if (y == null) {
      const current = inputs.strikePercents[i] ?? NaN;
      return { value: current, note: Number.isFinite(current) ? note(`Kept, No Room Between Strike ${i} And Strike ${i + 2}`, shownStrike(current)) : `Kept Empty, No Room Between Strike ${i} And Strike ${i + 2}` };
    }
    x = y;
  }
  return what ? { value: x, note: note(what, shownStrike(x)) } : null;
}

/** Protection sets the protection strike and the outflow strike one step below it, so both must stay in order. */
function correctProtection(inputs: DeskInputs, p: number): Correction<number> | null {
  const k = inputs.strikePercents;
  const n = k.length - 4;
  const gap = k[n + 1]! - k[n + 2]!;
  const width = Number.isFinite(gap) && gap > 0 ? gap : 1;
  const above = Number.isFinite(k[n]) ? k[n]! : Infinity;
  const below = (Number.isFinite(k[n + 3]) ? k[n + 3]! : 0) + width;
  let s = 100 * (1 - p);
  let what: string | null = null;
  if (s > 100) {
    s = 100;
    what = "Raised To The Minimum";
  }
  const hiInclusive = above > 100;
  const hi = Math.min(above, 100);
  const fits = (y: number) => y > below + EPS && (hiInclusive ? y <= hi + EPS : y < hi - EPS);
  if (!fits(s)) {
    const y = inside(below, hi, s >= hi - EPS ? "hi" : "lo", hiInclusive);
    if (y == null) return { value: Number.isFinite(k[n + 1]) ? 1 - k[n + 1]! / 100 : NaN, note: "Kept, The Strikes Leave No Room" };
    what = y > s ? "Lowered To Keep The Strikes In Order" : "Raised To Keep The Strikes In Order";
    s = y;
  }
  const value = 1 - s / 100;
  return what ? { value, note: note(what, fmtPercent(value, 3)) } : null;
}

/** The spreads' widths and the lower spreads' typed participations, when every strike and every lower participation is in. */
function spreadState(inputs: DeskInputs) {
  const k = inputs.strikePercents;
  const n = k.length - 4;
  if (n < 1 || !k.every(Number.isFinite) || !Number.isFinite(inputs.coupon)) return null;
  const widths = Array.from({ length: n }, (_, j) => (k[n - j - 1]! - k[n - j]!) / 100);
  const parts = inputs.participations.slice(0, n);
  if (parts.slice(0, n - 1).some((p) => !(p != null && Number.isFinite(p)))) return null;
  return { n, widths, parts, topTyped: parts[n - 1] != null && Number.isFinite(parts[n - 1]!) };
}

/**
 * A participation: above 0 and at most 100, then the spreads must pay exactly the Coupon. A typed top spread that does not
 * goes back to Calculated; a lower spread that leaves the top spread nothing is lowered to the most that leaves it a share
 * (to 2 decimals), or, with a typed top, to the value that reaches the Coupon exactly.
 */
function correctParticipation(inputs: DeskInputs, j: number, v: number, ctx: CorrectionContext): Correction<number | null> | null {
  const rule = ruleFor(inputs, `participations.${j}`) ?? { field: `participations.${j}`, label: "", section: "Strikes And Spreads" as const, min: 0, max: 100, minInclusive: false, integer: false, percent: false };
  const ranged = fitRange(inputs, rule, v, ctx);
  const x = ranged ? ranged.value : v;
  const state = spreadState({ ...inputs, participations: Object.assign([...inputs.participations], { [j]: x }) });
  if (!state || !Number.isFinite(x)) return ranged;
  const { n, widths, parts, topTyped } = state;
  const coupon = inputs.coupon;
  if (j === n - 1) {
    const lower = parts.slice(0, n - 1).reduce<number>((a, p, i) => a + widths[i]! * p!, 0);
    const derived = (coupon - lower) / widths[n - 1]!;
    if (Math.abs(widths[n - 1]! * (x - derived)) <= EPS) return ranged;
    return { value: null, note: note("Back To Calculated", Number.isFinite(derived) ? fmtNumber(derived, 2) : "-") };
  }
  const others = parts.reduce<number>((a, p, i) => (i === j || i === n - 1 ? a : a + widths[i]! * p!), 0);
  if (topTyped) {
    const exact = (coupon - others - widths[n - 1]! * parts[n - 1]!) / widths[j]!;
    if (Math.abs(widths[j]! * (x - exact)) <= EPS) return ranged;
    if (exact > 0 && exact <= 100) return { value: exact, note: note("Set To Reach The Coupon Exactly", fmtNumber(exact, 2)) };
    return { value: currentNumber(inputs, `participations.${j}`), note: "Kept, The Other Spreads Already Reach The Coupon" };
  }
  const bound = (coupon - others) / widths[j]!;
  if (x < bound - EPS) return ranged;
  const most = (Math.ceil(bound * 100 - EPS) - 1) / 100;
  if (most > 0) return { value: most, note: note("Lowered To Leave Room For The Top Spread", fmtNumber(most, 2)) };
  return { value: currentNumber(inputs, `participations.${j}`), note: "Kept, The Other Spreads Already Reach The Coupon" };
}

/** The Coupon: above the lower spreads' pay so the top spread keeps a share, or exactly what the spreads pay with a typed top. */
function correctCoupon(inputs: DeskInputs, ranged: Correction<number> | null, v: number): Correction<number> | null {
  const x = ranged ? ranged.value : v;
  const state = spreadState({ ...inputs, coupon: x });
  if (!state || !Number.isFinite(x)) return ranged;
  const { n, widths, parts, topTyped } = state;
  const lower = parts.slice(0, n - 1).reduce<number>((a, p, i) => a + widths[i]! * p!, 0);
  if (topTyped) {
    const reach = lower + widths[n - 1]! * parts[n - 1]!;
    if (Math.abs(x - reach) <= EPS) return ranged;
    return reach > 0 && reach <= 10 ? { value: reach, note: note("Set To What The Spreads Pay", fmtPercent(reach, 3)) } : ranged;
  }
  if (x > lower + EPS) return ranged;
  // The smallest Coupon above what the lower spreads pay, at the field's 0.001% steps.
  const least = (Math.floor(lower * 1e5 + EPS) + 1) / 1e5;
  return least <= 10 ? { value: least, note: note("Raised Above What The Lower Spreads Pay", fmtPercent(least, 3)) } : ranged;
}

const lastFilledExpiry = (inputs: DeskInputs): { index: number; date: string } | null => {
  const n = Number.isInteger(inputs.expiryCount) ? inputs.expiryCount : 0;
  for (let i = n - 1; i >= 0; i--) if (isValidYmd(inputs.expiryDates[i])) return { index: i, date: inputs.expiryDates[i]! };
  return null;
};

/** The correction of one committed number field, or null when the value is fine as typed. */
export function correctNumber(inputs: DeskInputs, field: string, v: number, ctx: CorrectionContext): Correction<number | null> | null {
  if (!Number.isFinite(v)) return null;
  const product = inputs.bookMode !== "custom";
  const n = inputs.strikePercents.length - 4;
  if (field === "target") {
    const c = correctStrike(inputs, 0, 100 * (1 + v));
    return c && { value: c.value / 100 - 1, note: c.note.replace(/[^,]+$/, ` ${fmtPercent(c.value / 100 - 1, 3)}`) };
  }
  if (field === "protection") return correctProtection(inputs, v);
  if (field === "floorLevel") {
    const c = correctStrike(inputs, n + 3, 100 * v);
    return c && { value: c.value / 100, note: c.note };
  }
  if (field === "annualVol") {
    const c = correctNumber(inputs, "dailyVol", dailyVolFromAnnual(v), ctx);
    return c && c.value != null ? { value: annualVolFromDaily(c.value), note: c.note.replace(/[^,]+$/, ` ${fmtPercent(annualVolFromDaily(c.value), 3)}`) } : c;
  }
  const strike = /^strikePercents\.(\d+)$/.exec(field);
  if (strike) return product ? correctStrike(inputs, Number(strike[1]), v) : null;
  const part = /^participations\.(\d+)$/.exec(field);
  if (part) return correctParticipation(inputs, Number(part[1]), v, ctx);

  const rule = ruleFor(inputs, field);
  if (!rule) return null;
  const ranged = fitRange(inputs, rule, v, ctx);
  const x = ranged ? ranged.value : v;
  if (!Number.isFinite(x)) return ranged;
  if (product && field === "floorUnits" && Number.isFinite(inputs.decay) && x > inputs.decay + EPS) {
    return { value: inputs.decay, note: note("Lowered To The Decay", shown(rule, inputs.decay)) };
  }
  if (product && field === "decay" && Number.isFinite(inputs.floorUnits) && x < inputs.floorUnits - EPS) {
    return { value: inputs.floorUnits, note: note("Raised To The Decay Reduction Below Floor", shown(rule, inputs.floorUnits)) };
  }
  if (product && field === "coupon") return correctCoupon(inputs, ranged, v);
  if (field === "tenorDays" && isValidYmd(inputs.valuationDate)) {
    const last = lastFilledExpiry(inputs);
    const need = last ? daysBetween(inputs.valuationDate, last.date) : 0;
    if (last && x < need && need <= rule.max) return { value: need, note: note(`Raised To Reach Expiry ${last.index + 1}`, shown(rule, need)) };
  }
  return ranged;
}

/** A Valuation Date after today moves to today; one on or after Expiry 1 moves to the day before it. */
export function correctValuationDate(inputs: DeskInputs, ymd: string, ctx: CorrectionContext): Correction<string> | null {
  if (!isValidYmd(ymd)) return null;
  let d = ymd;
  let what: string | null = null;
  if (d > ctx.today) {
    d = ctx.today;
    what = "Moved To Today";
  }
  const count = Number.isInteger(inputs.expiryCount) ? inputs.expiryCount : 0;
  const first = inputs.expiryDates.slice(0, count).findIndex((e) => isValidYmd(e));
  if (first >= 0 && d >= inputs.expiryDates[first]!) {
    d = addDays(inputs.expiryDates[first]!, -1);
    what = `Moved Before Expiry ${first + 1}`;
  }
  return what ? { value: d, note: note(what, formatDate(d)) } : null;
}

/** The underlying's expiry in the month a date falls in, shifted by whole months. */
function expiryInMonth(ymd: string, months: number, weekday: number): string {
  const d = parseYmd(ymd);
  const m = d.getUTCMonth() + months;
  return lastWeekdayOfMonth(d.getUTCFullYear() + Math.floor(m / 12), (((m % 12) + 12) % 12) + 1, weekday);
}

/**
 * An expiry moves to its month's last expiry weekday, then into its place: after the Valuation Date and the expiry before
 * it, before the expiry after it and on or before the maturity. Past a neighbour it becomes the first expiry after it, or
 * the last before it; with no expiry month between its neighbours it keeps what it had. The note says what happened.
 */
export function correctExpiryDate(inputs: DeskInputs, i: number, typed: string): Correction<string> {
  const u = inputs.underlying;
  if (!u || !isValidYmd(typed)) return { value: typed, note: "" };
  const weekday = EXPIRY_WEEKDAY[u];
  let d = snapExpiry(typed, u);
  let what = d !== typed ? `Moved To The Last ${WEEKDAY_NAMES[weekday]}` : "";
  const prev = inputs.expiryDates[i - 1];
  const next = inputs.expiryDates[i + 1];
  const after = isValidYmd(prev) && (!isValidYmd(inputs.valuationDate) || prev > inputs.valuationDate)
    ? { date: prev, label: `Expiry ${i}` }
    : isValidYmd(inputs.valuationDate)
      ? { date: inputs.valuationDate, label: "The Valuation Date" }
      : null;
  const maturity = isValidYmd(inputs.valuationDate) && Number.isInteger(inputs.tenorDays) && inputs.tenorDays > 0 ? maturityDate(inputs) : null;
  const firstAfter = (b: string) => (expiryInMonth(b, 0, weekday) > b ? expiryInMonth(b, 0, weekday) : expiryInMonth(b, 1, weekday));
  const lastBefore = (b: string, inclusive: boolean) => {
    const same = expiryInMonth(b, 0, weekday);
    return same < b || (inclusive && same === b) ? same : expiryInMonth(b, -1, weekday);
  };
  if (after && d <= after.date) {
    d = firstAfter(after.date);
    what = `Moved After ${after.label}`;
  }
  if (isValidYmd(next) && d >= next) {
    d = lastBefore(next, false);
    what = `Moved Before Expiry ${i + 2}`;
  }
  if (maturity && d > maturity) {
    d = lastBefore(maturity, true);
    what = "Moved Before The Maturity";
  }
  if (after && d <= after.date) {
    const current = inputs.expiryDates[i] ?? "";
    const bound = isValidYmd(next) && next <= (maturity ?? next) ? `Expiry ${i + 2}` : "The Maturity";
    return { value: current, note: `Kept, No Expiry Month Between ${after.label} And ${bound}` };
  }
  return { value: d, note: what ? note(what, formatDate(d)) : "" };
}

/** A Buy Or Sell the payoff does not give, once every strike and term is in, becomes the side it needs. */
export function correctSide(inputs: DeskInputs, i: number, side: StrikeSide): Correction<StrikeSide> | null {
  if (inputs.bookMode === "custom") return null;
  const k = inputs.strikePercents;
  const filled = [...k, ...inputs.participations.filter((p) => p != null), inputs.coupon, inputs.decay, inputs.floorUnits];
  if (k.length < 5 || !filled.every((x) => Number.isFinite(x as number))) return null;
  const want = derivedSides(inputs as Parameters<typeof derivedSides>[0])[i];
  if (!want || want === side) return null;
  return { value: want, note: `Set To ${want === "B" ? "Buy" : "Sell"}, The Payoff Needs It` };
}

/** Rule codes Run Simulation corrects rather than refuses. */
export const CORRECTED_AT_RUN = new Set([
  "strike-positive",
  "strike-order",
  "coupon-unreachable",
  "coupon-exceeded",
  "participation",
  "protection",
  "strike-side",
  "floor-units",
  "expiry-past",
  "expiry-order",
  "expiry-maturity",
  "leg-level",
  "leg-quantity",
]);

type Fixed = { inputs: DeskInputs; field: string; note: string };

function setNumber(inputs: DeskInputs, field: string, value: number | null): DeskInputs {
  const strike = /^strikePercents\.(\d+)$/.exec(field);
  if (strike) return { ...inputs, strikePercents: Object.assign([...inputs.strikePercents], { [Number(strike[1])]: value }) };
  const part = /^participations\.(\d+)$/.exec(field);
  if (part) return { ...inputs, participations: Object.assign([...inputs.participations], { [Number(part[1])]: value }) };
  const leg = /^customLegs\.(\d+)\.(percent|quantity)$/.exec(field);
  if (leg) return { ...inputs, customLegs: (inputs.customLegs ?? []).map((l, i) => (i === Number(leg[1]) ? { ...l, [leg[2]!]: value } : l)) };
  return { ...inputs, [field]: value };
}

const same = (a: unknown, b: unknown) => a === b || (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b));

/** The correction of the field a rule names, from its current value; null when that field has no correction to make. */
function fixError(inputs: DeskInputs, e: FieldError, ctx: CorrectionContext): Fixed | null {
  const n = inputs.strikePercents.length - 4;
  // A Coupon the spreads do not reach, with the top spread typed, is the top spread's to correct: it goes back to Calculated
  // and the Coupon stays. With the top spread Calculated, only the Coupon can give it a share.
  const topTyped = n >= 1 && inputs.participations[n - 1] != null;
  const map: Record<string, string> = { protection: `strikePercents.${n + 1}`, ...(e.code === "coupon-unreachable" && topTyped ? { coupon: `participations.${n - 1}` } : {}) };
  const spread = /^spreads\.(\d+)$/.exec(e.field);
  const field = spread ? `participations.${spread[1]}` : (map[e.field] ?? e.field);
  if (field === "valuationDate") {
    const c = correctValuationDate(inputs, inputs.valuationDate, ctx);
    return c ? { inputs: { ...inputs, valuationDate: c.value }, field, note: c.note } : null;
  }
  const expiry = /^expiryDates\.(\d+)$/.exec(field);
  if (expiry) {
    const i = Number(expiry[1]);
    const c = correctExpiryDate(inputs, i, inputs.expiryDates[i] ?? "");
    return same(c.value, inputs.expiryDates[i]) ? null : { inputs: { ...inputs, expiryDates: Object.assign([...inputs.expiryDates], { [i]: c.value }) }, field, note: c.note };
  }
  const side = /^strikeSides\.(\d+)$/.exec(field);
  if (side) {
    const i = Number(side[1]);
    const c = correctSide(inputs, i, inputs.strikeSides[i] as StrikeSide);
    return c ? { inputs: { ...inputs, strikeSides: Object.assign([...inputs.strikeSides], { [i]: c.value }) }, field, note: c.note } : null;
  }
  const part = /^participations\.(\d+)$/.exec(field);
  const current = part ? (inputs.participations[Number(part[1])] ?? deriveTerms(inputs).spreads[Number(part[1])]?.participation ?? NaN) : currentNumber(inputs, field);
  if (!Number.isFinite(current)) return null;
  const c = correctNumber(inputs, field, current, ctx);
  if (!c || same(c.value, part ? inputs.participations[Number(part[1])] : current)) return null;
  return { inputs: setNumber(inputs, field, c.value), field, note: c.note };
}

/**
 * What Run Simulation corrects before it checks the inputs: every rule broken across fields after the commits, such as a
 * Buy Or Sell the payoff no longer gives once the terms are in, is corrected on the field the rule names, one at a time
 * until none is left that can be. Empty fields and anything with no correction are left for the run's popup.
 */
export function correctForRun(inputs: DeskInputs, ctx: CorrectionContext): { inputs: DeskInputs; notes: Record<string, string> } {
  let current = inputs;
  const notes: Record<string, string> = {};
  for (let pass = 0; pass < 60; pass++) {
    const errors = validateDeskInputs(current, { today: ctx.today }).filter((e) => e.kind === "invalid");
    const fixed = errors.map((e) => fixError(current, e, ctx)).find((f) => f != null);
    if (!fixed) break;
    current = fixed.inputs;
    notes[fixed.field] = fixed.note;
  }
  return { inputs: current, notes };
}
