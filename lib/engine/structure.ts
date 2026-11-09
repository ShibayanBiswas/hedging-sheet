import type { CustomLeg, HedgeInputs, SpreadInput, StrikeRole, StrikeSide, StrikeSlot, ValidationIssue } from "@/lib/engine/types";

export const MIN_SPREADS = 1;
/** Up to 6 spreads, so the product has 5 to 10 strikes. */
export const MAX_SPREADS = 6;
/** A Custom Option Book has 1 to 10 legs. */
export const MIN_LEGS = 1;
export const MAX_LEGS = 10;
/** A leg's quantity, in units per start level of notional, runs above 0 to this. */
export const MAX_LEG_QUANTITY = 1000;

/** Custom Option Book: the typed legs are the book. Anything else, an absent mode included, is the Product Payoff. */
export function isCustomBook(inputs: Pick<HedgeInputs, "bookMode">): boolean {
  return inputs.bookMode === "custom";
}

/** A leg's units, Pricer row 47: the quantity, negative where the book sells. */
export function legUnits(leg: Pick<CustomLeg, "side" | "quantity">): number {
  return leg.side === "S" ? -leg.quantity : leg.quantity;
}

/**
 * The Custom Option Book's own payoff per unit of notional at a performance level: each leg's units times its put or call
 * payoff at expiry, summed. A call is a real call, with no futures leg. Levels are the typed Level %, so a leg pays exactly 0 at its own level.
 */
export function customBookReturn(legs: CustomLeg[], performance: number): number {
  const s = 1 + performance;
  return legs.reduce((acc, leg) => {
    const k = leg.percent / 100;
    return acc + legUnits(leg) * (leg.optionType === "C" ? Math.max(s - k, 0) : Math.max(k - s, 0));
  }, 0);
}

/** Excel ROUNDUP(x, -2) for a positive step such as 100. */
function roundUpTo(x: number, step: number): number {
  if (!(step > 0)) return x;
  const q = x / step;
  const r = Math.round(q);
  // Tolerate float noise so an exact multiple is not pushed to the next step.
  return (Math.abs(q - r) < 1e-9 ? r : Math.ceil(q)) * step;
}

// Pricer!B5 = ROUNDUP('Summary Sheet'!D3 * (1 + uplift), -2)
export function startLevel(inputs: Pick<HedgeInputs, "spot" | "startLevelUplift" | "startLevelRounding">): number {
  return roundUpTo(inputs.spot * (1 + inputs.startLevelUplift), inputs.startLevelRounding);
}

export function spreadCount(inputs: Pick<HedgeInputs, "strikePercents">): number {
  return inputs.strikePercents.length - 4;
}

export type DerivedTerms = {
  nSpreads: number;
  /** Bottom spread first: spread 1 runs from strike n+1 to strike n. */
  spreads: SpreadInput[];
  /** Summary C10: the top spread sell level. */
  target: number;
  /** Summary M10. */
  protection: number;
  /** Pricer AH17 = Z17 − 1: the outflow step below protection. */
  outflowWidth: number;
  /** Pricer AP17: the decay floor strike. */
  floorLevel: number;
  /** Which participations were derived rather than typed. */
  participationDerived: boolean[];
};

/** Every product term the strikes imply. */
export function deriveTerms(inputs: Pick<HedgeInputs, "strikePercents" | "participations" | "coupon">): DerivedTerms {
  const k = inputs.strikePercents;
  const n = Math.max(0, k.length - 4);
  const raw: Array<{ buy: number; sell: number }> = [];
  for (let j = 0; j < n; j++) {
    // Summary G10, H10 and I10, J10: spread j runs from strike (n − j) up to strike (n − j − 1).
    raw.push({ buy: k[n - j]! / 100 - 1, sell: k[n - j - 1]! / 100 - 1 });
  }
  const participationDerived = raw.map((_, j) => j === n - 1 && inputs.participations[j] == null);
  const parts = raw.map((_, j) => inputs.participations[j] ?? 1);
  if (n > 0 && inputs.participations[n - 1] == null) {
    // Summary L10 = (D10 − (H10 − G10) × K10) ÷ (J10 − I10): the top spread takes what is left of the coupon.
    let others = 0;
    for (let j = 0; j < n - 1; j++) others += (raw[j]!.sell - raw[j]!.buy) * parts[j]!;
    const width = raw[n - 1]!.sell - raw[n - 1]!.buy;
    parts[n - 1] = width > 0 ? (inputs.coupon - others) / width : NaN;
  }
  return {
    nSpreads: n,
    spreads: raw.map((s, j) => ({ ...s, participation: parts[j]! })),
    target: (k[0] ?? NaN) / 100 - 1,
    protection: 1 - (k[n + 1] ?? NaN) / 100,
    outflowWidth: ((k[n + 1] ?? NaN) - (k[n + 2] ?? NaN)) / 100,
    floorLevel: (k[n + 3] ?? NaN) / 100,
    participationDerived,
  };
}

function strikeRoles(nSpreads: number, index: number): StrikeRole[] {
  if (index <= nSpreads) return ["spread"];
  if (index === nSpreads + 1) return ["protection"];
  if (index === nSpreads + 2) return ["outflow"];
  return ["floor"];
}

// Pricer!B19 = ROUND($B$5 × B17%, 0)
export function rupeeStrike(start: number, percent: number): number {
  return Math.round((start * percent) / 100);
}

/** Strike % from a typed rupee Strike Level, to 4 decimals; the % stays the source of truth. */
export function percentFromLevel(level: number, start: number): number {
  return Math.round((level / start) * 100 * 1e4) / 1e4;
}

/**
 * Units per strike: the change in the payoff's slope across it, from the strike levels given by `level`.
 * Spread j sells u at its Sell Level strike and buys u at its Buy Level strike, u = payout × start ÷ width.
 */
function unitsAt(inputs: Pick<HedgeInputs, "strikePercents" | "participations" | "coupon" | "decay" | "floorUnits">, start: number, level: (i: number) => number): number[] {
  const terms = deriveTerms(inputs);
  const n = terms.nSpreads;
  const units = inputs.strikePercents.map(() => 0);
  // Pricer C13 and C14: the payout of each spread. Row 47: payout × start ÷ rupee width.
  terms.spreads.forEach((s, j) => {
    const sell = n - j - 1;
    const buy = n - j;
    const u = ((s.sell - s.buy) * s.participation * start) / (level(sell) - level(buy));
    units[sell]! -= u;
    units[buy]! += u;
  });
  // Pricer Z47 = −E14 × B5 ÷ (Z19 − AH19) − E12, with E14 = protection × decay: the slope across the outflow step.
  const outflowSlope = (terms.protection * inputs.decay * start) / (level(n + 1) - level(n + 2)) + inputs.decay;
  units[n + 1]! -= outflowSlope;
  units[n + 2]! += outflowSlope - inputs.decay;
  // Below the floor the slope is decay less the floor units: 1.60 − 1.00 = 0.60.
  units[n + 3]! += inputs.decay - (inputs.decay - inputs.floorUnits);
  return units;
}

/** Pricer row 47: units per strike at the rounded rupee strikes, negative where the book sells. */
export function strikeUnits(inputs: Pick<HedgeInputs, "strikePercents" | "participations" | "coupon" | "decay" | "floorUnits">, start: number): number[] {
  return unitsAt(inputs, start, (i) => rupeeStrike(start, inputs.strikePercents[i]!));
}

/** The side each strike must take for the book to give the payoff: Sell where units are negative, Buy where positive. */
export function derivedSides(inputs: Pick<HedgeInputs, "strikePercents" | "participations" | "coupon" | "decay" | "floorUnits">): StrikeSide[] {
  return unitsAt(inputs, 100, (i) => inputs.strikePercents[i]!).map((u) => (u < 0 ? "S" : "B"));
}

/**
 * The option book, one leg per strike, using the rounded rupee strikes as the Pricer row 47 does.
 * Each strike takes its own option type; a call strike carries a futures leg, so it replicates the put's payoff.
 * A Custom Option Book has one slot per leg, its units the signed quantity and its type the leg's own.
 */
export function buildStrikes(inputs: HedgeInputs, start: number): StrikeSlot[] {
  if (isCustomBook(inputs)) {
    return (inputs.customLegs ?? []).map((leg) => ({
      percent: leg.percent,
      strike: rupeeStrike(start, leg.percent),
      roles: ["leg"],
      units: legUnits(leg),
      optionType: leg.optionType,
      side: leg.side,
    }));
  }
  const n = deriveTerms(inputs).nSpreads;
  const kOf = (i: number) => rupeeStrike(start, inputs.strikePercents[i]!);
  const units = strikeUnits(inputs, start);
  return inputs.strikePercents.map((pct, i) => ({
    percent: pct,
    strike: kOf(i),
    roles: strikeRoles(n, i),
    units: units[i]!,
    optionType: inputs.strikeOptionTypes?.[i] === "C" ? "C" : "P",
    side: units[i]! < 0 ? "S" : "B",
  }));
}

/** The spreads' payouts, paid in cash at maturity on top of the option book. */
export function upsideCash(terms: DerivedTerms): number {
  return terms.spreads.reduce((acc, s) => acc + (s.sell - s.buy) * s.participation, 0);
}

/**
 * A Custom Option Book's checks: 1 to 10 legs, each with a Level % above zero, a Put or Call, a Buy or Sell and a quantity
 * above zero. None of the product rules apply: any order, a repeated level and any mix of sides price as typed.
 */
export function validateCustomBook(inputs: Pick<HedgeInputs, "customLegs">): ValidationIssue[] {
  const legs = inputs.customLegs ?? [];
  const errors: ValidationIssue[] = [];
  if (legs.length < MIN_LEGS || legs.length > MAX_LEGS) {
    errors.push({
      field: "legCount",
      code: "leg-count",
      message: `The book has ${legs.length} legs. A Custom Option Book needs ${MIN_LEGS} to ${MAX_LEGS} legs.`,
      fix: `Use the Number Of Legs stepper to pick a count from ${MIN_LEGS} to ${MAX_LEGS}.`,
    });
    return errors;
  }
  legs.forEach((leg, i) => {
    const name = `Leg ${i + 1}`;
    if (!(Number.isFinite(leg.percent) && leg.percent > 0)) {
      errors.push({
        field: `customLegs.${i}.percent`,
        code: "leg-level",
        message: `${name} Level % is ${Number.isFinite(leg.percent) ? leg.percent : "blank"}. Every leg needs a level above zero.`,
        fix: `Enter ${name} as a % of the start level, such as 100.`,
      });
    }
    if (leg.optionType !== "P" && leg.optionType !== "C") {
      errors.push({ field: `customLegs.${i}.optionType`, code: "leg-type", message: `${name} has no Option Type.`, fix: `Pick Put or Call for ${name}.` });
    }
    if (leg.side !== "B" && leg.side !== "S") {
      errors.push({ field: `customLegs.${i}.side`, code: "leg-side", message: `${name} has no Buy Or Sell.`, fix: `Pick Buy or Sell for ${name}.` });
    }
    if (!(Number.isFinite(leg.quantity) && leg.quantity > 0)) {
      errors.push({
        field: `customLegs.${i}.quantity`,
        code: "leg-quantity",
        message: `${name} Quantity is ${Number.isFinite(leg.quantity) ? leg.quantity : "blank"}. Every leg needs a quantity above zero; Buy Or Sell gives the sign.`,
        fix: `Enter a quantity above zero for ${name}, such as 1.`,
      });
    }
  });
  return errors;
}

/** Edge cases that block pricing. Each carries a code and a fix for the popup. */
export function validateStructure(inputs: HedgeInputs): ValidationIssue[] {
  if (isCustomBook(inputs)) return validateCustomBook(inputs);
  const errors: ValidationIssue[] = [];
  const k = inputs.strikePercents;
  const n = k.length - 4;
  if (n < MIN_SPREADS || n > MAX_SPREADS) {
    errors.push({
      field: "spreads",
      code: "spread-count",
      message: `There are ${k.length} strikes. The product needs ${MIN_SPREADS + 4} to ${MAX_SPREADS + 4} strikes, which is ${MIN_SPREADS} to ${MAX_SPREADS} spreads.`,
      fix: `Use the Number Of Spreads stepper to pick a count from ${MIN_SPREADS} to ${MAX_SPREADS}.`,
    });
    return errors;
  }
  k.forEach((v, i) => {
    if (!(Number.isFinite(v) && v > 0)) {
      errors.push({
        field: `strikes.${i}`,
        code: "strike-positive",
        message: `Strike ${i + 1} is ${Number.isFinite(v) ? v : "blank"}. Every strike must be above zero.`,
        fix: `Enter Strike ${i + 1} as a % of the start level, such as 85.`,
      });
    }
  });
  for (let i = 1; i < k.length; i++) {
    if (Number.isFinite(k[i]) && Number.isFinite(k[i - 1]) && !(k[i]! < k[i - 1]!)) {
      errors.push({
        field: `strikes.${i}`,
        code: "strike-order",
        message: `Strike ${i + 1} at ${k[i]}% is not below Strike ${i} at ${k[i - 1]}%. Strikes must be strictly descending.`,
        fix: `Lower Strike ${i + 1} or raise Strike ${i} so each strike sits below the one before it.`,
      });
    }
  }
  if (errors.length) return errors;

  // Strictly descending strikes put every Sell Level above its Buy Level and the floor below the outflow strike.
  const terms = deriveTerms(inputs);
  terms.spreads.forEach((s, j) => {
    if (!(s.participation > 0)) {
      if (j === terms.nSpreads - 1 && terms.participationDerived[j]) {
        const lower = terms.spreads.slice(0, j).reduce((a, x) => a + (x.sell - x.buy) * x.participation, 0);
        errors.push({
          field: "coupon",
          code: "coupon-unreachable",
          message: `The lower spreads already pay ${(lower * 100).toFixed(2)}%, so the Coupon of ${(inputs.coupon * 100).toFixed(2)}% cannot be reached with a top spread participation above zero.`,
          fix: "Raise the Coupon, or lower the participation of the lower spreads.",
        });
      } else {
        errors.push({
          field: `spreads.${j}`,
          code: "participation",
          message: `Spread ${j + 1} has a Participation Rate of ${Number.isFinite(s.participation) ? s.participation.toFixed(2) : "blank"}. It must be above zero.`,
          fix: `Enter a Participation Rate above zero for Spread ${j + 1}.`,
        });
      }
    }
  });
  const reach = terms.spreads.reduce((a, s) => a + (s.sell - s.buy) * s.participation, 0);
  if (Number.isFinite(reach) && reach > inputs.coupon + 1e-9 && !terms.participationDerived[terms.nSpreads - 1]) {
    errors.push({
      field: `participations.${terms.nSpreads - 1}`,
      code: "coupon-exceeded",
      message: `The Spreads Pay ${(reach * 100).toFixed(2)}%, Above The Coupon Of ${(inputs.coupon * 100).toFixed(2)}%`,
      fix: "Reset the top spread participation to derived, or lower it.",
    });
  }
  if (Number.isFinite(reach) && reach < inputs.coupon - 1e-9) {
    errors.push({
      field: "coupon",
      code: "coupon-unreachable",
      message: `The spreads pay at most ${(reach * 100).toFixed(2)}%, so the Coupon of ${(inputs.coupon * 100).toFixed(2)}% cannot be reached.`,
      fix: "Reset the top spread participation to derived, raise a participation, or lower the Coupon.",
    });
  }
  if (!(terms.protection >= 0 && terms.protection < 1)) {
    errors.push({
      field: "protection",
      code: "protection",
      message: `The protection strike at ${k[n + 1]}% must sit at or below 100% of the start level.`,
      fix: "Set Protection from 0%, for no protection, up to below 100%, such as 15%.",
    });
  }
  if (!errors.length) {
    derivedSides(inputs).forEach((want, i) => {
      const chosen = inputs.strikeSides?.[i];
      if (chosen && chosen !== want) {
        errors.push({
          field: `strikeSides.${i}`,
          code: "strike-side",
          message: `This Strike Must Be A ${want === "B" ? "Buy" : "Sell"} To Give The Product Payoff`,
          fix: `Set Strike ${i + 1} to ${want === "B" ? "Buy" : "Sell"}.`,
        });
      }
    });
  }
  if (inputs.floorUnits > inputs.decay) {
    errors.push({
      field: "floorUnits",
      code: "floor-units",
      message: `A Decay Reduction Below Floor of ${inputs.floorUnits} exceeds the Decay of ${inputs.decay}, which would turn the payoff upward below the floor.`,
      fix: "Keep the Decay Reduction Below Floor at or below the Decay.",
    });
  }
  return errors;
}

/**
 * Client return at a performance level. Product Description column K with each constant
 * taken from the inputs: upside capped at the coupon, zero to the protection, then decay with the floor.
 * A Custom Option Book returns its own payoff instead.
 */
export function clientReturn(inputs: HedgeInputs, performance: number): number {
  if (isCustomBook(inputs)) return customBookReturn(inputs.customLegs ?? [], performance);
  const terms = deriveTerms(inputs);
  const p = performance;
  if (p >= -terms.protection) {
    let up = 0;
    for (const s of terms.spreads) up += s.participation * Math.min(Math.max(p - s.buy, 0), s.sell - s.buy);
    return Math.min(inputs.coupon, up);
  }
  if (p >= -0.9) {
    const floorPerf = terms.floorLevel - 1;
    const extra = inputs.decay - inputs.floorUnits;
    return Math.max(-1, Math.max(floorPerf * inputs.decay, p * inputs.decay) + Math.min(0, (p - floorPerf) * extra));
  }
  return p;
}

/** Client return implied by the option book: the spreads' cash plus every leg at expiry, a call strike with its futures leg. */
export function bookReturn(inputs: HedgeInputs, strikes: StrikeSlot[], start: number, performance: number): number {
  const s = 1 + performance;
  const cash = upsideCash(deriveTerms(inputs));
  return (
    cash +
    strikes.reduce((acc, slot) => {
      const k = slot.strike / start;
      return acc + slot.units * (slot.optionType === "P" ? Math.max(k - s, 0) : Math.max(s - k, 0) + (k - s));
    }, 0)
  );
}

/**
 * Largest gap between the payoff table and the option book at every kink and between kinks,
 * skipping the one point outflow band where the book spreads the protection drop.
 * A Custom Option Book's payoff is the book itself, so there is no gap.
 */
export function payoffBookGap(inputs: HedgeInputs, strikes: StrikeSlot[], start: number): number {
  if (isCustomBook(inputs)) return 0;
  const terms = deriveTerms(inputs);
  const points = new Set<number>();
  for (const k of strikes) {
    const p = k.strike / start - 1;
    points.add(p);
    points.add(p + 0.005);
    points.add(p - 0.005);
  }
  for (let p = -0.89; p <= terms.target + 0.2; p += 0.01) points.add(Math.round(p * 1e6) / 1e6);
  const lo = -terms.protection - terms.outflowWidth;
  const hi = -terms.protection;
  let gap = 0;
  for (const p of points) {
    if (p > lo - 1e-9 && p < hi) continue;
    gap = Math.max(gap, Math.abs(bookReturn(inputs, strikes, start, p) - clientReturn(inputs, p)));
  }
  return gap;
}

// Product Description L32 = RATE(D41 ÷ 365, 0, −1, 1 + K32)
export function preTaxIrr(clientReturnValue: number, tenorDays: number): number {
  const fv = 1 + clientReturnValue;
  if (fv <= 0) return -1;
  return fv ** (365 / tenorDays) - 1;
}

/**
 * Payoff levels: every strike, protection, protection less 0.01, zero, and every 5 percent.
 * A Custom Option Book: every leg level, zero, and every 5 percent from -50% or 10 points below the lowest leg, to +50% or
 * 10 points above the highest.
 */
export function payoffLevels(inputs: HedgeInputs, strikes: StrikeSlot[]): number[] {
  const set = new Set<number>();
  const key = (x: number) => Math.round(x * 1e6) / 1e6;
  if (isCustomBook(inputs)) {
    const levels = strikes.map((s) => s.percent / 100 - 1);
    for (const x of levels) set.add(key(x));
    set.add(0);
    const lo = Math.ceil(Math.min(-0.5, Math.min(...levels) - 0.1) * 20 - 1e-9);
    const hi = Math.floor(Math.max(0.5, Math.max(...levels) + 0.1) * 20 + 1e-9);
    for (let j = lo; j <= hi; j++) set.add(key(j / 20));
    return [...set].sort((a, b) => b - a);
  }
  const terms = deriveTerms(inputs);
  for (const s of strikes) set.add(key(s.percent / 100 - 1));
  set.add(key(-terms.protection));
  set.add(key(-terms.protection - 0.0001));
  set.add(0);
  const top = Math.max(...strikes.map((s) => s.percent / 100 - 1)) + 0.1;
  for (let x = -0.5; x <= top + 1e-9; x += 0.05) set.add(key(x));
  return [...set].sort((a, b) => b - a);
}
