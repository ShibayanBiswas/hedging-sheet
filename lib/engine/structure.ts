import type { HedgeInputs, SpreadInput, StrikeRole, StrikeSlot, ValidationIssue } from "@/lib/engine/types";

/** Excel ROUNDUP(x, -digits) for a positive step such as 100. */
export function roundUpTo(x: number, step: number): number {
  if (!(step > 0)) return x;
  const q = x / step;
  const r = Math.round(q);
  // Tolerate float noise so an exact multiple is not pushed to the next step.
  return (Math.abs(q - r) < 1e-9 ? r : Math.ceil(q)) * step;
}

export function startLevel(inputs: Pick<HedgeInputs, "spot" | "startLevelUplift" | "startLevelRounding">): number {
  return roundUpTo(inputs.spot * (1 + inputs.startLevelUplift), inputs.startLevelRounding);
}

function cleanPercent(x: number): number {
  return Math.round(x * 1e9) / 1e9;
}

/** Each spread's participation, with the last one tied to the coupon when auto is on. */
export function resolveParticipations(
  inputs: Pick<HedgeInputs, "spreads" | "autoParticipation" | "coupon">,
): number[] {
  const spreads = inputs.spreads;
  const parts = spreads.map((s) => s.participation);
  if (inputs.autoParticipation && spreads.length) {
    const last = spreads.length - 1;
    let others = 0;
    for (let i = 0; i < last; i++) others += (spreads[i]!.sell - spreads[i]!.buy) * spreads[i]!.participation;
    const width = spreads[last]!.sell - spreads[last]!.buy;
    parts[last] = width > 0 ? (inputs.coupon - others) / width : 0;
  }
  return parts;
}

/** Spreads with the last sell level linked to the Target. */
export function effectiveSpreads(inputs: Pick<HedgeInputs, "spreads" | "target">): SpreadInput[] {
  return inputs.spreads.map((s, i, all) => (i === all.length - 1 ? { ...s, sell: inputs.target } : s));
}

export type StructureLevels = {
  percents: number[];
  roles: Map<number, StrikeRole[]>;
};

/** Strike percents, highest first: spread levels, protection, protection minus the outflow width, floor. */
export function strikeLevels(inputs: HedgeInputs): StructureLevels {
  const roles = new Map<number, StrikeRole[]>();
  const add = (pct: number, role: StrikeRole) => {
    const key = cleanPercent(pct);
    const list = roles.get(key) ?? [];
    if (!list.includes(role)) list.push(role);
    roles.set(key, list);
  };
  for (const s of effectiveSpreads(inputs)) {
    add(100 * (1 + s.buy), "spread");
    add(100 * (1 + s.sell), "spread");
  }
  const protectionPct = 100 * (1 - inputs.protection);
  add(protectionPct, "protection");
  add(protectionPct - 100 * inputs.outflowWidth, "outflow");
  add(100 * inputs.floorLevel, "floor");
  const percents = [...roles.keys()].sort((a, b) => b - a);
  return { percents, roles };
}

export function rupeeStrike(start: number, percent: number): number {
  return Math.round((start * percent) / 100);
}

/**
 * Units at each strike: slope of the put book just above the strike minus the slope just below.
 * Slopes use the rounded rupee strikes, as the worksheet does.
 */
export function buildStrikes(inputs: HedgeInputs, start: number, participations: number[]): StrikeSlot[] {
  const { percents, roles } = strikeLevels(inputs);
  const spreads = effectiveSpreads(inputs);
  const kOf = (pct: number) => rupeeStrike(start, cleanPercent(pct));
  const protectionPct = cleanPercent(100 * (1 - inputs.protection));
  const outflowPct = cleanPercent(protectionPct - 100 * inputs.outflowWidth);
  const floorPct = cleanPercent(100 * inputs.floorLevel);

  /** Slope of the book on the open interval just below `pct` (exclusive) and above the next strike. */
  const slopeBelow = (pct: number): number => {
    let slope = 0;
    spreads.forEach((s, j) => {
      const buyPct = cleanPercent(100 * (1 + s.buy));
      const sellPct = cleanPercent(100 * (1 + s.sell));
      if (pct <= sellPct && pct > buyPct) {
        const payout = (s.sell - s.buy) * participations[j]!;
        slope += (payout * start) / (kOf(sellPct) - kOf(buyPct));
      }
    });
    if (pct <= protectionPct && pct > outflowPct) {
      const loss = inputs.protection * inputs.decay;
      slope += (loss * start) / (kOf(protectionPct) - kOf(outflowPct)) + inputs.decay;
    } else if (pct <= outflowPct && pct > floorPct) {
      slope += inputs.decay;
    } else if (pct <= floorPct) {
      slope += inputs.decay - inputs.floorUnits;
    }
    return slope;
  };

  return percents.map((pct, i) => {
    const above = i === 0 ? 0 : slopeBelow(percents[i - 1]!);
    const below = slopeBelow(pct);
    return {
      percent: pct,
      strike: kOf(pct),
      roles: roles.get(pct) ?? [],
      units: above - below,
    };
  });
}

export function validateStructure(inputs: HedgeInputs, strikeCount: number): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const spreads = effectiveSpreads(inputs);
  if (!spreads.length) errors.push({ field: "spreads", message: "Add at least one spread." });
  spreads.forEach((s, i) => {
    if (!(s.sell > s.buy)) {
      errors.push({ field: `spreads.${i}`, message: `Spread ${i + 1} Sell Level must be above its Buy Level.` });
    }
    if (!(s.buy >= 0)) errors.push({ field: `spreads.${i}`, message: `Spread ${i + 1} Buy Level must be zero or above.` });
    if (i > 0 && s.buy < spreads[i - 1]!.sell - 1e-12) {
      errors.push({ field: `spreads.${i}`, message: `Spread ${i + 1} must start at or above the Sell Level of Spread ${i}.` });
    }
  });
  if (!(inputs.protection > 0 && inputs.protection < 1)) {
    errors.push({ field: "protection", message: "Protection must be between 0 and 100 percent." });
  }
  if (!(inputs.outflowWidth > 0)) errors.push({ field: "outflowWidth", message: "The outflow width must be above zero." });
  const outflow = 1 - inputs.protection - inputs.outflowWidth;
  if (!(inputs.floorLevel > 0 && inputs.floorLevel < outflow)) {
    errors.push({ field: "floorLevel", message: "The Decay Floor Level must sit below the protection outflow strike." });
  }
  if (!(inputs.decay > 0)) errors.push({ field: "decay", message: "Decay must be above zero." });
  if (strikeCount !== inputs.expiryCount) {
    errors.push({
      field: "strikes",
      message: `The Number Of Strikes is ${strikeCount} but the Number Of Expiry Dates is ${inputs.expiryCount}. The two counts must be equal before the book can be priced.`,
    });
  }
  return errors;
}

/**
 * Client return at a performance level. The worksheet formula with each constant taken from the inputs:
 * upside from the spreads capped at the coupon, zero down to the protection, then decay with the floor.
 */
export function clientReturn(inputs: HedgeInputs, participations: number[], performance: number): number {
  const p = performance;
  if (p >= -inputs.protection) {
    let up = 0;
    effectiveSpreads(inputs).forEach((s, j) => {
      up += participations[j]! * Math.min(Math.max(p - s.buy, 0), s.sell - s.buy);
    });
    return Math.min(inputs.coupon, up);
  }
  if (p >= -0.9) {
    const floorPerf = inputs.floorLevel - 1;
    const extra = inputs.decay - inputs.floorUnits;
    return Math.max(-1, Math.max(floorPerf * inputs.decay, p * inputs.decay) + Math.min(0, (p - floorPerf) * extra));
  }
  return p;
}

/** Excel RATE(n, 0, -1, fv): (fv)^(1/n) − 1. */
export function preTaxIrr(clientReturnValue: number, tenorDays: number): number {
  const fv = 1 + clientReturnValue;
  if (fv <= 0) return -1;
  return fv ** (365 / tenorDays) - 1;
}

/** Payoff levels: every strike, protection, protection less 0.01, zero, and roughly every 5 percent. */
export function payoffLevels(inputs: HedgeInputs, strikes: StrikeSlot[]): number[] {
  const set = new Set<number>();
  const key = (x: number) => Math.round(x * 1e6) / 1e6;
  for (const s of strikes) set.add(key(s.percent / 100 - 1));
  set.add(key(-inputs.protection));
  set.add(key(-inputs.protection - 0.0001));
  set.add(0);
  const top = Math.max(...strikes.map((s) => s.percent / 100 - 1)) + 0.1;
  for (let x = -0.5; x <= top + 1e-9; x += 0.05) set.add(key(x));
  return [...set].sort((a, b) => b - a);
}

export function payoffDescription(inputs: HedgeInputs, performance: number, value: number): string {
  if (value >= inputs.coupon - 1e-12) return "Maximum Coupon";
  if (value > 1e-12) return "Accelerated Upside";
  if (performance >= -inputs.protection) return "Capital Protected";
  if (performance < inputs.floorLevel - 1) return "Loss Beyond Decay Floor";
  return "Loss With Decay";
}
