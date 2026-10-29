import { deriveTerms, derivedSides, MAX_SPREADS, MIN_SPREADS, spreadCount } from "@/lib/engine/structure";
import type { InputMode, DeskInputs } from "@/lib/inputs/draft";

type StrikeEdit = Pick<DeskInputs, "strikePercents" | "participations" | "strikeOptionTypes" | "strikeSides">;
type Terms = Pick<DeskInputs, "coupon" | "decay" | "floorUnits">;

/** In Default Values the sides follow the payoff after a structural edit; in Blank Inputs a new strike waits for a choice. */
function withSides(next: StrikeEdit, inputs: Terms, mode: InputMode): StrikeEdit {
  if (mode === "blank") return next;
  const all = [...next.strikePercents, ...next.participations.filter((p) => p != null), inputs.coupon, inputs.decay, inputs.floorUnits];
  if (!all.every(Number.isFinite)) return next;
  return { ...next, strikeSides: derivedSides({ ...inputs, strikePercents: next.strikePercents, participations: next.participations }) };
}

/**
 * A strike between the target and the protection strike adds a spread: it splits the spread it falls in, keeping its
 * participation on both sides so the payoff is unchanged, or adds a spread on top or at the bottom with a participation of 1.
 * Null when the level is not finite, sits at or below the protection strike, repeats a strike, or there are already four spreads.
 */
export function insertStrike(inputs: StrikeEdit & Terms, percent: number, mode: InputMode): StrikeEdit | null {
  const k = inputs.strikePercents;
  const n = spreadCount(inputs);
  if (!Number.isFinite(percent) || n >= MAX_SPREADS || k.includes(percent)) return null;
  const protection = k[n + 1]!;
  if (!(percent > protection)) return null;
  const at = k.findIndex((v) => percent > v);
  const strikes = [...k.slice(0, at), percent, ...k.slice(at)];
  const parts = [...inputs.participations];
  // Spread j runs from strike n − j up to strike n − j − 1, bottom spread first.
  if (at === 0) {
    // A new top: the old top keeps its derived rate as a typed 1, and the new top is derived.
    parts[n - 1] = parts[n - 1] ?? 1;
    parts.push(null);
  } else if (at === n + 1) {
    parts.unshift(1);
  } else {
    // Both pieces keep the rate; a derived top keeps deriving on the upper piece and pins today's value on the lower.
    const split = n - at;
    const current = parts[split] ?? deriveTerms(inputs).spreads[split]?.participation ?? 1;
    parts.splice(split, 0, current);
  }
  const type = mode === "blank" ? "" : "P";
  const next: StrikeEdit = {
    strikePercents: strikes,
    participations: parts,
    strikeOptionTypes: [...inputs.strikeOptionTypes.slice(0, at), type, ...inputs.strikeOptionTypes.slice(at)],
    strikeSides: [...inputs.strikeSides.slice(0, at), "", ...inputs.strikeSides.slice(at)],
  };
  return withSides(next, inputs, mode);
}

/** Whether strike i can go: only a spread level, and only while more than one spread remains. */
export function canRemoveStrike(inputs: Pick<DeskInputs, "strikePercents">, i: number): boolean {
  return i <= spreadCount(inputs) && spreadCount(inputs) > MIN_SPREADS;
}

/**
 * Removing a spread level joins the two spreads it separates, keeping the upper one's participation, or drops the top or
 * bottom spread. The top spread is derived again.
 */
export function removeStrike(inputs: StrikeEdit & Terms, i: number, mode: InputMode): StrikeEdit | null {
  if (!canRemoveStrike(inputs, i)) return null;
  const n = spreadCount(inputs);
  const parts = [...inputs.participations];
  if (i === 0) parts.pop();
  else if (i === n) parts.shift();
  else parts.splice(n - i - 1, 1);
  parts[parts.length - 1] = null;
  const next: StrikeEdit = {
    strikePercents: inputs.strikePercents.filter((_, j) => j !== i),
    participations: parts,
    strikeOptionTypes: inputs.strikeOptionTypes.filter((_, j) => j !== i),
    strikeSides: inputs.strikeSides.filter((_, j) => j !== i),
  };
  return withSides(next, inputs, mode);
}
