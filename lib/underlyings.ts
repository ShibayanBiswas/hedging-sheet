import type { Underlying } from "@/lib/engine/types";

/** The underlyings the desk prices, in the order the pickers list them. */
export const UNDERLYINGS: readonly Underlying[] = ["Nifty", "Sensex"];

/** The surface file quotes dividend points in this underlying's terms; the other scales them by the reference prices. */
export const QUOTE_UNDERLYING: Underlying = "Sensex";

/** How the auto hedge strike follows the spot, as the Hedge Strike helper says it; `autoHedgeStrike` computes it. */
export const HEDGE_RULE_TEXT = {
  Nifty: "Auto From Spot: Spot Plus 150, Rounded Up To The Next 100",
  Sensex: "Auto From Spot: Spot Times 1.006, Rounded Up To The Next 100",
} as const satisfies Record<Underlying, string>;

/** The live level of each underlying in the market levels feed. */
export const LEVEL_FIELD = { Nifty: "niftyLevel", Sensex: "sensexLevel" } as const satisfies Record<Underlying, string>;
