import type { HedgeInputs, SpreadInput, StrikeRole, StrikeSlot, ValidationIssue } from "@/lib/engine/types";

export const MIN_SPREADS = 1;
export const MAX_SPREADS = 4;

/** Excel ROUNDUP(x, -2) for a positive step such as 100. */
export function roundUpTo(x: number, step: number): number {
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
    raw.push({ buy: (k[n - j] ?? NaN) / 100 - 1, sell: (k[n - j - 1] ?? NaN) / 100 - 1 });
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

export function strikeRoles(nSpreads: number, index: number): StrikeRole[] {
  if (index <= nSpreads) return ["spread"];
  if (index === nSpreads + 1) return ["protection"];
  if (index === nSpreads + 2) return ["outflow"];
  return ["floor"];
}

// Pricer!B19 = ROUND($B$5 × B17%, 0)
export function rupeeStrike(start: number, percent: number): number {
  return Math.round((start * percent) / 100);
}

/**
 * Units at each strike: slope of the book just above the strike minus the slope just below,
 * using the rounded rupee strikes as the Pricer spread row (row 47) does.
 */
export function buildStrikes(inputs: HedgeInputs, start: number): StrikeSlot[] {
  const terms = deriveTerms(inputs);
  const k = inputs.strikePercents;
  const n = terms.nSpreads;
  const kOf = (i: number) => rupeeStrike(start, k[i]!);

  /** Slope of the put book on the interval just below strike i. */
  const slopeBelow = (i: number): number => {
    if (i < n) {
      // Spread j sits between strike n − j − 1 (sell) and strike n − j (buy).
      const j = n - 1 - i;
      const s = terms.spreads[j]!;
      // Pricer C13 and C14: the payout of the spread. Row 47: payout × start ÷ rupee width.
      const payout = (s.sell - s.buy) * s.participation;
      return (payout * start) / (kOf(i) - kOf(i + 1));
    }
    if (i === n) return 0;
    if (i === n + 1) {
      // Pricer Z47 = −E14 × B5 ÷ (Z19 − AH19) − E12, with E14 = protection × decay.
      const loss = terms.protection * inputs.decay;
      return (loss * start) / (kOf(n + 1) - kOf(n + 2)) + inputs.decay;
    }
    if (i === n + 2) return inputs.decay;
    // Below the floor the slope is decay less the floor units: 1.60 − 1.00 = 0.60.
    return inputs.decay - inputs.floorUnits;
  };

  return k.map((pct, i) => {
    const above = i === 0 ? 0 : slopeBelow(i - 1);
    return {
      percent: pct,
      strike: kOf(i),
      roles: strikeRoles(n, i),
      units: above - slopeBelow(i),
    };
  });
}

/** Edge cases that block pricing. Each carries a code and a fix for the popup. */
export function validateStructure(inputs: HedgeInputs): ValidationIssue[] {
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

  const terms = deriveTerms(inputs);
  terms.spreads.forEach((s, j) => {
    if (!(s.sell > s.buy)) {
      errors.push({
        field: `spreads.${j}`,
        code: "spread-order",
        message: `Spread ${j + 1} has a Sell Level that is not above its Buy Level.`,
        fix: `Raise the Sell Level of Spread ${j + 1} above its Buy Level.`,
      });
    }
    if (j > 0 && Math.abs(s.buy - terms.spreads[j - 1]!.sell) > 1e-12) {
      errors.push({
        field: `spreads.${j}`,
        code: s.buy < terms.spreads[j - 1]!.sell ? "spread-overlap" : "spread-gap",
        message: `Spread ${j + 1} does not start where Spread ${j} ends, so the spreads ${s.buy < terms.spreads[j - 1]!.sell ? "overlap" : "leave a gap"}.`,
        fix: `Set the Buy Level of Spread ${j + 1} equal to the Sell Level of Spread ${j}.`,
      });
    }
    if (!(s.participation > 0)) {
      errors.push({
        field: `spreads.${j}`,
        code: "participation",
        message: `Spread ${j + 1} has a Participation Rate of ${Number.isFinite(s.participation) ? s.participation.toFixed(2) : "blank"}. It must be above zero.`,
        fix:
          j === terms.nSpreads - 1 && terms.participationDerived[j]
            ? "The lower spreads already pay more than the Coupon. Lower their participation or raise the Coupon."
            : `Enter a Participation Rate above zero for Spread ${j + 1}.`,
      });
    }
  });
  const reach = terms.spreads.reduce((a, s) => a + (s.sell - s.buy) * s.participation, 0);
  if (Number.isFinite(reach) && reach < inputs.coupon - 1e-9) {
    errors.push({
      field: "coupon",
      code: "coupon-unreachable",
      message: `The spreads pay at most ${(reach * 100).toFixed(2)}%, so the Coupon of ${(inputs.coupon * 100).toFixed(2)}% cannot be reached.`,
      fix: "Reset the top spread participation to derived, raise a participation, or lower the Coupon.",
    });
  }
  if (!(terms.protection > 0 && terms.protection < 1)) {
    errors.push({
      field: "protection",
      code: "protection",
      message: `The protection strike at ${k[n + 1]}% must sit below 100% of the start level.`,
      fix: "Set Protection between 0% and 100%, such as 15%.",
    });
  }
  if (!(terms.floorLevel < 1 - terms.protection - terms.outflowWidth)) {
    errors.push({
      field: "floorLevel",
      code: "floor-level",
      message: "The Decay Floor Level must sit below the protection strike less the outflow step.",
      fix: `Lower the Decay Floor Level below ${(100 * (1 - terms.protection - terms.outflowWidth)).toFixed(2)}%.`,
    });
  }
  if (inputs.floorUnits > inputs.decay) {
    errors.push({
      field: "floorUnits",
      code: "floor-units",
      message: `Floor Units of ${inputs.floorUnits} exceed the Decay of ${inputs.decay}, which would turn the payoff upward below the floor.`,
      fix: "Keep Floor Units at or below the Decay.",
    });
  }
  return errors;
}

/**
 * Client return at a performance level. Product Description column K with each constant
 * taken from the inputs: upside capped at the coupon, zero to the protection, then decay with the floor.
 */
export function clientReturn(inputs: HedgeInputs, performance: number): number {
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

/** Client return implied by the option book: maximum coupon plus the put book at expiry. */
export function bookReturn(inputs: HedgeInputs, strikes: StrikeSlot[], start: number, performance: number): number {
  const s = 1 + performance;
  return inputs.coupon + strikes.reduce((acc, k) => acc + k.units * Math.max(k.strike / start - s, 0), 0);
}

/**
 * Largest gap between the payoff table and the option book at every kink and between kinks,
 * skipping the one point outflow band where the book spreads the protection drop.
 */
export function payoffBookGap(inputs: HedgeInputs, strikes: StrikeSlot[], start: number): number {
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

/** Payoff levels: every strike, protection, protection less 0.01, zero, and every 5 percent. */
export function payoffLevels(inputs: HedgeInputs, strikes: StrikeSlot[]): number[] {
  const terms = deriveTerms(inputs);
  const set = new Set<number>();
  const key = (x: number) => Math.round(x * 1e6) / 1e6;
  for (const s of strikes) set.add(key(s.percent / 100 - 1));
  set.add(key(-terms.protection));
  set.add(key(-terms.protection - 0.0001));
  set.add(0);
  const top = Math.max(...strikes.map((s) => s.percent / 100 - 1)) + 0.1;
  for (let x = -0.5; x <= top + 1e-9; x += 0.05) set.add(key(x));
  return [...set].sort((a, b) => b - a);
}
