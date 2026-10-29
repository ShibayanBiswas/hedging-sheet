import type { Underlying } from "@/lib/engine/types";

/** The underlyings the desk prices, in the order the pickers list them. */
export const UNDERLYINGS: readonly Underlying[] = ["Nifty", "Sensex"];

/** The surface file quotes dividend points in this underlying's terms; the other scales them by the reference prices. */
export const QUOTE_UNDERLYING: Underlying = "Sensex";

/** The live level of each underlying in the market levels feed. */
export const LEVEL_FIELD = { Nifty: "niftyLevel", Sensex: "sensexLevel" } as const satisfies Record<Underlying, string>;
