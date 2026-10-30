import { isValidYmd } from "@/lib/engine/dates";
import { MAX_EXPIRIES, MIN_EXPIRIES, validateSchedule } from "@/lib/engine/schedule";
import { MAX_SPREADS, MIN_SPREADS, validateStructure } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { blankInputs, underlyingName, type DeskInputs } from "@/lib/inputs/draft";

/**
 * Every input rule, shared by the field check on each edit and the full check behind Run Simulation.
 * The sections are the fill order of the Inputs page.
 */
export const INPUT_SECTIONS = [
  "Underlying And Market",
  "Observation Expiries",
  "Strikes And Spreads",
  "Rates",
  "Product Terms",
  "Volatility",
  "Margin And Desk Terms",
] as const;

export type InputSection = (typeof INPUT_SECTIONS)[number];

export type FieldError = {
  /** Input key, such as spot, strikePercents.2 or expiryDates.0. The field's test id is input-<key with dots as dashes>. */
  field: string;
  label: string;
  message: string;
  section: InputSection;
  /** Required: the field is empty. Invalid: it has a value that breaks a rule. */
  kind: "required" | "invalid";
  code?: string;
  fix?: string;
};

type NumberRule = {
  key: keyof DeskInputs;
  label: (u: string) => string;
  section: InputSection;
  min: number;
  max: number;
  /** Lower bound allowed itself, such as 0% costs. */
  minInclusive?: boolean;
  integer?: boolean;
  percent?: boolean;
  /** A whole multiple of this step, such as 100 points for the hedge strike. */
  step?: number;
};

const rules: NumberRule[] = [
  { key: "spot", label: (u) => `${u} Spot`, section: "Underlying And Market", min: 0, max: 1_000_000 },
  { key: "hedgeStrike", label: () => "Hedge Strike", section: "Underlying And Market", min: 0, max: 1_000_000, step: 100 },
  { key: "nbfcRate", label: () => "NBFC Rate", section: "Rates", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "premiumRate", label: () => "Premium Growth Rate", section: "Rates", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "marginGrowthRate", label: () => "Margin Growth Rate", section: "Rates", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "coupon", label: () => "Coupon", section: "Product Terms", min: 0, max: 10, percent: true },
  { key: "decay", label: () => "Decay", section: "Product Terms", min: 0, max: 10 },
  { key: "floorUnits", label: () => "Decay Reduction Below Floor", section: "Product Terms", min: 0, max: 10, minInclusive: true },
  { key: "tenorDays", label: () => "Tenor In Days", section: "Product Terms", min: 1, max: 3650, minInclusive: true, integer: true },
  { key: "startLevelUplift", label: () => "Start Level Uplift", section: "Product Terms", min: 0, max: 0.1, minInclusive: true, percent: true },
  { key: "notionalCr", label: () => "Notional In Crore", section: "Product Terms", min: 0, max: 100_000 },
  { key: "dailyVol", label: (u) => `${u} Daily Volatility`, section: "Volatility", min: 0, max: 0.1, percent: true },
  { key: "transactionCost", label: () => "Transaction Cost", section: "Margin And Desk Terms", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "issuanceCost", label: () => "Issuance Cost", section: "Margin And Desk Terms", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "marginCost", label: () => "Margin Cost", section: "Margin And Desk Terms", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "exchangeForwardRate", label: () => "Exchange Forward Rate", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "exchangeDiscountRate", label: () => "Exchange Discount Rate", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "stressedForwardRate", label: () => "Stressed Forward Rate", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "stressedDiscountRate", label: () => "Stressed Discount Rate", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "stressSigmas", label: () => "Shock Sigmas", section: "Margin And Desk Terms", min: 0, max: 20 },
  { key: "stressDays", label: () => "Shock Days", section: "Margin And Desk Terms", min: 1, max: 30, minInclusive: true, integer: true },
  { key: "stressVolMultiplier", label: () => "Volatility Multiplier", section: "Margin And Desk Terms", min: 0, max: 10 },
  { key: "exposureMargin", label: () => "Exposure Margin", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "futuresMargin", label: () => "Futures Margin", section: "Margin And Desk Terms", min: 0, max: 1, minInclusive: true, percent: true },
];

const STRIKE_RULE = { min: 0, max: 500 } as const;
const PARTICIPATION_RULE = { min: 0, max: 100 } as const;

export type NumberFieldRule = {
  field: string;
  label: string;
  section: InputSection;
  min: number;
  max: number;
  minInclusive: boolean;
  integer: boolean;
  /** Typed as a % on screen and stored as a decimal. */
  percent: boolean;
  step?: number;
};

/** Every number field and its range for the inputs in hand: the fixed fields, then each strike and typed participation. */
export function numberFieldRules(inputs: DeskInputs): NumberFieldRule[] {
  const u = underlyingName(inputs);
  const out: NumberFieldRule[] = rules.map((r) => ({
    field: String(r.key),
    label: r.label(u),
    section: r.section,
    min: r.min,
    max: r.max,
    minInclusive: Boolean(r.minInclusive),
    integer: Boolean(r.integer),
    percent: Boolean(r.percent),
    step: r.step,
  }));
  inputs.strikePercents.forEach((_, i) =>
    out.push({ field: `strikePercents.${i}`, label: `Strike ${i + 1}`, section: "Strikes And Spreads", ...STRIKE_RULE, minInclusive: false, integer: false, percent: false }),
  );
  inputs.participations.forEach((p, j) => {
    if (p === null) return;
    out.push({ field: `participations.${j}`, label: `Spread ${j + 1} Participation Rate`, section: "Strikes And Spreads", ...PARTICIPATION_RULE, minInclusive: false, integer: false, percent: false });
  });
  return out;
}

/**
 * Every field Run Simulation requires, for a product with this many expiries and spreads:
 * the fields that are empty in Blank Inputs, plus the expiry and strike rows the counts create.
 */
export function requiredFields(expiryCount: number, nSpreads: number): FieldError[] {
  const sized: DeskInputs = {
    ...blankInputs(),
    expiryCount,
    expiryDates: Array.from({ length: expiryCount }, () => ""),
    strikePercents: Array.from({ length: nSpreads + 4 }, () => NaN),
    strikeOptionTypes: Array.from({ length: nSpreads + 4 }, () => ""),
    strikeSides: Array.from({ length: nSpreads + 4 }, () => ""),
    participations: [...Array.from({ length: nSpreads - 1 }, () => NaN), null],
  };
  const fields = new Map<string, FieldError>();
  for (const e of [...validateDeskInputs(blankInputs(), { today: "9999-12-31" }), ...validateDeskInputs(sized, { today: "9999-12-31" })]) {
    if (e.kind === "required" && !fields.has(e.field)) fields.set(e.field, e);
  }
  return [...fields.values()];
}

const show = (v: number, percent?: boolean) => (percent ? `${+(v * 100).toFixed(3)}%` : v.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

/** The allowed range of a number field, as the popup states it. */
export function allowedRange(rule: Pick<NumberFieldRule, "min" | "max" | "minInclusive" | "percent" | "integer" | "step">): string {
  const from = `${rule.minInclusive ? "From" : "Above"} ${show(rule.min, rule.percent)} To ${show(rule.max, rule.percent)}`;
  if (rule.step) return `${from}, In Steps Of ${show(rule.step)}`;
  return rule.integer ? `${from}, Whole Numbers Only` : from;
}

function checkNumber(
  value: number,
  rule: { min: number; max: number; minInclusive?: boolean; integer?: boolean; percent?: boolean; step?: number },
  label: string,
): { kind: "required" | "invalid"; message: string } | null {
  if (typeof value !== "number" || Number.isNaN(value)) return { kind: "required", message: `${label} is required.` };
  if (!Number.isFinite(value)) return { kind: "invalid", message: `${label} must be a finite number.` };
  if (rule.integer && !Number.isInteger(value)) return { kind: "invalid", message: `${label} must be a whole number.` };
  const low = rule.minInclusive ? value < rule.min : value <= rule.min;
  if (low || value > rule.max) {
    return {
      kind: "invalid",
      message: `${label} must be ${rule.minInclusive ? "at least" : "above"} ${show(rule.min, rule.percent)} and at most ${show(rule.max, rule.percent)}.`,
    };
  }
  if (rule.step && Math.abs(value / rule.step - Math.round(value / rule.step)) > 1e-9) {
    return { kind: "invalid", message: `${label} must be a multiple of ${show(rule.step)}.` };
  }
  return null;
}

/**
 * The check on one edited field, before it is kept: null keeps the value, a message reverts the field.
 * An empty field is kept, so a value can be cleared and typed again; Run Simulation reports it as missing.
 */
export function checkFieldEdit(inputs: DeskInputs, field: string, value: number | string): { label: string; message: string; range?: string } | null {
  if (typeof value === "number" && Number.isNaN(value)) return null;
  if (value === "") return null;
  const date = /^expiryDates\.(\d+)$/.exec(field);
  if (date) {
    const i = Number(date[1]);
    const label = `Expiry ${i + 1}`;
    const d = String(value);
    if (!isValidYmd(d)) return { label, message: `${label} is not a valid date.` };
    if (inputs.valuationDate && d <= inputs.valuationDate) return { label, message: `${label} must fall after the Valuation Date.`, range: `After ${inputs.valuationDate}` };
    const prev = inputs.expiryDates[i - 1];
    const next = inputs.expiryDates[i + 1];
    if (prev && isValidYmd(prev) && d <= prev) return { label, message: `${label} must fall after Expiry ${i}.`, range: `After ${prev}` };
    if (next && isValidYmd(next) && d >= next) return { label, message: `${label} must fall before Expiry ${i + 2}.`, range: `Before ${next}` };
    return null;
  }
  const rule = numberFieldRules(inputs).find((r) => r.field === field);
  if (!rule) return null;
  const r = checkNumber(Number(value), rule, rule.label);
  return r ? { label: rule.label, message: r.message, range: allowedRange(rule) } : null;
}

/** Errors shown only under their field: they open no popup and keep Run off until fixed. */
export const INLINE_ONLY_CODES = new Set(["coupon-exceeded", "strike-side"]);

/** Engine issue fields mapped to input keys. */
function mapEngineField(field: string): { field: string; section: InputSection; label: string } {
  const strike = /^strikes\.(\d+)$/.exec(field);
  if (strike) return { field: `strikePercents.${strike[1]}`, section: "Strikes And Spreads", label: `Strike ${Number(strike[1]) + 1}` };
  const side = /^strikeSides\.(\d+)$/.exec(field);
  if (side) return { field, section: "Strikes And Spreads", label: `Strike ${Number(side[1]) + 1} Buy Or Sell` };
  const spread = /^spreads\.(\d+)$/.exec(field);
  if (spread) return { field, section: "Strikes And Spreads", label: `Spread ${Number(spread[1]) + 1}` };
  const participation = /^participations\.(\d+)$/.exec(field);
  if (participation) return { field, section: "Strikes And Spreads", label: `Spread ${Number(participation[1]) + 1} Participation Rate` };
  const expiry = /^expiryDates\.(\d+)$/.exec(field);
  if (expiry) return { field, section: "Observation Expiries", label: `Expiry ${Number(expiry[1]) + 1}` };
  const map: Record<string, { section: InputSection; label: string; field?: string }> = {
    spreads: { section: "Strikes And Spreads", label: "Number Of Spreads", field: "spreadCount" },
    coupon: { section: "Product Terms", label: "Coupon" },
    protection: { section: "Product Terms", label: "Protection" },
    floorLevel: { section: "Product Terms", label: "Decay Floor Level" },
    floorUnits: { section: "Product Terms", label: "Decay Reduction Below Floor" },
    tenorDays: { section: "Product Terms", label: "Tenor In Days" },
    expiryCount: { section: "Observation Expiries", label: "Number Of Expiry Dates" },
    expiryDates: { section: "Observation Expiries", label: "Expiries" },
  };
  const m = map[field];
  return { field: m?.field ?? field, section: m?.section ?? "Product Terms", label: m?.label ?? field };
}

/**
 * Every field-level rule, in section order. Pure: the UI and the tests share it.
 * `today` is the India calendar date, so the valuation date cannot be in the future.
 */
export function validateDeskInputs(inputs: DeskInputs, opts: { today: string }): FieldError[] {
  const errors: FieldError[] = [];
  const u = underlyingName(inputs);
  const push = (e: FieldError) => {
    if (!errors.some((x) => x.field === e.field)) errors.push(e);
  };

  if (!inputs.underlying) push({ field: "underlying", label: "Underlying", section: "Underlying And Market", kind: "required", message: "Select Nifty or Sensex." });
  if (!inputs.valuationDate) {
    push({ field: "valuationDate", label: "Valuation Date", section: "Underlying And Market", kind: "required", message: "Valuation Date is required." });
  } else if (!isValidYmd(inputs.valuationDate)) {
    push({ field: "valuationDate", label: "Valuation Date", section: "Underlying And Market", kind: "invalid", message: "Valuation Date is not a valid date." });
  } else if (inputs.valuationDate > opts.today) {
    push({ field: "valuationDate", label: "Valuation Date", section: "Underlying And Market", kind: "invalid", message: "Valuation Date cannot be in the future.", fix: "Use today or an earlier date." });
  }

  for (const rule of rules) {
    const label = rule.label(u);
    const r = checkNumber(inputs[rule.key] as number, rule, label);
    if (r) push({ field: String(rule.key), label, section: rule.section, ...r });
  }

  // Observation expiries
  const count = inputs.expiryCount;
  const countOk = Number.isInteger(count) && count >= MIN_EXPIRIES && count <= MAX_EXPIRIES;
  if (!countOk) {
    push({
      field: "expiryCount",
      label: "Number Of Expiry Dates",
      section: "Observation Expiries",
      kind: Number.isNaN(count) ? "required" : "invalid",
      message: Number.isNaN(count) ? "Pick the number of expiry dates." : `Pick ${MIN_EXPIRIES} to ${MAX_EXPIRIES} expiry dates.`,
    });
  } else {
    for (let i = 0; i < count; i++) {
      const d = inputs.expiryDates[i] ?? "";
      const label = `Expiry ${i + 1}`;
      if (!d) push({ field: `expiryDates.${i}`, label, section: "Observation Expiries", kind: "required", message: `${label} is required.` });
      else if (!isValidYmd(d)) push({ field: `expiryDates.${i}`, label, section: "Observation Expiries", kind: "invalid", message: `${label} is not a valid date.` });
    }
  }

  // Strikes and spreads
  const k = inputs.strikePercents;
  const n = k.length - 4;
  const spreadsOk = n >= MIN_SPREADS && n <= MAX_SPREADS;
  if (!k.length) {
    push({ field: "spreadCount", label: "Number Of Spreads", section: "Strikes And Spreads", kind: "required", message: "Pick the number of spreads." });
  } else if (!spreadsOk) {
    push({ field: "spreadCount", label: "Number Of Spreads", section: "Strikes And Spreads", kind: "invalid", message: `Use ${MIN_SPREADS} to ${MAX_SPREADS} spreads.` });
  }
  k.forEach((v, i) => {
    const label = `Strike ${i + 1}`;
    const r = checkNumber(v, STRIKE_RULE, label);
    if (r) push({ field: `strikePercents.${i}`, label, section: "Strikes And Spreads", ...r });
    if (!inputs.strikeOptionTypes[i]) {
      push({ field: `strikeOptionTypes.${i}`, label: `Strike ${i + 1} Option Type`, section: "Strikes And Spreads", kind: "required", message: "Select Put or Call." });
    }
    if (!inputs.strikeSides[i]) {
      push({ field: `strikeSides.${i}`, label: `Strike ${i + 1} Buy Or Sell`, section: "Strikes And Spreads", kind: "required", message: "Select Buy or Sell." });
    }
  });
  inputs.participations.forEach((p, j) => {
    if (p == null) return;
    const label = `Spread ${j + 1} Participation Rate`;
    const r = checkNumber(p, PARTICIPATION_RULE, label);
    if (r) push({ field: `participations.${j}`, label, section: "Strikes And Spreads", ...r });
  });

  // Rules across fields, once the fields they read are filled.
  const strikesFilled = spreadsOk && k.every((v) => Number.isFinite(v) && v > 0);
  const termsFilled = strikesFilled && Number.isFinite(inputs.coupon) && Number.isFinite(inputs.decay) && Number.isFinite(inputs.floorUnits);
  if (termsFilled && inputs.participations.every((p) => p == null || Number.isFinite(p))) {
    for (const issue of validateStructure(inputs as HedgeInputs)) {
      const mapped = mapEngineField(issue.field);
      push({ ...mapped, kind: "invalid", message: issue.message, code: issue.code, fix: issue.fix });
    }
  }
  const scheduleFilled =
    inputs.underlying !== "" &&
    isValidYmd(inputs.valuationDate) &&
    countOk &&
    Number.isInteger(inputs.tenorDays) &&
    inputs.tenorDays > 0 &&
    inputs.expiryDates.slice(0, count).every((d) => isValidYmd(d));
  if (scheduleFilled) {
    for (const issue of validateSchedule(inputs as HedgeInputs).errors) {
      const mapped = mapEngineField(issue.field);
      push({ ...mapped, kind: "invalid", message: issue.message, code: issue.code, fix: issue.fix });
    }
  }

  const order = (e: FieldError) => INPUT_SECTIONS.indexOf(e.section);
  return errors.sort((a, b) => order(a) - order(b));
}

/**
 * The fill order: step 2 opens once the Underlying and Valuation Date are filled, step 3 once every expiry is,
 * and steps 4 to 7 together once the strikes and spreads are. Only empty fields hold a step: a rule across
 * fields broken later never locks the step being typed in.
 */
export function unlockedSteps(errors: FieldError[]): number {
  const missing = errors.filter((e) => e.kind === "required");
  const clean = (section: InputSection) => !missing.some((e) => e.section === section);
  if (missing.some((e) => e.field === "underlying" || e.field === "valuationDate")) return 1;
  if (!clean("Observation Expiries")) return 2;
  if (!clean("Strikes And Spreads")) return 3;
  return INPUT_SECTIONS.length;
}

/** Errors grouped by section, in section order, for the validation dialog. */
export function groupBySection(errors: FieldError[]): Array<{ title: InputSection; items: FieldError[] }> {
  return INPUT_SECTIONS.map((title) => ({ title, items: errors.filter((e) => e.section === title) })).filter((g) => g.items.length);
}

/** The section, and so the numbered group, a field belongs to. */
export function fieldSection(field: string): InputSection {
  const key = field.split(".")[0]!;
  const rule = rules.find((r) => r.key === key);
  if (rule) return rule.section;
  if (/^(strike|participations|spreads|spreadCount)/.test(key)) return "Strikes And Spreads";
  if (key.startsWith("expiry") || key === "hedgeExpiryIndex") return "Observation Expiries";
  if (key === "underlying" || key === "valuationDate") return "Underlying And Market";
  if (key === "dailyVol" || key === "historyWindowDays") return "Volatility";
  return mapEngineField(field).section;
}

/** The data-testid of the input that holds a field. */
export function fieldTestId(field: string): string {
  const spread = /^spreads\.(\d+)$/.exec(field);
  if (spread) return `input-spreads-${spread[1]}-sell`;
  if (field === "spreadCount") return "input-spreadCount";
  return `input-${field.replace(/\./g, "-")}`;
}
