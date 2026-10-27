import { formatDate } from "@/lib/engine/dates";
import type { HedgeRow, HedgingResult, MarginRow, PricerLeg } from "@/lib/engine/types";

/** How a value is shown on screen and written to Excel. */
export type CellKind = "crore" | "rupee" | "percent" | "number" | "integer" | "date" | "text" | "greek";

export type CellValue = number | string | null;

export type Column = {
  key: string;
  label: string;
  kind: CellKind;
  digits?: number;
  /** Column group label, shown in a band above the header. */
  group?: string;
};

export type TableSpec = {
  id: string;
  title: string;
  note?: string;
  columns: Column[];
  rows: Array<Record<string, CellValue>>;
  /** Index of a row to highlight, such as the 0 percent move. */
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

/** A Pricer style grid: one row per field, one column per leg, grouped by strike. */
export type GridSpec = {
  id: string;
  title: string;
  note?: string;
  groups: Array<{ label: string; span: number }>;
  columnLabels: string[];
  rows: Array<{ label: string; kind: CellKind; digits?: number; values: CellValue[] }>;
};

const pct = (key: string, label: string, digits = 2, group?: string): Column => ({ key, label, kind: "percent", digits, group });
const cr = (key: string, label: string, digits = 2, group?: string): Column => ({ key, label, kind: "crore", digits, group });
const num = (key: string, label: string, digits = 2, group?: string): Column => ({ key, label, kind: "number", digits, group });
const int = (key: string, label: string): Column => ({ key, label, kind: "integer" });
const date = (key: string, label: string): Column => ({ key, label, kind: "date" });
const text = (key: string, label: string): Column => ({ key, label, kind: "text" });
const rupee = (key: string, label: string, digits = 2): Column => ({ key, label, kind: "rupee", digits });
const greek = (key: string, label: string, digits = 6): Column => ({ key, label, kind: "greek", digits });

// ------------------------------------------------------------------ Summary Sheet

export function summaryTables(r: HedgingResult): { blocks: Array<TableSpec | KeyValueSpec> } {
  const u = r.underlyingLabel;
  const i = r.inputs;
  const s = r.summary;
  const parts = r.structure.spreadParticipations;

  const specColumns: Column[] = [pct("target", `Target ${u} Rise`, 2), pct("coupon", "Coupon"), pct("inbuilt", "Actual Inbuilt"), pct("irr", "Internal Rate of Return")];
  const specRow: Record<string, CellValue> = {
    target: i.target,
    coupon: i.coupon,
    inbuilt: s.actualInbuilt,
    irr: s.irr,
  };
  i.spreads.forEach((sp, j) => {
    const sell = j === i.spreads.length - 1 ? i.target : sp.sell;
    specColumns.push(pct(`buy${j}`, `Spread ${j + 1} Buy Level`), pct(`sell${j}`, `Spread ${j + 1} Sell Level`), num(`part${j}`, `Spread ${j + 1} Participation Rate`, 2));
    specRow[`buy${j}`] = sp.buy;
    specRow[`sell${j}`] = sell;
    specRow[`part${j}`] = parts[j] ?? null;
  });
  specColumns.push(pct("protection", "Protection"), num("decay", "Decay", 2), int("tenor", "Tenor in Days"), pct("margin", "Margin"));
  Object.assign(specRow, { protection: i.protection, decay: i.decay, tenor: i.tenorDays, margin: s.margin });

  const expiryColumns: Column[] = r.schedule.expiries.map((_, k) => date(`e${k}`, `Expiry ${k + 1}`));
  const expiryRow = Object.fromEntries(r.schedule.expiries.map((d, k) => [`e${k}`, d]));

  const legRows: Array<Record<string, CellValue>> = s.legs.map((l) => ({
    strike: l.strike,
    strikePercent: l.strikePercent / 100,
    option: l.optionType === "P" ? "Put" : "Call",
    units: l.units,
    quantity: l.quantityLakh,
    price: l.averagePrice,
    premium: l.premiumCr,
  }));
  legRows.push({ strike: null, strikePercent: null, option: "Total", units: null, quantity: null, price: null, premium: s.totalPremiumCr });

  return {
    blocks: [
      {
        id: "market",
        title: "Market and Rates",
        items: [
          { label: "Valuation Date", value: i.valuationDate, kind: "date" },
          { label: `${u} Spot`, value: i.spot, kind: "number", digits: 2 },
          { label: `${u} Derived Spot`, value: i.spot, kind: "number", digits: 2 },
          { label: "NBFC Rate", value: i.nbfcRate, kind: "percent" },
          { label: "Premium Growth Rate", value: i.premiumRate, kind: "percent" },
          { label: "Margin Growth Rate", value: i.marginGrowthRate, kind: "percent" },
        ],
      },
      { id: "spec", title: `${u} Accelerator Product Specification`, columns: specColumns, rows: [specRow] },
      { id: "expiries", title: "Final Expiries", columns: expiryColumns, rows: [expiryRow] },
      {
        id: "greeks",
        title: "Product Greeks",
        columns: [
          cr("notional", "Notional in Crore"),
          date("expiry", "Option Expiry"),
          num("deltaQty", "Delta Quantity", 0),
          pct("deltaPct", "Delta Percent", 1),
          pct("vol", "Vega Weighted Volatility"),
          pct("absVol", "Absolute Vega Weighted Volatility"),
          cr("vega", "Vega in Crore"),
          pct("rhoFwd", "Rho Weighted Forward Growth"),
          cr("rho", "Rho in Crore"),
        ],
        rows: [
          {
            notional: i.notionalCr,
            expiry: s.optionExpiry,
            deltaQty: s.deltaContracts,
            deltaPct: s.deltaPercent,
            vol: s.vegaWeightedVol,
            absVol: s.absVegaWeightedVol,
            vega: s.vegaCr,
            rhoFwd: s.rhoWeightedForward,
            rho: s.rhoCr,
          },
        ],
        note: "Vega Weighted Volatility follows the workbook and weights by signed vega, so long and short legs offset and it is not a tradable volatility. Absolute Vega Weighted Volatility weights by the size of each leg's vega.",
      },
      {
        id: "costs",
        title: "Costs",
        columns: [pct("tc", "Transaction Cost"), pct("ic", "Issuance Cost"), pct("mc", "Margin Cost"), pct("pc", "Product Cost")],
        rows: [{ tc: i.transactionCost, ic: i.issuanceCost, mc: i.marginCost, pc: r.pricer.header.productCost }],
        note: "Product Cost is the total of Transaction Cost, Issuance Cost and Margin Cost.",
      },
      {
        id: "options",
        title: `Options Details For ₹${i.notionalCr} Crore`,
        note: `Expiries: ${r.schedule.expiries.map((d) => formatDate(d)).join(", ")}`,
        columns: [
          num("strike", "Strike", 0),
          pct("strikePercent", "Strike Percent", 0),
          text("option", "Option"),
          num("units", "Units", 2),
          num("quantity", "Quantity in Lakh", 2),
          num("price", "Average Price", 0),
          cr("premium", "Premium in Crore"),
        ],
        rows: legRows,
        totalRow: legRows.length - 1,
      },
      {
        id: "hedge",
        title: `Day 1 Vega Hedge For ₹${i.notionalCr} Crore`,
        columns: [
          num("strike", "Strike", 0),
          date("expiry", "Expiry"),
          text("option", "Option"),
          num("quantity", "Quantity in Lakh", 2),
          num("price", "Price", 2),
          cr("premium", "Premium in Crore"),
          num("delta", "Delta", 4),
        ],
        rows: [
          {
            strike: s.hedgeStrike,
            expiry: s.hedgeExpiry,
            option: "Put",
            quantity: s.hedgeQuantityLakh,
            price: s.hedgePrice,
            premium: s.hedgePremiumCr,
            delta: s.hedgeDelta,
          },
        ],
      },
      {
        id: "vol",
        title: "Volatility and Margin",
        items: [
          { label: `${u} Daily Volatility`, value: i.dailyVol, kind: "percent", digits: 3 },
          { label: `${u} Annual Volatility`, value: s.annualVol, kind: "percent" },
          { label: "Exposure Margin", value: i.exposureMargin, kind: "percent" },
        ],
      },
    ],
  };
}

// ------------------------------------------------------------------ Pricer

export function pricerHeaderTable(r: HedgingResult): TableSpec {
  const h = r.pricer.header;
  const u = r.underlyingLabel;
  return {
    id: "pricer-header",
    title: "Pot Computation",
    columns: [
      num("start", `Start ${u} Level`, 0),
      pct("coupon", "Coupon"),
      date("expiry", "Hedge Expiry"),
      rupee("mob", "Mobilisation", 0),
      pct("ib", "Actual Inbuilt"),
      pct("pc", "Product Cost"),
      rupee("ibInr", "Inbuilt in Rupees", 2),
      rupee("tcInr", "Transaction Cost in Rupees", 0),
      rupee("nbfc", "Net Mobilisation With NBFC", 0),
      rupee("prem", "Premium", 0),
      pct("nbfcRate", "NBFC Rate"),
      pct("premRate", "Premium Growth Rate"),
      int("tenor", "Tenor in Days"),
      rupee("payout", "Maturity Payout", 0),
      pct("coup2", "Achieved Coupon"),
      num("delta", "Delta in Contracts", 0),
      rupee("vega", "Vega in Rupees", 0),
      rupee("rho", "Rho in Rupees", 0),
      num("gamma", "Gamma in Contracts", 4),
      pct("irr", "Internal Rate of Return"),
      rupee("margin", "Margin in Rupees", 0),
    ],
    rows: [
      {
        start: h.startLevel,
        coupon: h.coupon,
        expiry: h.expiry,
        mob: h.mobilisation,
        ib: h.actualInbuilt,
        pc: h.productCost,
        ibInr: h.inbuiltInr,
        tcInr: h.transactionCostInr,
        nbfc: h.nbfcAmount,
        prem: h.premium,
        nbfcRate: h.nbfcRate,
        premRate: h.premiumRate,
        tenor: h.tenorDays,
        payout: h.payout,
        coup2: h.achievedCoupon,
        delta: h.delta,
        vega: h.vega,
        rho: h.rho,
        gamma: h.gamma,
        irr: h.irr,
        margin: h.margin,
      },
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
      ...h.spreadPayouts.map((p, j) => ({ label: `Payout From Spread ${j + 1}`, value: p, kind: "percent" as const, digits: 3 })),
      { label: "Decay", value: r.inputs.decay, kind: "number" as const, digits: 2 },
      { label: "Protection Till", value: r.inputs.protection, kind: "percent" as const, digits: 0 },
      { label: "Loss At The Protection Point", value: h.protectionLoss, kind: "percent" as const, digits: 1 },
    ],
  };
}

type LegField = { label: string; kind: CellKind; digits?: number; pick: (l: PricerLeg, r: HedgingResult) => CellValue };

export const PRICER_FIELDS: LegField[] = [
  { label: "Strike Percent", kind: "number", digits: 1, pick: (l) => l.strikePercent },
  { label: "Underlying", kind: "text", pick: (_l, r) => r.underlyingLabel },
  { label: "Strike", kind: "number", digits: 0, pick: (l) => l.strike },
  { label: "Maturity", kind: "date", pick: (l) => l.maturity },
  { label: "Upper Maturity", kind: "date", pick: (l) => l.upperMaturity },
  { label: "Lower Maturity", kind: "date", pick: (l) => l.lowerMaturity },
  { label: "Upper Forward", kind: "percent", pick: (l) => l.upperForward },
  { label: "Lower Forward", kind: "percent", pick: (l) => l.lowerForward },
  { label: "Call or Put", kind: "text", pick: (l) => (l.optionType === "P" ? "Put" : "Call") },
  { label: "Valuation Date", kind: "date", pick: (l) => l.valuationDate },
  { label: "Spot Price", kind: "number", digits: 0, pick: (l) => l.spot },
  { label: "Forward Growth", kind: "percent", digits: 4, pick: (l) => l.forwardGrowth },
  { label: "Discount Yield", kind: "percent", digits: 4, pick: (l) => l.discountYield },
  { label: "Dividends", kind: "percent", digits: 4, pick: (l) => l.dividends },
  { label: "Forward", kind: "number", digits: 0, pick: (l) => l.forward },
  { label: "Volatility", kind: "percent", pick: (l) => l.volatility },
  { label: "Volatility Bump", kind: "percent", digits: 1, pick: (l) => l.volBump },
  { label: "Bid or Offer", kind: "text", pick: (l) => (l.bidOffer === "B" ? "Bid" : "Offer") },
  { label: "Price in Rupees", kind: "number", digits: 2, pick: (l) => l.price },
  { label: "Price as Percent", kind: "percent", pick: (l) => l.pricePercent },
  { label: "Incremental Margin", kind: "percent", digits: 1, pick: (l) => l.incrementalMargin },
  { label: "Incremental Margin Cost", kind: "percent", digits: 1, pick: (l) => l.incrementalMarginCost },
  { label: "Incremental Cost in Rupees", kind: "number", digits: 2, pick: (l) => l.incrementalCostInr },
  { label: "Incremental Margin Adjusted Price", kind: "number", digits: 2, pick: (l) => l.incrementalAdjustedPrice },
  { label: "Full Margin", kind: "percent", digits: 1, pick: (l) => l.fullMargin },
  { label: "Full Margin Cost", kind: "percent", digits: 1, pick: (l) => l.fullMarginCost },
  { label: "Full Cost in Rupees", kind: "number", digits: 2, pick: (l) => l.fullCostInr },
  { label: "Full Margin Adjusted Price", kind: "number", digits: 2, pick: (l) => l.fullAdjustedPrice },
  { label: "Spread Units", kind: "number", digits: 2, pick: (l) => l.units },
  { label: "Action", kind: "text", pick: (l) => l.action },
  { label: "Delta", kind: "number", digits: 4, pick: (l) => l.delta },
  { label: "Gamma", kind: "greek", digits: 8, pick: (l) => l.gamma },
  { label: "Theta", kind: "number", digits: 4, pick: (l) => l.theta },
  { label: "Vega", kind: "number", digits: 4, pick: (l) => l.vega },
  { label: "Rho", kind: "number", digits: 4, pick: (l) => l.rho },
  { label: "Contracts", kind: "number", digits: 2, pick: (l) => l.contracts },
  { label: "Option Value in Rupees", kind: "rupee", digits: 0, pick: (l) => l.optionValue },
  { label: "Delta in Rupees", kind: "rupee", digits: 0, pick: (l) => l.deltaInr },
  { label: "Delta in Contracts", kind: "number", digits: 2, pick: (l) => l.deltaContracts },
  { label: "Gamma in Contracts", kind: "number", digits: 4, pick: (l) => l.gammaContracts },
  { label: "Theta in Rupees", kind: "rupee", digits: 0, pick: (l) => l.thetaInr },
  { label: "Vega in Rupees", kind: "rupee", digits: 0, pick: (l) => l.vegaInr },
  { label: "Rho in Rupees", kind: "rupee", digits: 0, pick: (l) => l.rhoInr },
];

export function pricerGrid(r: HedgingResult): GridSpec {
  const legs = r.pricer.legs;
  const groups = r.structure.strikes.map((s, b) => ({
    label: `${s.percent} Percent Strike`,
    span: legs.filter((l) => l.blockIndex === b).length,
  }));
  return {
    id: "pricer-legs",
    title: "Leg Grid",
    note: `The workbook keeps two identical halves of this grid. Each column shows one half; book totals include both halves.`,
    groups,
    columnLabels: legs.map((l) => `Expiry ${l.expiryIndex + 1}`),
    rows: PRICER_FIELDS.map((f) => ({ label: f.label, kind: f.kind, digits: f.digits, values: legs.map((l) => f.pick(l, r)) })),
  };
}

// ------------------------------------------------------------------ Product Description

export function productTables(r: HedgingResult): { details: KeyValueSpec; maturity: KeyValueSpec; greeks: KeyValueSpec; rates: KeyValueSpec; payoff: TableSpec } {
  const d = r.productDescription;
  const u = r.underlyingLabel;
  const g = d.greeks;
  return {
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
    greeks: {
      id: "pd-greeks",
      title: "Greek Details For The Product",
      items: [
        { label: "Delta", value: g.deltaPercent, kind: "number", digits: 2 },
        { label: "Total Delta Required", value: g.totalDelta, kind: "number", digits: 0 },
        { label: "Options Quantity Required For Vega Hedge", value: g.hedgeQuantity, kind: "number", digits: 0 },
        { label: "Options Premium Received in Crore", value: g.hedgePremiumCr, kind: "crore" },
        { label: "Options Delta", value: g.optionsDelta, kind: "number", digits: 0 },
        { label: "Residual Futures To Be Done", value: g.residualFutures, kind: "number", digits: 0 },
        { label: "Vega Weighted Volatility", value: g.vegaWeightedVol, kind: "percent" },
        { label: "Vega in Crore", value: g.vegaCr, kind: "crore" },
        { label: "Rho Weighted Forward Growth", value: g.rhoWeightedForward, kind: "percent" },
        { label: "Rho in Crore", value: g.rhoCr, kind: "crore" },
        { label: "Leverage", value: g.leverage, kind: "number", digits: 2 },
        { label: "Target Level", value: g.targetLevel, kind: "percent", digits: 0 },
      ],
    },
    rates: {
      id: "pd-rates",
      title: "Weighted Average Rates Of NBFC and Margin",
      items: [
        { label: "Weighted Average Annual Compounding Rate", value: d.weightedCompRate, kind: "percent" },
        { label: "Weighted Average Half Yearly Compounding Rate", value: d.weightedHalfYearlyRate, kind: "percent" },
        { label: "Weighted Average Quarterly Compounding Rate", value: d.weightedQuarterlyRate, kind: "percent" },
      ],
    },
    payoff: {
      id: "pd-payoff",
      title: "Product Payoff",
      columns: [
        pct("performance", `${u} Performance`),
        pct("clientReturn", "Client Return"),
        cr("maturityValue", "Maturity Value in Crore"),
        pct("irr", "Pre Tax Internal Rate of Return"),
        text("description", "Description"),
      ],
      rows: d.payoff.map((p) => ({
        performance: p.performance,
        clientReturn: p.clientReturn,
        maturityValue: p.maturityValueCr,
        irr: p.preTaxIrr,
        description: p.description,
      })),
      highlightRow: d.payoff.findIndex((p) => p.performance === 0),
    },
  };
}

// ------------------------------------------------------------------ Day 1 Vega Hedge

export function vegaHedgeInputs(r: HedgingResult): KeyValueSpec {
  const i = r.inputs;
  const u = r.underlyingLabel;
  return {
    id: "d1-inputs",
    title: "Hedge Inputs",
    items: [
      { label: `${u} Spot`, value: i.spot, kind: "number", digits: 2 },
      { label: "Strike", value: i.hedgeStrike, kind: "number", digits: 0 },
      { label: "Expiry", value: r.summary.hedgeExpiry, kind: "date" },
      { label: `${u} Daily Volatility`, value: i.dailyVol, kind: "percent", digits: 3 },
      { label: `${u} Annual Volatility`, value: r.summary.annualVol, kind: "percent" },
      { label: "Exchange Price Forward Rate", value: i.exchangeForwardRate, kind: "percent" },
      { label: "Exchange Price Discount Rate", value: i.exchangeDiscountRate, kind: "percent" },
      { label: "Stressed Price Forward Rate", value: i.stressedForwardRate, kind: "percent" },
      { label: "Stressed Price Discount Rate", value: i.stressedDiscountRate, kind: "percent" },
      { label: "Exposure Margin", value: i.exposureMargin, kind: "percent" },
    ],
  };
}

export function vegaHedgeMarginTable(r: HedgingResult): TableSpec {
  const u = r.underlyingLabel;
  const rows = r.dayOneVegaHedge.margin;
  return {
    id: "d1-margin",
    title: "Margin Computation",
    columns: [
      num("level", u, 0),
      pct("move", "Percent Move", 0),
      num("strike", "Strike", 0),
      date("expiry", "Expiry"),
      num("quantity", "Quantity", 2),
      num("dayOne", "Day 1 Fair Price", 2),
      cr("premium", "Premium in Crore"),
      num("exchange", "Exchange Price", 2),
      num("stressed", "Stressed Price", 2),
      num("fair", "Fair Price", 2),
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

export function vegaHedgePriceTable(r: HedgingResult, block: "fair" | "exchange" | "stressed"): TableSpec {
  const u = r.underlyingLabel;
  const rows: HedgeRow[] = r.dayOneVegaHedge[block];
  const title =
    block === "fair" ? "Fair Price Computation" : block === "exchange" ? "Exchange Price Computation" : "Stressed Price Computation";
  const note =
    block === "fair"
      ? "Volatility is read from the surface at the hedge strike and expiry."
      : block === "exchange"
        ? "Priced at the flat annual volatility and the exchange forward and discount rates."
        : `Spot is shocked down by ${r.inputs.stressSigmas} daily sigmas over ${r.inputs.stressDays} days and volatility is scaled by ${r.inputs.stressVolMultiplier}.`;
  return {
    id: `d1-${block}`,
    title,
    note,
    columns: [
      date("valuationDate", "Valuation Date"),
      pct("move", `${u} Performance`, 0),
      num("spot", "Spot Price", 2),
      num("strike", "Strike", 0),
      date("maturity", "Maturity"),
      text("callPut", "Call or Put"),
      num("price", "Price in Rupees", 2),
      num("delta", "Delta", 5),
      num("vega", "Vega", 4),
      num("contracts", "Contracts", 2),
      rupee("vegaInr", "Vega in Rupees", 0),
      num("deltaContracts", "Delta in Contracts", 2),
      pct("vol", "Volatility"),
      pct("growth", "Forward Growth", 4),
      pct("discount", "Discount Yield", 4),
      text("underlying", "Underlying"),
      pct("dividends", "Dividends", 4),
      num("forward", "Forward", 2),
      pct("volBump", "Volatility Bump", 1),
      text("bidOffer", "Bid or Offer"),
      pct("pricePct", "Price as Percent"),
      greek("gamma", "Gamma", 8),
      num("theta", "Theta", 4),
      num("rho", "Rho", 4),
      rupee("optionValue", "Option Value in Rupees", 0),
      rupee("deltaInr", "Delta in Rupees", 0),
      num("gammaContracts", "Gamma in Contracts", 4),
      rupee("thetaInr", "Theta in Rupees", 0),
      rupee("rhoInr", "Rho in Rupees", 0),
      date("upperMaturity", "Upper Maturity"),
      date("lowerMaturity", "Lower Maturity"),
      pct("upperForward", "Upper Forward"),
      pct("lowerForward", "Lower Forward"),
    ],
    rows: rows.map((h) => ({
      valuationDate: h.valuationDate,
      move: h.move,
      spot: h.spot,
      strike: h.strike,
      maturity: h.maturity,
      callPut: h.optionType === "P" ? "Put" : "Call",
      price: h.price,
      delta: h.delta,
      vega: h.vega,
      contracts: h.contracts,
      vegaInr: h.vegaInr,
      deltaContracts: h.deltaContracts,
      vol: h.volatility,
      growth: h.forwardGrowth,
      discount: h.discountYield,
      underlying: u,
      dividends: h.dividends,
      forward: h.forward,
      volBump: h.volBump,
      bidOffer: h.bidOffer === "B" ? "Bid" : "Offer",
      pricePct: h.pricePercent,
      gamma: h.gamma,
      theta: h.theta,
      rho: h.rho,
      optionValue: h.optionValue,
      deltaInr: h.deltaInr,
      gammaContracts: h.gammaContracts,
      thetaInr: h.thetaInr,
      rhoInr: h.rhoInr,
      upperMaturity: h.upperMaturity,
      lowerMaturity: h.lowerMaturity,
      upperForward: h.upperForward,
      lowerForward: h.lowerForward,
    })),
    highlightRow: rows.findIndex((h) => h.move === 0),
  };
}

// ------------------------------------------------------------------ Mark to Market and Margin

export function marginTable(r: HedgingResult): TableSpec {
  const u = r.underlyingLabel;
  const rows: MarginRow[] = r.markToMarket.rows;
  return {
    id: "mtm",
    title: "Mark to Market and Margin Requirement",
    note: `Futures Margin in Crore takes a margin requirement of ${(r.inputs.futuresMargin * 100).toFixed(1)} percent on the notional value of futures. The workbook margin uses the 0 percent row.`,
    columns: [
      num("level", u, 0),
      pct("move", "Percent Move", 0),
      num("product", "Product Requirement in Lakh", 4),
      num("option", "Option Delta in Lakh", 4),
      num("residual", "Residual Futures in Lakh", 4),
      cr("futures", "Futures Margin in Crore", 2, "A"),
      cr("mtm", "Mark to Market in Crore", 2, "B"),
      cr("options", "Options Margin in Crore", 2, "C"),
      cr("total", "Total of Futures Margin, Mark to Market and Options Margin", 2, "A Plus B Plus C"),
      num("deltaChange", "Delta Change in Lakh", 4, "Helper Columns"),
      cr("step", "Step Mark to Market in Crore", 2, "Helper Columns"),
      pct("totalPct", "Total Requirement as Percent of Notional", 2, "Helper Columns"),
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
      deltaChange: m.deltaChangeLakh,
      step: m.stepMarkToMarketCr,
      totalPct: m.totalRequirementPercent,
    })),
    highlightRow: rows.findIndex((m) => m.move === 0),
  };
}
