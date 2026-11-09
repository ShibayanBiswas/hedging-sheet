import { defaultInputs } from "@/lib/engine/defaults";
import type { HedgeInputs, OptionType, StrikeSide, Underlying } from "@/lib/engine/types";

export type InputMode = "default" | "blank";

/** A Custom Option Book leg as the desk edits it: the Option Type and side may be unset and the numbers blank (NaN). */
export type DeskLeg = { percent: number; optionType: OptionType | ""; side: StrikeSide | ""; quantity: number };

/** Inputs as the desk edits them: the underlying and each strike's Option Type and side may be unset, and any number may be blank (NaN). */
export type DeskInputs = Omit<HedgeInputs, "underlying" | "strikeOptionTypes" | "strikeSides" | "customLegs"> & {
  underlying: Underlying | "";
  strikeOptionTypes: Array<OptionType | "">;
  strikeSides: Array<StrikeSide | "">;
  /** Absent until the book is first switched to Custom Option Book; each book keeps its own entries across a switch. */
  customLegs?: DeskLeg[];
};

export const INPUT_MODES: Array<{ id: InputMode; label: string; subtitle: string }> = [
  { id: "default", label: "Default Values", subtitle: "Live Spot, Today's Date, Calculated Volatility And The Desk Terms" },
  { id: "blank", label: "Blank Inputs", subtitle: "Every Field Starts Empty For A Product Built From Scratch" },
];

/** Every field empty: numbers NaN, dates and choices "". Surface parameters stay with the market data. */
export function blankInputs(): DeskInputs {
  const base = defaultInputs({ valuationDate: "" });
  return {
    ...base,
    underlying: "",
    valuationDate: "",
    spot: NaN,
    hedgeStrike: NaN,
    hedgeStrikeAuto: true,
    nbfcRate: NaN,
    premiumRate: NaN,
    marginGrowthRate: NaN,
    coupon: NaN,
    decay: NaN,
    tenorDays: NaN,
    startLevelUplift: NaN,
    // No strikes until the Number Of Spreads is picked.
    strikePercents: [],
    participations: [],
    floorUnits: NaN,
    strikeOptionTypes: [],
    strikeSides: [],
    expiryCount: NaN,
    expiryDates: [],
    hedgeExpiryIndex: null,
    notionalCr: NaN,
    transactionCost: NaN,
    issuanceCost: NaN,
    marginCost: NaN,
    dailyVol: NaN,
    dailyVolSource: "overridden",
    exposureMargin: NaN,
    futuresMargin: NaN,
    exchangeForwardRate: NaN,
    exchangeDiscountRate: NaN,
    stressedForwardRate: NaN,
    stressedDiscountRate: NaN,
    stressSigmas: NaN,
    stressDays: NaN,
    stressVolMultiplier: NaN,
    legVolOverrides: {},
    hedgeVolOverride: null,
  };
}

/** The underlying's name for labels, or "Underlying" while none is chosen. */
export function underlyingName(inputs: Pick<DeskInputs, "underlying">): string {
  return inputs.underlying || "Underlying";
}

/**
 * Inputs the engine can price: the underlying and every strike's Option Type and side are chosen. A Custom Option Book
 * needs every leg's instead, since it never reads the product strikes.
 */
export function isPriceable(inputs: DeskInputs): inputs is DeskInputs & HedgeInputs {
  if (inputs.bookMode === "custom") {
    const legs = inputs.customLegs ?? [];
    return inputs.underlying !== "" && legs.length > 0 && legs.every((l) => l.optionType !== "" && l.side !== "");
  }
  return inputs.underlying !== "" && inputs.strikeOptionTypes.every((t) => t !== "") && inputs.strikeSides.every((t) => t !== "");
}
