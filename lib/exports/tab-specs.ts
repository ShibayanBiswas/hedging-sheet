import { formatDate, isValidYmd } from "@/lib/engine/dates";
import { annualVolFromDaily } from "@/lib/engine/hedging-sheet";
import { rateCapSellingForward } from "@/lib/engine/rates";
import { EXPIRY_WEEKDAY, medianExpiryIndex, WEEKDAY_NAMES } from "@/lib/engine/schedule";
import { deriveTerms, rupeeStrike, startLevel, strikeUnits } from "@/lib/engine/structure";
import type { HedgingResult, MarketData } from "@/lib/engine/types";
import { DEEP_MONEYNESS, pricingRowForMonth, referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { inputHash } from "@/lib/input-hash";
import { underlyingName, type DeskInputs } from "@/lib/inputs/draft";
import { logicModules, pipelineStages } from "@/lib/logic-atlas";
import { outputTables, type AnySpec, type CellValue, type KeyValueSpec, type TableSpec } from "@/lib/tables";
import { UNDERLYINGS } from "@/lib/underlyings";

/** Every tab of the app, in tab order: the Excel file has one sheet each and every tab offers a PDF. */
export const EXPORT_TABS = [
  { id: "inputs", name: "Inputs", needsRun: false },
  { id: "summary", name: "Summary Sheet", needsRun: true },
  { id: "pricer", name: "Pricer", needsRun: true },
  { id: "product", name: "Product Description", needsRun: true },
  { id: "vega-hedge", name: "Day 1 Vega Hedge", needsRun: true },
  { id: "margin", name: "Mark To Market", needsRun: true },
  { id: "market-data", name: "Market Data", needsRun: false },
  { id: "logic-atlas", name: "Logic Atlas", needsRun: false },
] as const;

export type ExportTab = (typeof EXPORT_TABS)[number]["id"];

export const AUDIT_SHEET = "Audit";

export type ExportContext = {
  /** The last run when it still matches the inputs; tabs that need a run export nothing without it. */
  result: HedgingResult | null;
  inputs: DeskInputs;
  market: MarketData;
};

const num = (v: number): CellValue => (Number.isFinite(v) ? v : null);
const text = (v: string | null | undefined): CellValue => (v ? v : null);

/** The Inputs tab: the seven groups, with expiries and strikes as tables. */
function inputsSpecs(i: DeskInputs): AnySpec[] {
  const u = underlyingName(i);
  const n = Number.isInteger(i.expiryCount) ? i.expiryCount : 0;
  const hedge = i.hedgeExpiryIndex ?? medianExpiryIndex(n);
  const start = Number.isFinite(i.spot) && Number.isFinite(i.startLevelUplift) ? startLevel(i) : NaN;
  const k = i.strikePercents;
  const ready = Number.isFinite(start) && [...k, i.coupon, i.decay, i.floorUnits].every(Number.isFinite) && i.participations.every((p) => p == null || Number.isFinite(p));
  const units = ready && k.length ? strikeUnits(i, start) : [];
  const terms = deriveTerms(i);
  const has = k.length > 0;
  const kv = (id: string, title: string, items: KeyValueSpec["items"]): KeyValueSpec => ({ id, title, items });
  return [
    kv("inputs-market", "1 Underlying And Market", [
      { label: "Underlying", value: text(i.underlying), kind: "text" },
      { label: "Valuation Date", value: text(i.valuationDate), kind: "date" },
      { label: `${u} Spot`, value: num(i.spot), kind: "number" },
      { label: "Start Level", value: num(start), kind: "integer" },
      { label: "Hedge Strike", value: num(i.hedgeStrike), kind: "integer" },
      { label: "Hedge Strike Source", value: i.hedgeStrikeAuto ? "Auto From Spot" : "Typed", kind: "text" },
    ]),
    {
      id: "inputs-expiries",
      title: "2 Observation Expiries",
      note: i.underlying ? `Every expiry is the last ${WEEKDAY_NAMES[EXPIRY_WEEKDAY[i.underlying]]} of its month.` : undefined,
      columns: [
        { key: "expiry", label: "Expiry", kind: "text" },
        { key: "date", label: "Date", kind: "date" },
      ],
      rows: Array.from({ length: n }, (_, j) => ({
        expiry: j === hedge ? `Expiry ${j + 1} · Observation And Hedge Option Expiry` : `Expiry ${j + 1} · Observation`,
        date: isValidYmd(i.expiryDates[j]) ? i.expiryDates[j]! : null,
      })),
    },
    {
      id: "inputs-strikes",
      title: "3 Strikes And Spreads",
      columns: [
        { key: "strike", label: "Strike", kind: "text" },
        { key: "level", label: "Level %", kind: "number" },
        { key: "points", label: "Level In Points", kind: "integer" },
        { key: "type", label: "Option Type", kind: "text" },
        { key: "side", label: "Buy Or Sell", kind: "text" },
        { key: "units", label: "Units", kind: "number", digits: 3 },
      ],
      rows: k.map((pct, j) => ({
        strike: `Strike ${j + 1}`,
        level: num(pct),
        points: Number.isFinite(start) && Number.isFinite(pct) ? rupeeStrike(start, pct) : null,
        type: i.strikeOptionTypes[j] === "C" ? "Call" : i.strikeOptionTypes[j] === "P" ? "Put" : null,
        side: i.strikeSides[j] === "B" ? "Buy" : i.strikeSides[j] === "S" ? "Sell" : null,
        units: units.length ? num(units[j]!) : null,
      })),
    },
    {
      id: "inputs-spreads",
      title: "Spreads",
      columns: [
        { key: "spread", label: "Spread", kind: "text" },
        { key: "buy", label: "Buy Level", kind: "percent" },
        { key: "sell", label: "Sell Level", kind: "percent" },
        { key: "participation", label: "Participation Rate", kind: "number" },
      ],
      rows: has ? terms.spreads.map((s, j) => ({ spread: `Spread ${j + 1}`, buy: num(s.buy), sell: num(s.sell), participation: num(s.participation) })) : [],
    },
    kv("inputs-rates", "4 Rates", [
      { label: "NBFC Rate", value: num(i.nbfcRate), kind: "percent" },
      { label: "Premium Growth Rate", value: num(i.premiumRate), kind: "percent" },
      { label: "Margin Growth Rate", value: num(i.marginGrowthRate), kind: "percent", digits: 3 },
    ]),
    kv("inputs-terms", "5 Product Terms", [
      { label: `Target ${u} Rise`, value: has ? num(terms.target) : null, kind: "percent" },
      { label: "Coupon", value: num(i.coupon), kind: "percent" },
      { label: "Protection", value: has ? num(terms.protection) : null, kind: "percent" },
      { label: "Decay", value: num(i.decay), kind: "number" },
      { label: "Decay Floor Level", value: has ? num(terms.floorLevel) : null, kind: "percent", digits: 0 },
      { label: "Decay Reduction Below Floor", value: num(i.floorUnits), kind: "number" },
      { label: "Tenor In Days", value: num(i.tenorDays), kind: "integer" },
      { label: "Start Level Uplift", value: num(i.startLevelUplift), kind: "percent" },
      { label: "Notional In Crore", value: num(i.notionalCr), kind: "number" },
    ]),
    kv("inputs-volatility", "6 Volatility", [
      { label: `${u} Daily Volatility`, value: num(i.dailyVol), kind: "percent", digits: 3 },
      { label: `${u} Annual Volatility`, value: num(annualVolFromDaily(i.dailyVol)), kind: "percent", digits: 3 },
      { label: "Volatility Source", value: Number.isFinite(i.dailyVol) ? (i.dailyVolSource === "calculated" ? "Calculated" : "Edited") : null, kind: "text" },
      { label: "History Window In Days", value: num(i.historyWindowDays), kind: "integer" },
    ]),
    kv("inputs-desk", "7 Margin And Desk Terms", [
      { label: "Transaction Cost", value: num(i.transactionCost), kind: "percent" },
      { label: "Issuance Cost", value: num(i.issuanceCost), kind: "percent" },
      { label: "Margin Cost", value: num(i.marginCost), kind: "percent" },
      { label: "Exposure Margin", value: num(i.exposureMargin), kind: "percent" },
      { label: "Futures Margin", value: num(i.futuresMargin), kind: "percent" },
      { label: "Exchange Forward Rate", value: num(i.exchangeForwardRate), kind: "percent" },
      { label: "Exchange Discount Rate", value: num(i.exchangeDiscountRate), kind: "percent" },
      { label: "Stressed Forward Rate", value: num(i.stressedForwardRate), kind: "percent" },
      { label: "Stressed Discount Rate", value: num(i.stressedDiscountRate), kind: "percent" },
      { label: "Shock Sigmas", value: num(i.stressSigmas), kind: "number" },
      { label: "Shock Days", value: num(i.stressDays), kind: "integer" },
      { label: "Volatility Multiplier", value: num(i.stressVolMultiplier), kind: "number" },
    ]),
  ];
}

/** The Market Data tab: headline, the surface with its reference strikes, the parameters and the rate curve. */
function marketDataSpecs(market: MarketData, i: Pick<DeskInputs, "valuationDate" | "premiumRate" | "underlying">): AnySpec[] {
  const s = market.surface;
  const p = market.params;
  const u = i.underlying || UNDERLYINGS[0];
  const row = pricingRowForMonth(s.pricingParams, i.valuationDate);
  const deep = s.moneyness.find((m) => Math.abs(m - DEEP_MONEYNESS) < 1e-9) ?? s.moneyness[0] ?? NaN;
  const columns: TableSpec["columns"] = [
    { key: "row", label: "Expiry", kind: "text" },
    { key: "deep", label: "Deep", kind: "number" },
    ...s.moneyness.map((m, c) => ({ key: `m${c}`, label: `${Math.round(m * 100)}%`, kind: "number" as const })),
  ];
  const strikeRows = UNDERLYINGS.map((name) => {
    const ref = referencePriceForUnderlying(s, name);
    const out: Record<string, CellValue> = { row: `${name} Strikes`, deep: ref > 0 ? deep * ref : null };
    s.moneyness.forEach((m, c) => (out[`m${c}`] = ref > 0 ? m * ref : null));
    return out;
  });
  const volRows = s.expiries.map((e, r) => {
    const out: Record<string, CellValue> = { row: formatDate(e), deep: num(s.volsPercent[r]?.[0] ?? NaN) };
    s.moneyness.forEach((_, c) => (out[`m${c}`] = num(s.volsPercent[r]?.[c + 1] ?? NaN)));
    return out;
  });
  return [
    {
      id: "md-headline",
      title: "Headline",
      items: [
        { label: "Surface", value: s.label.replace(" Volatility Surface", ""), kind: "text" },
        { label: "Bid Or Offer", value: p.bidOffer === "O" ? "Offer" : "Bid", kind: "text" },
        { label: "Expiry Rows", value: s.expiries.length, kind: "integer" },
        { label: "Strike Columns", value: s.moneyness.length, kind: "integer" },
        { label: `Reference ${u} Price`, value: referencePriceForUnderlying(s, u) || null, kind: "number" },
        { label: "Forward Sell Rate This Month", value: row?.fwdSellRate ?? null, kind: "percent" },
      ],
    },
    { id: "md-surface", title: "Volatility Surface", note: "Volatility in %. The first rows are the reference strikes; Deep reads the 55% column.", columns, rows: [...strikeRows, ...volRows] },
    {
      id: "md-params",
      title: "Surface Parameters",
      items: [
        { label: "Volatility Bump", value: row?.volBump ?? null, kind: "percent" },
        { label: "Incremental Margin", value: row?.incMargin ?? null, kind: "percent" },
        { label: "Full Margin", value: row?.fullMargin ?? null, kind: "percent" },
        { label: "Margin Cost", value: row?.marginCost ?? null, kind: "percent" },
        { label: "Forward Sell Rate", value: row?.fwdSellRate ?? null, kind: "percent" },
        { label: "Dividend Bid Or Offer Factor", value: p.dividendBidOfferMultiplier, kind: "number" },
        { label: "Rate Cap While Buying Forward", value: p.rateCapBuyingForward, kind: "percent" },
        { label: "Rate Cap While Selling Forward", value: Number.isFinite(i.premiumRate) ? rateCapSellingForward(p, i.premiumRate) : null, kind: "percent" },
      ],
    },
    {
      id: "md-rate-curve",
      title: "Rate Curve Points",
      columns: [
        { key: "years", label: "Tenor In Years", kind: "number" },
        { key: "rate", label: "Rate %", kind: "number" },
      ],
      rows: p.rateCurve.map((pt) => ({ years: pt.years, rate: pt.ratePercent })),
    },
  ];
}

/** The Logic Atlas tab: the pipeline, then each section's formulas with the last run's values. */
function logicAtlasSpecs(r: HedgingResult | null, i: Pick<DeskInputs, "underlying">): AnySpec[] {
  const u = underlyingName(i);
  const weekday = i.underlying ? WEEKDAY_NAMES[EXPIRY_WEEKDAY[i.underlying]]! : "Expiry Weekday";
  const columns: TableSpec["columns"] = [
    { key: "name", label: "Stage", kind: "text" },
    { key: "words", label: "Formula In Words", kind: "text" },
    { key: "inputs", label: "Inputs", kind: "text" },
    { key: "output", label: "Output", kind: "text" },
    { key: "value", label: "Value From The Last Run", kind: "text" },
  ];
  const rows = (list: ReturnType<typeof pipelineStages>) => list.map((f) => ({ name: f.name, words: f.words, inputs: f.inputs, output: f.output, value: r ? f.value(r) : null }));
  return [
    { id: "atlas-pipeline", title: "Pipeline", columns, rows: rows(pipelineStages(u, weekday)) },
    ...logicModules(u, weekday).map((m): TableSpec => ({ id: `atlas-${m.id}`, title: m.title, columns: [{ ...columns[0]!, label: "Formula" }, ...columns.slice(1)], rows: rows(m.formulas) })),
  ];
}

/** The tables of one tab, as the page shows them. Output tabs without a current run have none. */
export function tabSpecs(tab: ExportTab, ctx: ExportContext): AnySpec[] {
  if (tab === "inputs") return inputsSpecs(ctx.inputs);
  if (tab === "market-data") return marketDataSpecs(ctx.market, ctx.inputs);
  if (tab === "logic-atlas") return logicAtlasSpecs(ctx.result, ctx.inputs);
  return ctx.result ? outputTables(ctx.result)[tab] : [];
}

/** The Audit sheet: when and on what the run was made, then every input it used. */
export function auditSpecs(r: HedgingResult, market: MarketData, runAt: string): AnySpec[] {
  const i = r.inputs;
  return [
    {
      id: "audit-run",
      title: "Run",
      items: [
        { label: "Run At", value: runAt, kind: "text" },
        { label: "Input Hash", value: inputHash(i), kind: "text" },
        { label: "Surface", value: market.surface.label.replace(" Volatility Surface", ""), kind: "text" },
        { label: "Goal Seek Iterations", value: r.diagnostics.solverIterations, kind: "integer" },
        { label: "Inbuilt", value: r.summary.actualInbuilt, kind: "percent", digits: 3 },
      ],
    },
    ...inputsSpecs({ ...i }),
  ];
}
