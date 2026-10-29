/**
 * An independent check of the engine: a second normal distribution (Hart, as given by West 2005, not the
 * engine's Cody erfc), the Black formula written from the textbook, and the product payoff written from the
 * term sheet. Nothing here imports the engine's pricing or payoff code.
 */
import type { HedgeInputs, HedgingResult, OptionType } from "@/lib/engine/types";

export function hartNormal(x: number): number {
  const z = Math.abs(x);
  let c = 0;
  if (z <= 37) {
    const e = Math.exp((-z * z) / 2);
    if (z < 7.07106781186547) {
      let n = 3.52624965998911e-2 * z + 0.700383064443688;
      n = n * z + 6.37396220353165;
      n = n * z + 33.912866078383;
      n = n * z + 112.079291497871;
      n = n * z + 221.213596169931;
      n = n * z + 220.206867912376;
      let d = 8.83883476483184e-2 * z + 1.75566716318264;
      d = d * z + 16.064177579207;
      d = d * z + 86.7807322029461;
      d = d * z + 296.564248779674;
      d = d * z + 637.333633378831;
      d = d * z + 793.826512519948;
      d = d * z + 440.413735824752;
      c = (e * n) / d;
    } else {
      let b = z + 0.65;
      b = z + 4 / b;
      b = z + 3 / b;
      b = z + 2 / b;
      b = z + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

/** Black 1976 on a forward, discounted: the textbook form. */
export function black(forward: number, strike: number, years: number, vol: number, discount: number, type: OptionType): number {
  const sd = vol * Math.sqrt(years);
  const d1 = Math.log(forward / strike) / sd + sd / 2;
  const d2 = d1 - sd;
  const df = Math.exp(-discount * years);
  return type === "C" ? df * (forward * hartNormal(d1) - strike * hartNormal(d2)) : df * (strike * hartNormal(-d2) - forward * hartNormal(-d1));
}

/** The term sheet payoff as a fraction of notional, from the inputs alone. */
export function termSheetPayoff(inputs: HedgeInputs, performance: number): number {
  const k = inputs.strikePercents.map((x) => x / 100);
  const n = k.length - 4;
  const levels = k.slice(0, n + 1).reverse();
  const widths = levels.slice(1).map((sell, j) => sell - levels[j]!);
  const parts = widths.map((_, j) => inputs.participations[j] ?? 1);
  if (inputs.participations[n - 1] == null) {
    const lower = widths.slice(0, -1).reduce((s, w, j) => s + w * parts[j]!, 0);
    parts[n - 1] = (inputs.coupon - lower) / widths[n - 1]!;
  }
  const level = 1 + performance;
  const protectionStrike = k[n + 1]!;
  const floorStrike = k[n + 3]!;
  if (level >= protectionStrike) {
    const upside = widths.reduce((s, w, j) => s + parts[j]! * Math.min(Math.max(level - levels[j]!, 0), w), 0);
    return Math.min(inputs.coupon, upside);
  }
  if (level >= floorStrike) return inputs.decay * performance;
  return inputs.decay * (floorStrike - 1) + (inputs.decay - inputs.floorUnits) * (level - floorStrike);
}

/** The option book at expiry, from the priced legs: spreads' cash plus each strike's payoff, a call with its futures leg. */
export function bookPayoff(r: HedgingResult, performance: number): number {
  const start = r.structure.startLevel;
  const level = 1 + performance;
  const k = r.inputs.strikePercents.map((x) => x / 100);
  const n = k.length - 4;
  const levels = k.slice(0, n + 1).reverse();
  const cash = r.structure.spreadParticipations.reduce((s, p, j) => s + p * (levels[j + 1]! - levels[j]!), 0);
  const firstExpiry = r.pricer.legs.filter((l) => l.expiryIndex === 0);
  return (
    cash +
    firstExpiry.reduce((s, l) => {
      const strike = l.strike / start;
      const payoff = l.optionType === "P" ? Math.max(strike - level, 0) : Math.max(level - strike, 0) - (level - strike);
      return s + l.units * payoff;
    }, 0)
  );
}

/** 30 performance levels across the payoff, skipping the one point band where the book steps down at protection. */
export function thirtyLevels(inputs: HedgeInputs): number[] {
  const k = inputs.strikePercents.map((x) => x / 100);
  const n = k.length - 4;
  const lo = k[n + 2]! - 1;
  const hi = k[n + 1]! - 1;
  const top = k[0]! - 1 + 0.15;
  const out: number[] = [];
  for (let i = 0; out.length < 30; i++) {
    const p = -0.6 + ((top + 0.6) * i) / 33;
    if (p > lo - 1e-9 && p < hi + 1e-9) continue;
    out.push(p);
  }
  return out;
}

/** Every number in an object tree, with its path. */
export function numbersIn(value: unknown, path = "result", out: Array<[string, number]> = []): Array<[string, number]> {
  if (typeof value === "number") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => numbersIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) numbersIn(v, `${path}.${k}`, out);
  return out;
}
