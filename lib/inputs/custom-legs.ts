import { MAX_LEGS, MIN_LEGS } from "@/lib/engine/structure";
import type { BookMode, CustomLeg } from "@/lib/engine/types";
import type { DeskInputs, DeskLeg, InputMode } from "@/lib/inputs/draft";

/** The leg Default Values starts a Custom Option Book with, and adds: 1 unit of the put at the start level, bought. */
const DEFAULT_LEG: CustomLeg = { percent: 100, optionType: "P", side: "B", quantity: 1 };

/** A new leg: Default Values fills it in, Blank Inputs leaves it empty. */
export function newLeg(mode: InputMode): DeskLeg {
  return mode === "blank" ? { percent: NaN, optionType: "", side: "", quantity: NaN } : { ...DEFAULT_LEG };
}

/**
 * The patch that switches the book. Each book keeps its own entries; the first switch to Custom starts it with one leg in
 * Default Values and none in Blank Inputs. Volatility overrides are keyed by strike slot, so they do not carry across.
 */
export function switchBook(prev: DeskInputs, next: BookMode, mode: InputMode): Partial<DeskInputs> {
  if ((prev.bookMode ?? "product") === next) return {};
  return {
    bookMode: next,
    customLegs: prev.customLegs ?? (mode === "blank" ? [] : [newLeg(mode)]),
    legVolOverrides: {},
  };
}

/** The Number Of Legs: earlier legs are kept, new ones go at the end. */
export function setLegCount(legs: DeskLeg[], count: number, mode: InputMode): DeskLeg[] {
  const n = Math.max(MIN_LEGS, Math.min(MAX_LEGS, count));
  return Array.from({ length: n }, (_, i) => legs[i] ?? newLeg(mode));
}

export function addLeg(legs: DeskLeg[], mode: InputMode): DeskLeg[] {
  return legs.length >= MAX_LEGS ? legs : [...legs, newLeg(mode)];
}

/** A book keeps at least one leg. */
export function removeLeg(legs: DeskLeg[], i: number): DeskLeg[] {
  return legs.length <= MIN_LEGS ? legs : legs.filter((_, j) => j !== i);
}

export type TemplateId =
  | "long-call"
  | "long-put"
  | "bull-call-spread"
  | "bear-call-spread"
  | "bull-put-spread"
  | "bear-put-spread"
  | "long-straddle"
  | "short-straddle"
  | "long-strangle"
  | "short-strangle"
  | "iron-condor"
  | "iron-butterfly"
  | "call-butterfly"
  | "put-butterfly"
  | "call-ratio-spread";

const leg = (percent: number, optionType: CustomLeg["optionType"], side: CustomLeg["side"], quantity = 1): CustomLeg => ({ percent, optionType, side, quantity });

/** Strategy templates around the start level: 5% wings and quantity 1, legs highest level first. */
export const TEMPLATES: Array<{ id: TemplateId; label: string; legs: CustomLeg[] }> = [
  { id: "long-call", label: "Long Call", legs: [leg(100, "C", "B")] },
  { id: "long-put", label: "Long Put", legs: [leg(100, "P", "B")] },
  { id: "bull-call-spread", label: "Bull Call Spread", legs: [leg(105, "C", "S"), leg(100, "C", "B")] },
  { id: "bear-call-spread", label: "Bear Call Spread", legs: [leg(105, "C", "B"), leg(100, "C", "S")] },
  { id: "bull-put-spread", label: "Bull Put Spread", legs: [leg(100, "P", "S"), leg(95, "P", "B")] },
  { id: "bear-put-spread", label: "Bear Put Spread", legs: [leg(100, "P", "B"), leg(95, "P", "S")] },
  { id: "long-straddle", label: "Long Straddle", legs: [leg(100, "C", "B"), leg(100, "P", "B")] },
  { id: "short-straddle", label: "Short Straddle", legs: [leg(100, "C", "S"), leg(100, "P", "S")] },
  { id: "long-strangle", label: "Long Strangle", legs: [leg(105, "C", "B"), leg(95, "P", "B")] },
  { id: "short-strangle", label: "Short Strangle", legs: [leg(105, "C", "S"), leg(95, "P", "S")] },
  { id: "iron-condor", label: "Iron Condor", legs: [leg(110, "C", "B"), leg(105, "C", "S"), leg(95, "P", "S"), leg(90, "P", "B")] },
  { id: "iron-butterfly", label: "Iron Butterfly", legs: [leg(105, "C", "B"), leg(100, "C", "S"), leg(100, "P", "S"), leg(95, "P", "B")] },
  { id: "call-butterfly", label: "Call Butterfly", legs: [leg(105, "C", "B"), leg(100, "C", "S", 2), leg(95, "C", "B")] },
  { id: "put-butterfly", label: "Put Butterfly", legs: [leg(105, "P", "B"), leg(100, "P", "S", 2), leg(95, "P", "B")] },
  { id: "call-ratio-spread", label: "Call Ratio Spread 1×2", legs: [leg(105, "C", "S", 2), leg(100, "C", "B")] },
];

/** "Buy 1 Call At 100%, Sell 1 Call At 105%": the legs of a book in words. */
export function legsText(legs: CustomLeg[]): string {
  return legs.map((l) => `${l.side === "S" ? "Sell" : "Buy"} ${l.quantity} ${l.optionType === "C" ? "Call" : "Put"} At ${l.percent}%`).join(", ");
}
