import { defaultInputs } from "@/lib/engine/defaults";
import type { HedgeInputs, OptionType, StrikeSide, Underlying } from "@/lib/engine/types";

export type InputMode = "default" | "blank";

/** Inputs as the desk edits them: the underlying and each strike's Option Type and side may be unset, and any number may be blank (NaN). */
export type DeskInputs = Omit<HedgeInputs, "underlying" | "strikeOptionTypes" | "strikeSides"> & {
  underlying: Underlying | "";
  strikeOptionTypes: Array<OptionType | "">;
  strikeSides: Array<StrikeSide | "">;
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
    strikePercents: [NaN, NaN, NaN, NaN, NaN, NaN],
    participations: [NaN, null],
    floorUnits: NaN,
    strikeOptionTypes: ["", "", "", "", "", ""],
    strikeSides: ["", "", "", "", "", ""],
    expiryCount: NaN,
    expiryMonths: [],
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

/** Inputs the engine can price: the underlying and every strike's Option Type and side are chosen. */
export function isPriceable(inputs: DeskInputs): inputs is DeskInputs & HedgeInputs {
  return inputs.underlying !== "" && inputs.strikeOptionTypes.every((t) => t !== "") && inputs.strikeSides.every((t) => t !== "");
}
