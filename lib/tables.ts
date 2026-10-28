import { formatDate } from "@/lib/engine/dates";
import { deriveTerms } from "@/lib/engine/structure";
import type { HedgeRow, HedgingResult, MarginRow, OptionPricing, OptionType, PricerLeg } from "@/lib/engine/types";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";

export function optionTypeLabel(type: OptionType): string {
  return type === "C" ? "Call" : "Put";
}

/** How a value is shown on screen and written to Excel. */
export type CellKind = "crore" | "rupee" | "percent" | "number" | "integer" | "date" | "text" | "greek";

export type CellValue = number | string | null;

export type Column = {
  key: string;
  label: string;
  kind: CellKind;
  digits?: number;
};

export type TableSpec = {
  id: string;
  title: string;
  note?: string;
  columns: Column[];
  rows: Array<Record<string, CellValue>>;
  /** Index of a row to highlight, such as the 0% move. */
  highlightRow?: number;
  /** Index of a total row. */
  totalRow?: number;
};

export type KeyValueSpec = {
  id: string;
  title: string;
  note?: string;
  items: Array<{ label: string; value: CellValue; kind: CellKind; digits?: number }>;
};

/** A Pricer style grid: one row per Pricer field, one column per live leg, with a strike band over expiry dates. */
export type GridSpec = {
  id: string;
  title: string;
  note?: string;
  /** Labels of the two header rows over the field column. */
  corner: [string, string];
  groups: Array<{ label: string; span: number }>;
  columnLabels: string[];
  rows: Array<{ label: string; kind: CellKind; digits?: number; values: CellValue[]; overridden?: boolean[] }>;
  /** Leg keys, one per column, for per-leg edits. */
  columnKeys?: string[];
};

type Item = KeyValueSpec["items"][number];

/** A one-row headline table that replaces a card rail. */
export function headlineTable(id: string, title: string, items: Item[]): TableSpec {
  return {
    id,
    title,
    columns: items.map((item, i) => ({ key: `c${i}`, label: item.label, kind: item.kind, digits: item.digits })),
    rows: [Object.fromEntries(items.map((item, i) => [`c${i}`, item.value]))],
  };
}

const pct = (key: string, label: string, digits = 2): Column => ({ key, label, kind: "percent", digits });
const cr = (key: string, label: string, digits = 2): Column => ({ key, label, kind: "crore", digits });
const num = (key: string, label: string, digits = 2): Column => ({ key, label, kind: "number", digits });
const date = (key: string, label: string): Column => ({ key, label, kind: "date" });
const text = (key: string, label: string): Column => ({ key, label, kind: "text" });

/** "137% · 1,05,901": the Pricer strike band label. */
export function strikeLabel(percent: number, strike: number): string {
  return `${fmtNumber(percent, Number.isInteger(percent) ? 0 : 2)}% · ${fmtNumber(strike, 0)}`;
}

// ------------------------------------------------------------------ Headlines, shared by the pages and Excel

export function summaryHeadline(r: HedgingResult): TableSpec {
  const s = r.summary;
  return headlineTable("summary-headline", "Headline", [
    { label: "Actual Inbuilt", value: s.actualInbuilt, kind: "percent" },
    { label: "Option Premium in Crore", value: s.totalPremiumCr, kind: "crore" },
    { label: "Maturity Payout in Crore", value: r.productDescription.maturityCr, kind: "crore" },
    { label: "Margin Requirement", value: s.margin, kind: "percent" },
    { label: "Hedge Quantity", value: r.dayOneVegaHedge.quantity, kind: "number" },
    { label: "Vega in Crore", value: s.vegaCr, kind: "crore" },
    { label: "Delta in Contracts", value: s.deltaContracts, kind: "number", digits: 0 },
    { label: "Internal Rate of Return", value: s.irr, kind: "percent" },
  ]);
}

export function pricerHeadline(r: HedgingResult): TableSpec {
  const h = r.pricer.header;
  return headlineTable("pricer-headline", "Headline", [
    { label: `Start ${r.underlyingLabel} Level`, value: h.startLevel, kind: "number", digits: 0 },
    { label: "Actual Inbuilt", value: h.actualInbuilt, kind: "percent" },
    { label: "Premium in Crore", value: h.premium / 1e7, kind: "crore" },
    { label: "Maturity Payout in Crore", value: h.payout / 1e7, kind: "crore" },
    { label: "Achieved Coupon", value: h.achievedCoupon, kind: "percent" },
    { label: "Delta in Contracts", value: h.delta, kind: "number", digits: 0 },
    { label: "Internal Rate of Return", value: h.irr, kind: "percent" },
  ]);
}

export function productHeadline(r: HedgingResult): TableSpec {
  const d = r.productDescription;
  return headlineTable("product-headline", "Headline", [
    { label: "Maturity Value in Crore", value: d.maturityCr, kind: "crore" },
    { label: "Internal Rate of Return", value: d.irr, kind: "percent" },
    { label: "Amount With NBFC in Crore", value: d.nbfcCr, kind: "crore" },
    { label: "Premium in Crore", value: d.premiumCr, kind: "crore" },
    { label: "Margin in Crore", value: d.marginCr, kind: "crore" },
  ]);
}

export function vegaHeadline(r: HedgingResult): TableSpec {
  const zero = r.dayOneVegaHedge.fair.find((h) => h.move === 0)!;
  const zeroMargin = r.dayOneVegaHedge.margin.find((m) => m.move === 0)!;
  return headlineTable("vega-headline", "Headline", [
    { label: "Hedge Strike", value: r.summary.hedgeStrike, kind: "number", digits: 0 },
    { label: "Option Expiry", value: r.summary.hedgeExpiry, kind: "date" },
    { label: "Hedge Quantity", value: r.dayOneVegaHedge.quantity, kind: "number" },
    { label: "Day 1 Fair Price", value: zero.price, kind: "number" },
    { label: "Hedge Delta", value: zero.delta, kind: "number", digits: 5 },
    { label: "Hedge Vega", value: zero.vega, kind: "number", digits: 4 },
    { label: "Fair Volatility", value: zero.volatility, kind: "percent" },
    { label: "Premium Received in Crore", value: r.summary.hedgePremiumCr, kind: "crore" },
    { label: "Total Margin At 0% in Crore", value: zeroMargin.totalMarginCr, kind: "crore" },
  ]);
}

export function marginHeadline(r: HedgingResult): TableSpec {
  const zero = r.markToMarket.zeroRow;
  const worst = r.markToMarket.worstCase;
  return headlineTable("margin-headline", "Headline", [
    { label: "Worst Case Requirement in Crore", value: worst.totalRequirementCr, kind: "crore" },
    { label: "Worst Case Move", value: worst.move, kind: "percent", digits: 0 },
    { label: "Requirement At 0% in Crore", value: zero.totalRequirementCr, kind: "crore" },
    { label: "Margin Funded In The Pricer", value: r.summary.margin, kind: "percent" },
    { label: "Product Requirement At 0% in Lakh", value: zero.productRequirementLakh, kind: "number", digits: 4 },
    { label: "Residual Futures At 0% in Lakh", value: zero.residualFuturesLakh, kind: "number", digits: 4 },
  ]);
}

// ------------------------------------------------------------------ Summary Sheet

export function summaryTables(r: HedgingResult): Array<TableSpec | KeyValueSpec> {
  const u = r.underlyingLabel;
  const i = r.inputs;
  const s = r.summary;
  const terms = deriveTerms(i);

  const specItems: Item[] = [
    { label: `Target ${u} Rise`, value: terms.target, kind: "percent" },
    { label: "Coupon", value: i.coupon, kind: "percent" },
    { label: "Actual Inbuilt", value: s.actualInbuilt, kind: "percent" },
    { label: "Internal Rate of Return", value: s.irr, kind: "percent" },
  ];
  terms.spreads.forEach((sp, j) => {
    specItems.push(
      { label: `Spread ${j + 1} Buy Level`, value: sp.buy, kind: "percent" },
      { label: `Spread ${j + 1} Sell Level`, value: sp.sell, kind: "percent" },
      { label: `Spread ${j + 1} Participation Rate`, value: sp.participation, kind: "number" },
    );
  });
  specItems.push(
    { label: "Protection", value: terms.protection, kind: "percent" },
    { label: "Decay", value: i.decay, kind: "number" },
    { label: "Tenor in Days", value: i.tenorDays, kind: "integer" },
    { label: "Margin", value: s.margin, kind: "percent" },
  );

  const legRows: Array<Record<string, CellValue>> = s.legs.map((l) => ({
    strike: l.strike,
    strikePercent: l.strikePercent / 100,
    option: optionTypeLabel(l.optionType),
    units: l.units,
    quantity: l.quantityLakh,
    price: l.averagePrice,
    premium: l.premiumCr,
  }));
  legRows.push({ strike: null, strikePercent: null, option: "Total", units: null, quantity: null, price: null, premium: s.totalPremiumCr });

  return [
    {
      id: "summary-market",
      title: "Market and Rates",
      items: [
        { label: "Valuation Date", value: i.valuationDate, kind: "date" },
        { label: `${u} Spot`, value: i.spot, kind: "number" },
        { label: `${u} Derived Spot`, value: i.spot, kind: "number" },
        { label: "NBFC Rate", value: i.nbfcRate, kind: "percent" },
        { label: "Premium Growth Rate", value: i.premiumRate, kind: "percent" },
        { label: "Margin Growth Rate", value: i.marginGrowthRate, kind: "percent" },
      ],
    },
    { id: "summary-spec", title: "Product Specification", items: specItems },
    {
      id: "summary-expiries",
      title: "Final Expiries",
      columns: [text("expiry", "Expiry"), date("date", "Date"), text("role", "Role")],
      rows: r.schedule.expiries.map((d, k) => ({
        expiry: `Expiry ${k + 1}`,
        date: d,
        role: d === r.schedule.hedgeExpiry ? "Option Expiry" : "Observation",
      })),
    },
    {
      id: "summary-greeks",
      title: "Product Greeks",
      items: [
        { label: "Notional in Crore", value: i.notionalCr, kind: "crore" },
        { label: "Option Expiry", value: s.optionExpiry, kind: "date" },
        { label: "Delta in Contracts", value: s.deltaContracts, kind: "number", digits: 0 },
        { label: "Delta %", value: s.deltaPercent, kind: "percent", digits: 1 },
        { label: "Weighted Average Volatility", value: s.vegaWeightedVol, kind: "percent" },
        { label: "Absolute Weighted Average Volatility", value: s.absVegaWeightedVol, kind: "percent" },
        { label: "Vega in Crore", value: s.vegaCr, kind: "crore" },
        { label: "Weighted Average Forward", value: s.rhoWeightedForward, kind: "percent" },
        { label: "Rho in Crore", value: s.rhoCr, kind: "crore" },
      ],
      note: "Weighted Average Volatility weights each leg by its signed vega, as the sheet does, so long and short legs offset. Absolute Weighted Average Volatility weights by the size of each leg's vega.",
    },
    {
      id: "summary-costs",
      title: "Costs",
      items: [
        { label: "Transaction Cost", value: i.transactionCost, kind: "percent" },
        { label: "Issuance Cost", value: i.issuanceCost, kind: "percent" },
        { label: "Margin Cost", value: i.marginCost, kind: "percent" },
        { label: "Product Cost", value: r.pricer.header.productCost, kind: "percent" },
      ],
    },
    {
      id: "summary-options",
      title: `Options Details For ₹${fmtNumber(i.notionalCr, 0)} Crore`,
      columns: [
        num("strike", "Strike", 0),
        pct("strikePercent", "Strike %", 0),
        text("option", "Option Type"),
        num("units", "Units"),
        num("quantity", "Quantity in Lakh"),
        num("price", "Average Price", 0),
        cr("premium", "Premium in Crore"),
      ],
      rows: legRows,
      totalRow: legRows.length - 1,
    },
    {
      id: "summary-hedge",
      title: "Day 1 Vega Hedge",
      columns: [
        num("strike", "Strike", 0),
        date("expiry", "Expiry"),
        text("option", "Option Type"),
        num("quantity", "Quantity in Lakh", 4),
        num("price", "Price"),
        cr("premium", "Premium in Crore"),
        num("delta", "Delta", 4),
      ],
      rows: [
        {
          strike: s.hedgeStrike,
          expiry: s.hedgeExpiry,
          option: optionTypeLabel(i.optionType),
          quantity: s.hedgeQuantityLakh,
          price: s.hedgePrice,
          premium: s.hedgePremiumCr,
          delta: s.hedgeDelta,
        },
      ],
    },
    {
      id: "summary-vol",
      title: "Volatility and Margin",
      items: [
        { label: `${u} Daily Volatility`, value: i.dailyVol, kind: "percent", digits: 3 },
        { label: `${u} Annual Volatility`, value: s.annualVol, kind: "percent" },
        { label: "Exposure Margin", value: i.exposureMargin, kind: "percent" },
        { label: "Futures Margin", value: i.futuresMargin, kind: "percent" },
      ],
    },
  ];
}

// ------------------------------------------------------------------ Pricer

/** The Pricer top block, B5 to V5, in sheet order. */
export function pricerPotTable(r: HedgingResult): KeyValueSpec {
  const h = r.pricer.header;
  return {
    id: "pricer-pots",
    title: "Pot Computation",
    items: [
      { label: `Start ${r.underlyingLabel} Level`, value: h.startLevel, kind: "number", digits: 0 },
      { label: "Coupon", value: h.coupon, kind: "percent" },
      { label: "Option Expiry", value: h.expiry, kind: "date" },
      { label: "Mobilisation in Rupees", value: h.mobilisation, kind: "rupee", digits: 0 },
      { label: "Actual Inbuilt", value: h.actualInbuilt, kind: "percent" },
      { label: "Product Cost", value: h.productCost, kind: "percent" },
      { label: "Inbuilt in Rupees", value: h.inbuiltInr, kind: "rupee" },
      { label: "Transaction Cost in Rupees", value: h.transactionCostInr, kind: "rupee", digits: 0 },
      { label: "Net Mobilisation With NBFC in Rupees", value: h.nbfcAmount, kind: "rupee", digits: 0 },
      { label: "Premium in Rupees", value: h.premium, kind: "rupee", digits: 0 },
      { label: "NBFC Rate", value: h.nbfcRate, kind: "percent" },
      { label: "Premium Growth Rate", value: h.premiumRate, kind: "percent" },
      { label: "Tenor in Days", value: h.tenorDays, kind: "integer" },
      { label: "Maturity Payout in Rupees", value: h.payout, kind: "rupee", digits: 0 },
      { label: "Achieved Coupon", value: h.achievedCoupon, kind: "percent" },
      { label: "Delta in Contracts", value: h.delta, kind: "number", digits: 0 },
      { label: "Vega in Rupees", value: h.vega, kind: "rupee", digits: 0 },
      { label: "Rho in Rupees", value: h.rho, kind: "rupee", digits: 0 },
      { label: "Gamma in Contracts", value: h.gamma, kind: "number", digits: 4 },
      { label: "Internal Rate of Return", value: h.irr, kind: "percent" },
      { label: "Margin in Rupees", value: h.margin, kind: "rupee", digits: 0 },
    ],
  };
}

export function pricerPayoutTable(r: HedgingResult): KeyValueSpec {
  const h = r.pricer.header;
  return {
    id: "pricer-payout",
    title: "Payout Construction",
    items: [
      { label: "Total Coupon", value: h.coupon, kind: "percent", digits: 1 },
      ...h.spreadPayouts.map((p, j): Item => ({ label: `Payout From Spread ${j + 1}`, value: p, kind: "percent", digits: 3 })),
      { label: "Decay", value: r.inputs.decay, kind: "number" },
      { label: "Protection Till", value: deriveTerms(r.inputs).protection, kind: "percent", digits: 0 },
      { label: "Loss At The Protection Point", value: h.protectionLoss, kind: "percent", digits: 1 },
    ],
  };
}

type Field<T> = { label: string; kind: CellKind; digits?: number; pick: (l: T, r: HedgingResult) => CellValue };

/** Pricer column A, rows 18 to 62, in sheet order. Shared by the leg grid and the Day 1 price grids. */
const OPTION_FIELDS: Array<Field<OptionPricing>> = [
  { label: "Underlying", kind: "text", pick: (_l, r) => r.underlyingLabel },
  { label: "Strike", kind: "number", digits: 0, pick: (l) => l.strike },
  { label: "Maturity", kind: "date", pick: (l) => l.maturity },
  { label: "Upper Maturity", kind: "date", pick: (l) => l.upperMaturity },
  { label: "Lower Maturity", kind: "date", pick: (l) => l.lowerMaturity },
  { label: "Upper Forward", kind: "percent", digits: 4, pick: (l) => l.upperForward },
  { label: "Lower Forward", kind: "percent", digits: 4, pick: (l) => l.lowerForward },
  { label: "Option Type", kind: "text", pick: (l) => optionTypeLabel(l.optionType) },
  { label: "Valuation Date", kind: "date", pick: (l) => l.valuationDate },
  { label: "Spot Price", kind: "number", pick: (l) => l.spot },
  { label: "Forward Growth", kind: "percent", digits: 4, pick: (l) => l.forwardGrowth },
  { label: "Discount Yield", kind: "percent", digits: 4, pick: (l) => l.discountYield },
  { label: "Dividends", kind: "percent", digits: 4, pick: (l) => l.dividends },
  { label: "Forward", kind: "number", pick: (l) => l.forward },
  { label: "Volatility", kind: "percent", pick: (l) => l.volatility },
  { label: "Volatility Bump", kind: "percent", digits: 1, pick: (l) => l.volBump },
  { label: "Bid or Offer", kind: "text", pick: (l) => (l.bidOffer === "B" ? "Bid" : "Offer") },
  { label: "Price in Rupees", kind: "number", pick: (l) => l.price },
  { label: "Price as %", kind: "percent", pick: (l) => l.pricePercent },
];

const MARGIN_FIELDS: Array<Field<PricerLeg>> = [
  { label: "Incremental Margin", kind: "percent", digits: 1, pick: (l) => l.incrementalMargin },
  { label: "Incremental Margin Cost", kind: "percent", digits: 1, pick: (l) => l.incrementalMarginCost },
  { label: "Incremental Cost in Rupees", kind: "number", pick: (l) => l.incrementalCostInr },
  { label: "Incremental Margin Adjusted Price", kind: "number", pick: (l) => l.incrementalAdjustedPrice },
  { label: "Full Margin", kind: "percent", digits: 1, pick: (l) => l.fullMargin },
  { label: "Full Margin Cost", kind: "percent", digits: 1, pick: (l) => l.fullMarginCost },
  { label: "Full Cost in Rupees", kind: "number", pick: (l) => l.fullCostInr },
  { label: "Full Margin Adjusted Price", kind: "number", pick: (l) => l.fullAdjustedPrice },
  { label: "Spread", kind: "number", pick: (l) => l.units },
  { label: "Action", kind: "text", pick: (l) => l.action },
];

const GREEK_FIELDS: Array<Field<OptionPricing>> = [
  { label: "Delta", kind: "number", digits: 4, pick: (l) => l.delta },
  { label: "Gamma", kind: "greek", digits: 8, pick: (l) => l.gamma },
  { label: "Theta", kind: "number", digits: 4, pick: (l) => l.theta },
  { label: "Vega", kind: "number", digits: 4, pick: (l) => l.vega },
  { label: "Rho", kind: "number", digits: 4, pick: (l) => l.rho },
];

type BookRow = PricerLeg | HedgeRow;
const BOOK_FIELDS: Array<Field<BookRow>> = [
  { label: "Contracts", kind: "number", pick: (l) => l.contracts },
  { label: "Option Value in Rupees", kind: "rupee", digits: 0, pick: (l) => l.optionValue },
  { label: "Delta in Rupees", kind: "rupee", digits: 0, pick: (l) => l.deltaInr },
  { label: "Delta in Contracts", kind: "number", pick: (l) => l.deltaContracts },
  { label: "Gamma in Contracts", kind: "number", digits: 4, pick: (l) => l.gammaContracts },
  { label: "Theta in Rupees", kind: "rupee", digits: 0, pick: (l) => l.thetaInr },
  { label: "Vega in Rupees", kind: "rupee", digits: 0, pick: (l) => l.vegaInr },
  { label: "Rho in Rupees", kind: "rupee", digits: 0, pick: (l) => l.rhoInr },
];

export const PRICER_FIELDS: Array<Field<PricerLeg>> = [...OPTION_FIELDS, ...MARGIN_FIELDS, ...GREEK_FIELDS, ...BOOK_FIELDS];

export function pricerGrid(r: HedgingResult): GridSpec {
  const legs = r.pricer.legs;
  const groups = r.structure.strikes.map((s, b) => ({
    label: strikeLabel(s.percent, s.strike),
    span: legs.filter((l) => l.blockIndex === b).length,
  }));
  return {
    id: "pricer-legs",
    title: "Leg Grid",
    note: `${legs.length} live legs: ${r.structure.strikes.length} strikes by ${r.schedule.expiries.length} expiries. The sheet keeps the book in two identical halves, so book totals count every leg twice.`,
    corner: ["Strike", "Expiry"],
    groups,
    columnLabels: legs.map((l) => formatDate(l.maturity)),
    columnKeys: legs.map((l) => `${l.blockIndex}-${l.expiryIndex}`),
    rows: PRICER_FIELDS.map((f) => ({
      label: f.label,
      kind: f.kind,
      digits: f.digits,
      values: legs.map((l) => f.pick(l, r)),
      overridden: f.label === "Volatility" ? legs.map((l) => l.volOverridden) : undefined,
    })),
  };
}

// ------------------------------------------------------------------ Product Description

export function termSheet(r: HedgingResult): KeyValueSpec {
  const i = r.inputs;
  const u = r.underlyingLabel;
  const terms = deriveTerms(i);
  const items: Item[] = [
    { label: "Underlying", value: u, kind: "text" },
    { label: "Notional", value: `${fmtCrore(i.notionalCr)} Cr`, kind: "text" },
    { label: "Trade Date", value: i.valuationDate, kind: "date" },
    { label: "Maturity Date", value: r.schedule.maturityDate, kind: "date" },
    { label: "Tenor", value: `${fmtNumber(i.tenorDays, 0)} Days`, kind: "text" },
    { label: `Start ${u} Level`, value: r.structure.startLevel, kind: "number", digits: 0 },
    { label: "Maximum Coupon", value: i.coupon, kind: "percent" },
    { label: `Target ${u} Rise`, value: terms.target, kind: "percent", digits: 0 },
  ];
  terms.spreads.forEach((s, j) => {
    items.push({
      label: `Spread ${j + 1}`,
      value: `${fmtPercent(s.buy, 0)} To ${fmtPercent(s.sell, 0)} At ${fmtNumber(s.participation, 2)} Times`,
      kind: "text",
    });
  });
  items.push(
    { label: "Capital Protection", value: `Down To ${fmtPercent(-terms.protection, 0)}`, kind: "text" },
    { label: "Downside Decay", value: `${fmtNumber(i.decay, 2)} Times Below Protection`, kind: "text" },
    { label: "Decay Floor", value: `${fmtPercent(terms.floorLevel, 0)} Of Start Level`, kind: "text" },
    { label: "Option Type", value: optionTypeLabel(i.optionType), kind: "text" },
    { label: "Observation Expiries", value: r.schedule.expiries.map((d) => formatDate(d)).join(", "), kind: "text" },
    { label: "Client Internal Rate of Return", value: r.productDescription.irr, kind: "percent" },
  );
  return { id: "pd-term-sheet", title: "Term Sheet", items };
}

export function productTables(r: HedgingResult): {
  termSheet: KeyValueSpec;
  details: KeyValueSpec;
  maturity: KeyValueSpec;
  greeks: KeyValueSpec;
  rates: KeyValueSpec;
  payoff: TableSpec;
} {
  const d = r.productDescription;
  const u = r.underlyingLabel;
  const g = d.greeks;
  return {
    termSheet: termSheet(r),
    details: {
      id: "pd-details",
      title: "Product Details",
      items: [
        { label: "Initial Investment in Crore", value: d.initialInvestment, kind: "crore" },
        { label: "Inbuilt in Crore", value: d.inbuiltCr, kind: "crore" },
        { label: "Issuance Cost in Crore", value: d.issuanceCostCr, kind: "crore" },
        { label: "Transaction Cost in Crore", value: d.transactionCostCr, kind: "crore" },
        { label: "Margin in Crore", value: d.marginCr, kind: "crore" },
        { label: "Amount With NBFC in Crore", value: d.nbfcCr, kind: "crore" },
        { label: "Premium in Crore", value: d.premiumCr, kind: "crore" },
      ],
    },
    maturity: {
      id: "pd-maturity",
      title: "Maturity Details",
      items: [
        { label: "Tenor in Days", value: d.tenorDays, kind: "integer" },
        { label: "NBFC Growth Rate", value: d.nbfcRate, kind: "percent" },
        { label: "Final Amount With NBFC in Crore", value: d.finalNbfcCr, kind: "crore" },
        { label: "Premium Growth Rate", value: d.premiumRate, kind: "percent" },
        { label: "Final Premium in Crore", value: d.finalPremiumCr, kind: "crore" },
        { label: "Margin Growth Rate", value: d.marginRate, kind: "percent" },
        { label: "Final Margin in Crore", value: d.finalMarginCr, kind: "crore" },
        { label: "Maturity Amount in Crore", value: d.maturityCr, kind: "crore" },
        { label: "Internal Rate of Return", value: d.irr, kind: "percent" },
      ],
    },
    // Product Description H31:H40, then Leverage in H44 and the target level
    greeks: {
      id: "pd-greeks",
      title: "Greek Details",
      items: [
        { label: "Delta", value: g.deltaPercent, kind: "number" },
        { label: "Total Delta Required", value: g.totalDelta, kind: "number", digits: 0 },
        { label: "Options Quantity Required For Vega Hedge", value: g.hedgeQuantity, kind: "number" },
        { label: "Options Premium Received in Crore", value: g.hedgePremiumCr, kind: "crore" },
        { label: "Options Delta", value: g.optionsDelta, kind: "number", digits: 0 },
        { label: "Residual Futures To Be Done", value: g.residualFutures, kind: "number", digits: 0 },
        { label: "Weighted Average Volatility", value: g.vegaWeightedVol, kind: "percent" },
        { label: "Vega in Crore", value: g.vegaCr, kind: "crore" },
        { label: "Weighted Average Forward", value: g.rhoWeightedForward, kind: "percent" },
        { label: "Rho in Crore", value: g.rhoCr, kind: "crore" },
        { label: "Leverage", value: g.leverage, kind: "number" },
        { label: "Target Level", value: g.targetLevel, kind: "percent", digits: 0 },
      ],
      note: "Residual Futures To Be Done is Total Delta Required less Options Delta. The hedge quantity is negative because the options are sold.",
    },
    rates: {
      id: "pd-rates",
      title: "Weighted Average Rates",
      items: [
        { label: "Weighted Average Annual Compounding Rate", value: d.weightedCompRate, kind: "percent" },
        { label: "Weighted Average Half Yearly Compounding Rate", value: d.weightedHalfYearlyRate, kind: "percent" },
        { label: "Weighted Average Quarterly Compounding Rate", value: d.weightedQuarterlyRate, kind: "percent" },
      ],
      note: "Weighted by the amounts with the NBFC and in margin, as the sheet does.",
    },
    payoff: {
      id: "pd-payoff",
      title: "Payoff Scenarios",
      columns: [
        pct("performance", `${u} Performance`),
        pct("clientReturn", "Client Return"),
        cr("maturityValue", "Maturity Value in Crore"),
        pct("irr", "Pre Tax Internal Rate of Return"),
      ],
      rows: d.payoff.map((p) => ({
        performance: p.performance,
        clientReturn: p.clientReturn,
        maturityValue: p.maturityValueCr,
        irr: p.preTaxIrr,
      })),
      highlightRow: d.payoff.findIndex((p) => p.performance === 0),
    },
  };
}

// ------------------------------------------------------------------ Day 1 Vega Hedge

export function vegaHedgeInputs(r: HedgingResult): KeyValueSpec {
  const i = r.inputs;
  const u = r.underlyingLabel;
  const fair = r.dayOneVegaHedge.fair[0];
  return {
    id: "d1-inputs",
    title: "Hedge Inputs",
    items: [
      { label: `${u} Spot`, value: i.spot, kind: "number" },
      { label: "Hedge Strike", value: i.hedgeStrike, kind: "number", digits: 0 },
      { label: "Option Expiry", value: r.summary.hedgeExpiry, kind: "date" },
      { label: "Option Type", value: optionTypeLabel(i.optionType), kind: "text" },
      { label: fair?.volOverridden ? "Fair Volatility · Overridden" : "Fair Volatility · Surface", value: fair?.volatility ?? null, kind: "percent" },
      { label: `${u} Daily Volatility`, value: i.dailyVol, kind: "percent", digits: 3 },
      { label: `${u} Annual Volatility`, value: r.summary.annualVol, kind: "percent" },
      { label: "Exchange Price Forward Rate", value: i.exchangeForwardRate, kind: "percent" },
      { label: "Exchange Price Discount Rate", value: i.exchangeDiscountRate, kind: "percent" },
      { label: "Stressed Price Forward Rate", value: i.stressedForwardRate, kind: "percent" },
      { label: "Stressed Price Discount Rate", value: i.stressedDiscountRate, kind: "percent" },
      { label: "Shock Sigmas", value: i.stressSigmas, kind: "number", digits: 0 },
      { label: "Shock Days", value: i.stressDays, kind: "number", digits: 0 },
      { label: "Volatility Multiplier", value: i.stressVolMultiplier, kind: "number" },
      { label: "Exposure Margin", value: i.exposureMargin, kind: "percent" },
    ],
  };
}

export function vegaHedgeMarginTable(r: HedgingResult): TableSpec {
  const rows = r.dayOneVegaHedge.margin;
  return {
    id: "d1-margin",
    title: "Margin Computation",
    note: "Initial Margin is the stressed less the exchange price, plus the fair price less the Day 1 fair price, on the sold quantity. Exposure Margin is the exposure rate on the level and quantity.",
    columns: [
      num("level", r.underlyingLabel, 0),
      pct("move", "Move", 0),
      num("strike", "Strike", 0),
      date("expiry", "Expiry"),
      num("quantity", "Quantity"),
      num("dayOne", "Day 1 Fair Price"),
      cr("premium", "Premium in Crore"),
      num("exchange", "Exchange Price"),
      num("stressed", "Stressed Price"),
      num("fair", "Fair Price"),
      cr("initial", "Initial Margin in Crore"),
      cr("exposure", "Exposure Margin in Crore"),
      cr("total", "Total Margin in Crore"),
    ],
    rows: rows.map((m) => ({
      level: m.level,
      move: m.move,
      strike: m.strike,
      expiry: m.expiry,
      quantity: m.quantity,
      dayOne: m.dayOneFairPrice,
      premium: m.premiumCr,
      exchange: m.exchangePrice,
      stressed: m.stressedPrice,
      fair: m.fairPrice,
      initial: m.initialMarginCr,
      exposure: m.exposureMarginCr,
      total: m.totalMarginCr,
    })),
    highlightRow: rows.findIndex((m) => m.move === 0),
  };
}

const HEDGE_FIELDS: Array<Field<HedgeRow>> = [...OPTION_FIELDS, ...GREEK_FIELDS, ...BOOK_FIELDS];

/** Fair, exchange and stressed price grids: one row per move, the Pricer row set as columns. */
export function vegaHedgePriceTable(r: HedgingResult, block: "fair" | "exchange" | "stressed"): TableSpec {
  const rows: HedgeRow[] = r.dayOneVegaHedge[block];
  const title =
    block === "fair" ? "Fair Price Computation" : block === "exchange" ? "Exchange Price Computation" : "Stressed Price Computation";
  const note =
    block === "fair"
      ? "Volatility is read from the surface at the hedge strike and expiry, unless it is overridden."
      : block === "exchange"
        ? "Priced at the flat annual volatility and the exchange forward and discount rates."
        : `Spot is shocked down by ${r.inputs.stressSigmas} daily sigmas over ${r.inputs.stressDays} days and volatility is scaled by ${r.inputs.stressVolMultiplier}.`;
  const fieldKey = (k: number) => `f${k}`;
  return {
    id: `d1-${block}`,
    title,
    note,
    columns: [pct("move", "Move", 0), ...HEDGE_FIELDS.map((f, k) => ({ key: fieldKey(k), label: f.label, kind: f.kind, digits: f.digits }))],
    rows: rows.map((h) => ({ move: h.move, ...Object.fromEntries(HEDGE_FIELDS.map((f, k) => [fieldKey(k), f.pick(h, r)])) })),
    highlightRow: rows.findIndex((h) => h.move === 0),
  };
}

// ------------------------------------------------------------------ Mark to Market and Margin

export function marginTable(r: HedgingResult): TableSpec {
  const rows: MarginRow[] = r.markToMarket.rows;
  return {
    id: "mtm",
    title: "Mark to Market and Margin Requirement",
    note: `Futures Margin is ${fmtPercent(r.inputs.futuresMargin, 1)} of the notional value of the residual futures. The 0% row is the margin funded in the Pricer.`,
    columns: [
      num("level", r.underlyingLabel, 0),
      pct("move", "Move", 0),
      num("product", "Product Requirement in Lakh", 4),
      num("option", "Option Delta in Lakh", 4),
      num("residual", "Residual Futures in Lakh", 4),
      cr("futures", "Futures Margin in Crore"),
      cr("mtm", "Mark to Market in Crore"),
      cr("options", "Options Margin in Crore"),
      cr("total", "Total of Futures Margin, Mark to Market and Options Margin"),
    ],
    rows: rows.map((m) => ({
      level: m.level,
      move: m.move,
      product: m.productRequirementLakh,
      option: m.optionDeltaLakh,
      residual: m.residualFuturesLakh,
      futures: m.futuresMarginCr,
      mtm: m.markToMarketCr,
      options: m.optionsMarginCr,
      total: m.totalRequirementCr,
    })),
    highlightRow: rows.findIndex((m) => m.move === 0),
  };
}
