import { isValidYmd } from "@/lib/engine/dates";
import { MAX_EXPIRIES, MIN_EXPIRIES, validateSchedule } from "@/lib/engine/schedule";
import { deriveTerms, MAX_SPREADS, MIN_SPREADS, validateStructure } from "@/lib/engine/structure";
import type { HedgeInputs } from "@/lib/engine/types";
import { underlyingName, type DeskInputs } from "@/lib/inputs/draft";

export const INPUT_SECTIONS = [
  "Underlying And Market",
  "Rates",
  "Product Terms",
  "Observation Expiries",
  "Strikes",
  "Spreads And Option Type",
  "Notional And Costs",
  "Volatility And Margin",
] as const;

export type InputSection = (typeof INPUT_SECTIONS)[number];

export type FieldError = {
  /** Input key, such as spot, strikePercents.2 or spreads.0. The field's test id is input-<key with dots as dashes>. */
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
};

const rules: NumberRule[] = [
  { key: "spot", label: (u) => `${u} Spot`, section: "Underlying And Market", min: 0, max: 1_000_000 },
  { key: "hedgeStrike", label: () => "Hedge Strike", section: "Underlying And Market", min: 0, max: 1_000_000 },
  { key: "nbfcRate", label: () => "NBFC Rate", section: "Rates", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "premiumRate", label: () => "Premium Growth Rate", section: "Rates", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "marginGrowthRate", label: () => "Margin Growth Rate", section: "Rates", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "coupon", label: () => "Coupon", section: "Product Terms", min: 0, max: 10, percent: true },
  { key: "decay", label: () => "Decay", section: "Product Terms", min: 0, max: 10 },
  { key: "floorUnits", label: () => "Floor Units", section: "Product Terms", min: 0, max: 10, minInclusive: true },
  { key: "tenorDays", label: () => "Tenor In Days", section: "Product Terms", min: 1, max: 3650, minInclusive: true, integer: true },
  { key: "startLevelUplift", label: () => "Start Level Uplift", section: "Product Terms", min: 0, max: 0.1, minInclusive: true, percent: true },
  { key: "notionalCr", label: () => "Notional In Crore", section: "Notional And Costs", min: 0, max: 100_000 },
  { key: "transactionCost", label: () => "Transaction Cost", section: "Notional And Costs", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "issuanceCost", label: () => "Issuance Cost", section: "Notional And Costs", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "marginCost", label: () => "Margin Cost", section: "Notional And Costs", min: 0, max: 0.2, minInclusive: true, percent: true },
  { key: "dailyVol", label: (u) => `${u} Daily Volatility`, section: "Volatility And Margin", min: 0, max: 0.1, percent: true },
  { key: "exchangeForwardRate", label: () => "Exchange Forward Rate", section: "Volatility And Margin", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "exchangeDiscountRate", label: () => "Exchange Discount Rate", section: "Volatility And Margin", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "stressedForwardRate", label: () => "Stressed Forward Rate", section: "Volatility And Margin", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "stressedDiscountRate", label: () => "Stressed Discount Rate", section: "Volatility And Margin", min: 0, max: 0.5, minInclusive: true, percent: true },
  { key: "stressSigmas", label: () => "Shock Sigmas", section: "Volatility And Margin", min: 0, max: 20 },
  { key: "stressDays", label: () => "Shock Days", section: "Volatility And Margin", min: 1, max: 30, minInclusive: true, integer: true },
  { key: "stressVolMultiplier", label: () => "Volatility Multiplier", section: "Volatility And Margin", min: 0, max: 10 },
  { key: "exposureMargin", label: () => "Exposure Margin", section: "Volatility And Margin", min: 0, max: 1, minInclusive: true, percent: true },
  { key: "futuresMargin", label: () => "Futures Margin", section: "Volatility And Margin", min: 0, max: 1, minInclusive: true, percent: true },
];

const show = (v: number, percent?: boolean) => (percent ? `${+(v * 100).toFixed(4)}%` : v.toLocaleString("en-IN"));

function checkNumber(value: number, rule: Omit<NumberRule, "key" | "label" | "section">, label: string): { kind: "required" | "invalid"; message: string } | null {
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
  return null;
}

/** Engine issue fields mapped to input keys. */
function mapEngineField(field: string): { field: string; section: InputSection; label: string } {
  const strike = /^strikes\.(\d+)$/.exec(field);
  if (strike) return { field: `strikePercents.${strike[1]}`, section: "Strikes", label: `Strike ${Number(strike[1]) + 1}` };
  const spread = /^spreads\.(\d+)$/.exec(field);
  if (spread) return { field, section: "Spreads And Option Type", label: `Spread ${Number(spread[1]) + 1}` };
  const month = /^expiryMonths\.(\d+)$/.exec(field);
  if (month) return { field, section: "Observation Expiries", label: `Expiry Month ${Number(month[1]) + 1}` };
  const map: Record<string, { section: InputSection; label: string; field?: string }> = {
    spreads: { section: "Spreads And Option Type", label: "Number Of Spreads", field: "spreadCount" },
    coupon: { section: "Product Terms", label: "Coupon" },
    protection: { section: "Product Terms", label: "Protection" },
    floorLevel: { section: "Product Terms", label: "Decay Floor Level" },
    floorUnits: { section: "Product Terms", label: "Floor Units" },
    tenorDays: { section: "Product Terms", label: "Tenor In Days" },
    expiryCount: { section: "Observation Expiries", label: "Number Of Expiry Dates" },
    expiryMonths: { section: "Observation Expiries", label: "Expiry Months" },
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
      const label = `Expiry Month ${i + 1}`;
      const r = checkNumber(inputs.expiryMonths[i] ?? NaN, { min: 1, max: 120, minInclusive: true, integer: true }, label);
      if (r) push({ field: `expiryMonths.${i}`, label, section: "Observation Expiries", ...r });
    }
  }

  // Strikes
  const k = inputs.strikePercents;
  const n = k.length - 4;
  if (n < MIN_SPREADS || n > MAX_SPREADS) {
    push({ field: "spreadCount", label: "Number Of Spreads", section: "Spreads And Option Type", kind: "invalid", message: `Use ${MIN_SPREADS} to ${MAX_SPREADS} spreads.` });
  }
  k.forEach((v, i) => {
    const label = `Strike ${i + 1}`;
    const r = checkNumber(v, { min: 0, max: 500 }, label);
    if (r) push({ field: `strikePercents.${i}`, label, section: "Strikes", ...r });
  });

  // Spreads and Option Type
  if (!inputs.optionType) push({ field: "optionType", label: "Option Type", section: "Spreads And Option Type", kind: "required", message: "Select Put or Call." });
  inputs.participations.forEach((p, j) => {
    if (p == null) return;
    const label = `Spread ${j + 1} Participation Rate`;
    const r = checkNumber(p, { min: 0, max: 100 }, label);
    if (r) push({ field: `participations.${j}`, label, section: "Spreads And Option Type", ...r });
  });

  // Rules across fields, once the fields they read are filled.
  const strikesFilled = k.every((v) => Number.isFinite(v) && v > 0);
  const termsFilled = strikesFilled && Number.isFinite(inputs.coupon) && Number.isFinite(inputs.decay) && Number.isFinite(inputs.floorUnits);
  if (termsFilled && inputs.participations.every((p) => p == null || Number.isFinite(p))) {
    for (const issue of validateStructure(inputs as HedgeInputs)) {
      const mapped = mapEngineField(issue.field);
      push({ ...mapped, kind: "invalid", message: issue.message, code: issue.code, fix: issue.fix });
    }
    const terms = deriveTerms(inputs);
    const top = terms.spreads[terms.nSpreads - 1];
    if (top && terms.participationDerived[terms.nSpreads - 1] && !(top.participation > 0)) {
      push({
        field: `participations.${terms.nSpreads - 1}`,
        label: `Spread ${terms.nSpreads} Participation Rate`,
        section: "Spreads And Option Type",
        kind: "invalid",
        message: "The coupon cannot be reached: the top spread would need a participation at or below zero.",
        code: "coupon-unreachable",
      });
    }
  }
  const scheduleFilled =
    inputs.underlying !== "" &&
    isValidYmd(inputs.valuationDate) &&
    countOk &&
    Number.isInteger(inputs.tenorDays) &&
    inputs.tenorDays > 0 &&
    inputs.expiryMonths.slice(0, count).every((m) => Number.isInteger(m) && m > 0);
  if (scheduleFilled) {
    for (const issue of validateSchedule(inputs as HedgeInputs).errors) {
      const mapped = mapEngineField(issue.field);
      push({ ...mapped, kind: "invalid", message: issue.message, code: issue.code, fix: issue.fix });
    }
  }

  const order = (e: FieldError) => INPUT_SECTIONS.indexOf(e.section);
  return errors.sort((a, b) => order(a) - order(b));
}

/** Errors grouped by section, in section order, for the validation dialog. */
export function groupBySection(errors: FieldError[]): Array<{ title: InputSection; items: FieldError[] }> {
  return INPUT_SECTIONS.map((title) => ({ title, items: errors.filter((e) => e.section === title) })).filter((g) => g.items.length);
}

/** The data-testid of the input that holds a field. */
export function fieldTestId(field: string): string {
  const spread = /^spreads\.(\d+)$/.exec(field);
  if (spread) return `input-spreads-${spread[1]}-sell`;
  if (field === "spreadCount") return "input-spreadCount-input";
  return `input-${field.replace(/\./g, "-")}`;
}
