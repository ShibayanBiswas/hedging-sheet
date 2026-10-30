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

/**
 * The Number Of Spreads drives the strikes: n spreads make n + 4 strikes. With every strike filled, new spreads go on
 * top of the target five points apart and fewer drop the top ones, so the payoff below stays put. Otherwise empty rows
 * are added or dropped at the top.
 */
export function setSpreadCount(inputs: StrikeEdit & Terms, count: number, mode: InputMode): StrikeEdit {
  const n = spreadCount(inputs);
  const filled = inputs.strikePercents.length > 0 && inputs.strikePercents.every(Number.isFinite);
  if (filled) {
    let next: StrikeEdit & Terms = inputs;
    while (spreadCount(next) < count) {
      const added = insertStrike(next, next.strikePercents[0]! + 5, mode);
      if (!added) break;
      next = { ...next, ...added };
    }
    while (spreadCount(next) > count) {
      const removed = removeStrike(next, 0, mode);
      if (!removed) break;
      next = { ...next, ...removed };
    }
    if (spreadCount(next) === count) return pick(next);
  }
  const strikes = count + 4;
  if (inputs.strikePercents.length === 0) {
    return {
      strikePercents: Array.from({ length: strikes }, () => NaN),
      participations: [...Array.from({ length: count - 1 }, () => NaN), null],
      strikeOptionTypes: Array.from({ length: strikes }, () => (mode === "blank" ? "" : "P")),
      strikeSides: Array.from({ length: strikes }, () => ""),
    };
  }
  const extra = count - n;
  const top = <T,>(list: T[], fill: T) => (extra >= 0 ? [...Array.from({ length: extra }, () => fill), ...list] : list.slice(-extra));
  // Participations run bottom spread first; the top one is derived.
  const parts: Array<number | null> = inputs.participations.slice(0, Math.max(0, Math.min(n, count))).map((p) => p ?? NaN);
  while (parts.length < count) parts.push(NaN);
  parts[count - 1] = null;
  return {
    strikePercents: top(inputs.strikePercents, NaN),
    participations: parts,
    strikeOptionTypes: top(inputs.strikeOptionTypes, mode === "blank" ? "" : "P"),
    strikeSides: top(inputs.strikeSides, ""),
  };
}

function pick(x: StrikeEdit): StrikeEdit {
  return { strikePercents: x.strikePercents, participations: x.participations, strikeOptionTypes: x.strikeOptionTypes, strikeSides: x.strikeSides };
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
