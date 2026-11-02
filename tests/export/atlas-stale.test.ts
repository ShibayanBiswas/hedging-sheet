import { describe, expect, it } from "vitest";

import { seedMarketData } from "@/lib/engine/defaults";
import { tabSpecs } from "@/lib/exports/tab-specs";
import type { DeskInputs } from "@/lib/inputs/draft";
import { tabPdfProps } from "@/lib/pdf/tab-pdf-props";

import { fixtureInputs, priced } from "../helpers/fixture";

const market = seedMarketData();
const inputs = fixtureInputs() as DeskInputs;
const STALE = "Inputs Changed · Run Again";
const WAITING = "Waiting For Run Simulation";
const NOW = new Date("2026-10-28T04:30:00.000Z");

describe("Logic Atlas PDF while there is nothing current to show", () => {
  it("says the inputs changed on a stale run, as the page does", () => {
    const json = JSON.stringify(tabSpecs("logic-atlas", { result: null, inputs, market, staleRun: true }));
    expect(json).toContain(STALE);
    expect(json).not.toContain(WAITING);
  });

  it("carries it through to the PDF", () => {
    const props = tabPdfProps("logic-atlas", { result: null, inputs, market, staleRun: true, runAt: null, now: NOW });
    expect(JSON.stringify(props.blocks)).toContain(STALE);
  });

  it("still says waiting before any run", () => {
    const json = JSON.stringify(tabSpecs("logic-atlas", { result: null, inputs, market }));
    expect(json).toContain(WAITING);
    expect(json).not.toContain(STALE);
  });
});

describe("Logic Atlas PDF Insights", () => {
  const result = priced();
  const moved = { ...market, surface: { ...market.surface, label: "December 2026 Volatility Surface" } };
  const ran = { ...market, surface: { ...market.surface, label: "October 2026 Volatility Surface" } };

  it("quote the surface the run used, as the page does, when the market has moved on since", () => {
    const json = JSON.stringify(tabSpecs("logic-atlas", { result, inputs, market: moved, runMarket: ran }).find((s) => s.id === "atlas-insights"));
    expect(json).toContain("the saved October 2026 surface");
    expect(json).not.toContain("the saved December 2026 surface");
  });

  it("the Surface Lookup stage still describes the market on the page now, as the page does", () => {
    const json = JSON.stringify(tabSpecs("logic-atlas", { result, inputs, market: moved, runMarket: ran }).find((s) => s.id === "atlas-flows"));
    expect(json).toContain("December 2026 surface");
  });

  it("use the one market given when no run market is passed, which is how Excel keeps its record of the run", () => {
    const json = JSON.stringify(tabSpecs("logic-atlas", { result, inputs, market: ran }).find((s) => s.id === "atlas-insights"));
    expect(json).toContain("the saved October 2026 surface");
  });
});
