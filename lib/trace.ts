import type { HedgingResult } from "@/lib/engine/types";

/** True in a development build when the page URL carries ?trace=1. Production builds never trace. */
export function traceEnabled(search: string, env: string | undefined = process.env.NODE_ENV): boolean {
  return env !== "production" && new URLSearchParams(search).get("trace") === "1";
}

/** Writes the run's intermediate values to the browser console, one collapsed group per stage. */
export function tracePipeline(r: HedgingResult, out: Pick<Console, "groupCollapsed" | "groupEnd" | "table" | "log"> = console): void {
  const group = (title: string, body: () => void) => {
    out.groupCollapsed(`Hedging Sheet Trace · ${title}`);
    body();
    out.groupEnd();
  };
  group("Inputs", () => out.table({ ...r.inputs, expiryDates: r.inputs.expiryDates.join(", "), strikePercents: r.inputs.strikePercents.join(", ") }));
  group("Schedule", () => out.table(r.schedule));
  group("Strikes", () => out.table(r.structure.strikes));
  group("Legs", () =>
    out.table(
      r.pricer.legs.map((l) => ({
        strike: l.strike,
        maturity: l.maturity,
        optionType: l.optionType,
        forward: l.forward,
        forwardGrowth: l.forwardGrowth,
        discountYield: l.discountYield,
        volatility: l.volatility,
        price: l.price,
        delta: l.delta,
        vega: l.vega,
      })),
    ),
  );
  group("Goal Seek", () => out.table(r.diagnostics.solverTrace));
  group("Pricer Header", () => out.table(r.pricer.header));
  group("Day 1 Vega Hedge", () => out.table(r.dayOneVegaHedge.margin));
  group("Mark To Market", () => out.table(r.markToMarket.rows));
  group("Timings In Milliseconds", () => out.table(r.diagnostics.timings));
  out.log("Hedging Sheet Trace · Rate Curve Points", r.diagnostics.curvePoints);
}
