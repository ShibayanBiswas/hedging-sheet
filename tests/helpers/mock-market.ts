/**
 * The market and inputs exactly as the app sees them in mock mode, for fixture scripts and unit tests:
 * the seeded surface and parameters after the dataset route and the client normalise them, and the
 * Blank Inputs fill fixture turned into inputs the way the form parses each field.
 */
import { autoHedgeStrike, normalizePricingParams } from "@/lib/engine/defaults";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import { snapExpiry } from "@/lib/engine/schedule";
import type { HedgeInputs, MarketData, OptionType, PricingParams, StrikeSide, Underlying, VolSurface } from "@/lib/engine/types";
import { forwardMarket, normalizeVolSurface } from "@/lib/engine/vol-surface";
import { blankInputs, type DeskInputs } from "@/lib/inputs/draft";
import { setSpreadCount } from "@/lib/inputs/strikes";
import { numberFieldRules } from "@/lib/validation/inputRules";

import blankFill from "../fixtures/blank-valid-fill.json";
import defaults from "../fixtures/default-inputs.json";
import pricingParams from "../fixtures/pricing-params.json";
import surface from "../fixtures/surface.json";

const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** /api/dataset reads the seeded documents, normalises them and sends JSON; the client normalises the surface again. */
function fixtureMarket(): MarketData {
  const { monthKey, ...params } = pricingParams as PricingParams & { monthKey: string };
  void monthKey;
  const sent = roundTrip({ surface: normalizeVolSurface(surface as unknown as VolSurface), params: normalizePricingParams(params) });
  return { surface: normalizeVolSurface(sent.surface), params: sent.params };
}

/** Default Values mode at the mock clock. */
export function mockDefaultInputs(): HedgeInputs {
  return defaults.inputs as unknown as HedgeInputs;
}

/** Blank Inputs after typing blank-valid-fill.json: percent fields are typed as % and stored as decimals. */
export function blankFillInputs(fill = blankFill.fill as Array<[string, string]>): HedgeInputs {
  let d: DeskInputs = blankInputs();
  for (const [testId, text] of fill) {
    const key = testId.replace(/^input-/, "");
    if (key === "underlying") d = { ...d, underlying: text as Underlying };
    else if (key.startsWith("strikeOptionTypes-")) {
      const types = [...d.strikeOptionTypes];
      types[Number(key.split("-")[1])] = text as OptionType;
      d = { ...d, strikeOptionTypes: types };
    } else if (key.startsWith("strikeSides-")) {
      const sides = [...d.strikeSides];
      sides[Number(key.split("-")[1])] = text as StrikeSide;
      d = { ...d, strikeSides: sides };
    }
    else if (key === "valuationDate") d = { ...d, valuationDate: text };
    else if (key === "expiryCount") {
      const n = Number(text);
      d = { ...d, expiryCount: n, expiryDates: Array.from({ length: n }, (_, i) => d.expiryDates[i] ?? "") };
    } else if (key === "spreadCount") {
      d = { ...d, ...setSpreadCount(d, Number(text), "blank") };
    } else if (key.startsWith("expiryDates-")) {
      const dates = [...d.expiryDates];
      dates[Number(key.split("-")[1])] = d.underlying ? snapExpiry(text, d.underlying) : text;
      d = { ...d, expiryDates: dates };
    } else {
      const field = key.replace(/-/g, ".");
      const rule = numberFieldRules(d).find((r) => r.field === field);
      const typed = Number(text.replace(/,/g, ""));
      const value = rule?.percent ? typed / 100 : typed;
      const [base, index] = field.split(".");
      if (index != null) {
        const list = [...(d[base as "strikePercents" | "participations"] as Array<number | null>)];
        list[Number(index)] = value;
        d = { ...d, [base!]: list };
      } else {
        d = { ...d, [field]: value };
      }
      if (field === "dailyVol") d = { ...d, dailyVolSource: "overridden" };
    }
    if (d.hedgeStrikeAuto && d.underlying && Number.isFinite(d.spot)) d = { ...d, hedgeStrike: autoHedgeStrike(d.spot, d.underlying) };
  }
  return d as HedgeInputs;
}

/** Run Simulation: the engine on the forward market at the valuation date. */
export function priceLikeTheApp(inputs: HedgeInputs) {
  const r = computeHedgingSheet(inputs, forwardMarket(fixtureMarket(), inputs.valuationDate));
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join("; "));
  return r;
}
