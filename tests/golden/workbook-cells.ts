import { clientReturn, deriveTerms, preTaxIrr } from "@/lib/engine/structure";
import type { HedgeMarginRow, HedgeRow, HedgingResult, MarginRow, PricerLeg } from "@/lib/engine/types";

type Value = number | string | null | undefined;
/** "price" values compare to 1e-4 absolute; everything else to 1e-6 relative. */
export type CellKind = "value" | "price";
export type CellRead = { value: Value; kind: CellKind };

const COLUMN = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

export function splitAddress(address: string): { col: number; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(address);
  if (!m) throw new Error(`Bad cell address ${address}`);
  return { col: COLUMN(m[1]!), row: Number(m[2]) };
}

const v = (value: Value, kind: CellKind = "value"): CellRead => ({ value, kind });

/** Pricer rows 17 to 62, one column per leg. */
const PRICER_ROWS: Record<number, (l: PricerLeg) => CellRead> = {
  17: (l) => v(l.strikePercent),
  19: (l) => v(l.strike),
  20: (l) => v(l.maturity),
  23: (l) => v(l.upperForward),
  24: (l) => v(l.lowerForward),
  25: (l) => v(l.optionType),
  26: (l) => v(l.valuationDate),
  27: (l) => v(l.spot),
  28: (l) => v(l.forwardGrowth),
  29: (l) => v(l.discountYield),
  30: (l) => v(l.dividends),
  31: (l) => v(l.forward, "price"),
  32: (l) => v(l.volatility),
  33: (l) => v(l.volBump),
  34: (l) => v(l.bidOffer),
  35: (l) => v(l.price, "price"),
  36: (l) => v(l.pricePercent),
  38: (l) => v(l.incrementalMargin),
  39: (l) => v(l.incrementalMarginCost),
  40: (l) => v(l.incrementalCostInr, "price"),
  41: (l) => v(l.incrementalAdjustedPrice, "price"),
  43: (l) => v(l.fullMargin),
  44: (l) => v(l.fullMarginCost),
  45: (l) => v(l.fullCostInr, "price"),
  46: (l) => v(l.fullAdjustedPrice, "price"),
  47: (l) => v(l.units),
  48: (l) => v(l.action),
  49: (l) => v(l.delta),
  50: (l) => v(l.gamma, "price"),
  51: (l) => v(l.theta, "price"),
  52: (l) => v(l.vega, "price"),
  53: (l) => v(l.rho, "price"),
  55: (l) => v(l.contracts),
  56: (l) => v(l.optionValue, "price"),
  57: (l) => v(l.deltaInr, "price"),
  58: (l) => v(l.deltaContracts),
  59: (l) => v(l.gammaContracts, "price"),
  60: (l) => v(l.thetaInr, "price"),
  61: (l) => v(l.vegaInr, "price"),
  62: (l) => v(l.rhoInr, "price"),
};

/**
 * Day1 Vega Hedge rows 26 to 76, columns B to AD, in the order of the row 25 header. Columns AE to AH and
 * Pricer rows 21 and 22 are the rate curve brackets: the workbook's curve carries fixed 2025 dates, the engine
 * anchors its tenors at the trade date. The discount yield they feed equals the Premium Rate in both, and matches.
 */
export const CURVE_BRACKET_CELLS = "Pricer rows 21 and 22, Day1 Vega Hedge columns AE to AH";

const HEDGE_COLUMNS: Array<(h: HedgeRow, r: HedgingResult) => CellRead> = [
  (h) => v(h.valuationDate),
  (h) => v(h.move),
  (h) => v(h.spot, "price"),
  (h) => v(h.strike),
  (h) => v(h.maturity),
  (h) => v(h.optionType),
  (h) => v(h.price, "price"),
  (h) => v(h.delta),
  (h) => v(h.vega, "price"),
  (h) => v(h.contracts),
  (h) => v(h.vegaInr, "price"),
  (h) => v(h.deltaContracts),
  (h) => v(h.volatility),
  (h) => v(h.forwardGrowth),
  (h) => v(h.discountYield),
  (_h, r) => v(r.underlyingLabel),
  (h) => v(h.dividends),
  (h) => v(h.forward, "price"),
  (h) => v(h.volBump),
  (h) => v(h.bidOffer),
  (h) => v(h.pricePercent),
  (h) => v(h.gamma, "price"),
  (h) => v(h.theta, "price"),
  (h) => v(h.rho, "price"),
  (h) => v(h.optionValue, "price"),
  (h) => v(h.deltaInr, "price"),
  (h) => v(h.gammaContracts, "price"),
  (h) => v(h.thetaInr, "price"),
  (h) => v(h.rhoInr, "price"),
];

/** Day1 Vega Hedge rows 8 to 22, columns B to N. */
const HEDGE_MARGIN_COLUMNS: Array<(m: HedgeMarginRow) => CellRead> = [
  (m) => v(m.level, "price"),
  (m) => v(m.move),
  (m) => v(m.strike),
  (m) => v(m.expiry),
  (m) => v(m.quantity),
  (m) => v(m.dayOneFairPrice, "price"),
  (m) => v(m.premiumCr),
  (m) => v(m.exchangePrice, "price"),
  (m) => v(m.stressedPrice, "price"),
  (m) => v(m.fairPrice, "price"),
  (m) => v(m.initialMarginCr),
  (m) => v(m.exposureMarginCr),
  (m) => v(m.totalMarginCr),
];

/** MTM And Margin rows 6 to 20, by column letter. */
const MARGIN_COLUMNS: Record<string, (m: MarginRow) => CellRead> = {
  C: (m) => v(m.level, "price"),
  D: (m) => v(m.move),
  E: (m) => v(m.productRequirementLakh),
  F: (m) => v(m.optionDeltaLakh),
  G: (m) => v(m.residualFuturesLakh),
  H: (m) => v(m.futuresMarginCr),
  I: (m) => v(m.markToMarketCr),
  J: (m) => v(m.optionsMarginCr),
  K: (m) => v(m.totalRequirementCr),
  O: (m) => v(m.deltaChangeLakh),
  P: (m) => v(m.stepMarkToMarketCr),
  R: (m) => v(m.totalRequirementPercent),
};

function pricerCell(r: HedgingResult, col: number, row: number): CellRead | undefined {
  const h = r.pricer.header;
  if (row === 1 && col === 2) return v(r.inputs.valuationDate);
  if (row === 2 && col === 2) return v(r.inputs.spot);
  if (row === 5) {
    const header: Array<CellRead> = [
      v(h.startLevel),
      v(h.coupon),
      v(h.expiry),
      v(h.mobilisation, "price"),
      v(h.actualInbuilt),
      v(h.productCost),
      v(h.inbuiltInr, "price"),
      v(h.transactionCostInr, "price"),
      v(h.nbfcAmount, "price"),
      v(h.premium, "price"),
      v(h.nbfcRate),
      v(h.premiumRate),
      v(h.tenorDays),
      v(h.payout, "price"),
      v(h.achievedCoupon),
      v(h.delta),
      v(h.vega, "price"),
      v(h.rho, "price"),
      v(h.gamma, "price"),
      v(h.irr),
      v(h.margin, "price"),
    ];
    return header[col - 2];
  }
  if (col === 2 && row === 8) return v(r.inputs.transactionCost);
  if (col === 2 && row === 9) return v(r.inputs.issuanceCost);
  if (col === 2 && row === 10) return v(r.inputs.marginCost);
  if (row >= 12 && row <= 14 && (col === 3 || col === 5)) {
    const pays = h.spreadPayouts;
    const map: Record<string, CellRead> = {
      "3:12": v(r.inputs.coupon),
      "5:12": v(r.inputs.decay),
      "3:13": v(pays[0]),
      "5:13": v(1 - r.structure.strikes.find((s) => s.roles.includes("protection"))!.percent / 100),
      "3:14": v(pays[1]),
      "5:14": v(h.protectionLoss),
    };
    return map[`${col}:${row}`];
  }
  const read = PRICER_ROWS[row];
  if (!read || col < 2 || col > 97) return undefined;
  const local = (col - 2) % 48;
  const leg = r.pricer.legs.find((l) => l.blockIndex === Math.floor(local / 8) && l.expiryIndex === local % 8);
  return leg ? read(leg) : undefined;
}

function summaryCell(r: HedgingResult, col: number, row: number): CellRead | undefined {
  const s = r.summary;
  const terms = deriveTerms(r.inputs);
  const key = `${col}:${row}`;
  const fixed: Record<string, CellRead> = {
    "3:2": v(r.inputs.valuationDate),
    "3:3": v(r.inputs.spot),
    "4:3": v(r.inputs.spot),
    "3:4": v(r.inputs.nbfcRate),
    "3:5": v(r.inputs.premiumRate),
    "3:6": v(r.inputs.marginGrowthRate),
    "3:10": v(r.productDescription.greeks.targetLevel),
    "4:10": v(r.inputs.coupon),
    "5:10": v(s.actualInbuilt),
    "6:10": v(s.irr),
    "7:10": v(terms.spreads[0]?.buy),
    "8:10": v(terms.spreads[0]?.sell),
    "9:10": v(terms.spreads[1]?.buy),
    "10:10": v(terms.spreads[1]?.sell),
    "11:10": v(terms.spreads[0]?.participation),
    "12:10": v(terms.spreads[1]?.participation),
    "13:10": v(terms.protection),
    "14:10": v(r.inputs.decay),
    "15:10": v(r.inputs.tenorDays),
    "16:10": v(terms.spreads[0] ? terms.spreads[0].sell - terms.spreads[0].buy : undefined),
    "17:10": v(s.margin),
    "3:15": v(r.inputs.notionalCr),
    "4:15": v(s.optionExpiry),
    "5:15": v(s.deltaContracts),
    "6:15": v(s.deltaPercent),
    "7:15": v(s.vegaWeightedVol),
    "8:15": v(s.vegaCr),
    "9:15": v(s.rhoWeightedForward),
    "10:15": v(s.rhoCr),
    "8:23": v(s.hedgeStrike),
    "9:23": v(s.hedgeExpiry),
    "11:23": v(s.hedgeQuantityLakh),
    "12:23": v(s.hedgePrice, "price"),
    "13:23": v(s.hedgePremiumCr),
    "13:24": v(s.hedgeDelta),
    "6:29": v(s.totalPremiumCr),
    "10:29": v(r.inputs.exposureMargin * 100),
    "3:18": v(r.inputs.transactionCost),
    "4:18": v(r.inputs.issuanceCost),
    "5:18": v(r.inputs.marginCost),
    "9:25": v(r.inputs.dailyVol),
    "9:26": v(s.annualVol),
  };
  if (fixed[key]) return fixed[key];
  if (row === 12 && col >= 3) return r.schedule.expiries[col - 3] ? v(r.schedule.expiries[col - 3]) : undefined;
  if (row >= 23 && row <= 28) {
    const leg = s.legs[row - 23];
    if (!leg) return undefined;
    const cols: Record<number, CellRead> = {
      2: v(leg.strike),
      3: v(leg.optionType),
      4: v(leg.quantityLakh),
      5: v(leg.averagePrice, "price"),
      6: v(leg.premiumCr),
      7: v(leg.strikePercent),
    };
    return cols[col];
  }
  return undefined;
}

function descriptionCell(r: HedgingResult, col: number, row: number): CellRead | undefined {
  const d = r.productDescription;
  const g = d.greeks;
  const fixed: Record<string, CellRead> = {
    "15:28": v(d.weightedCompRate),
    "16:28": v(d.weightedHalfYearlyRate),
    "17:28": v(d.weightedQuarterlyRate),
    "4:31": v(d.initialInvestment),
    "8:31": v(g.deltaPercent),
    "4:32": v(d.inbuiltCr),
    "5:32": v(r.summary.actualInbuilt),
    "4:33": v(d.issuanceCostCr),
    "5:33": v(r.inputs.issuanceCost),
    "4:34": v(d.transactionCostCr),
    "5:34": v(r.inputs.transactionCost),
    "4:35": v(d.marginCr),
    "4:36": v(d.nbfcCr),
    "4:37": v(d.premiumCr),
    "8:32": v(g.totalDelta),
    "8:33": v(g.hedgeQuantity),
    "8:34": v(g.hedgePremiumCr),
    "8:35": v(g.optionsDelta),
    "8:36": v(g.residualFutures),
    "8:37": v(g.vegaWeightedVol),
    "8:38": v(g.vegaCr),
    "8:39": v(g.rhoWeightedForward),
    "8:40": v(g.rhoCr),
    "4:41": v(d.tenorDays),
    "4:42": v(d.nbfcRate),
    "4:43": v(d.finalNbfcCr),
    "4:44": v(d.premiumRate),
    "4:45": v(d.finalPremiumCr),
    "4:46": v(d.marginRate),
    "4:47": v(d.finalMarginCr),
    "4:48": v(d.maturityCr),
    "4:49": v(d.irr),
    "8:44": v(g.leverage),
    "8:45": v(g.targetLevel),
  };
  return fixed[`${col}:${row}`];
}

/** The payoff grid, Product Description J32 to L53: the engine's payoff at each performance the workbook lists. */
export function payoffCell(r: HedgingResult, performance: number, col: number): CellRead | undefined {
  const ret = clientReturn(r.inputs, performance);
  if (col === 11) return v(ret);
  if (col === 12) return v(preTaxIrr(ret, r.inputs.tenorDays));
  return undefined;
}

function hedgeCell(r: HedgingResult, col: number, row: number): CellRead | undefined {
  const d = r.dayOneVegaHedge;
  const fixed: Record<string, CellRead> = {
    "3:2": v(r.inputs.spot),
    "6:2": v(r.inputs.dailyVol),
    "3:3": v(r.inputs.hedgeStrike),
    "6:3": v(r.summary.annualVol),
    "3:4": v(r.summary.hedgeExpiry),
    "9:2": v(r.inputs.exchangeForwardRate),
    "9:3": v(r.inputs.exchangeDiscountRate),
    "12:2": v(r.inputs.stressedForwardRate),
    "12:3": v(r.inputs.stressedDiscountRate),
    "13:6": v(r.inputs.exposureMargin),
  };
  const key = `${col}:${row}`;
  if (fixed[key]) return fixed[key];
  const blocks: Array<[number, HedgeRow[]]> = [
    [26, d.fair],
    [44, d.exchange],
    [62, d.stressed],
  ];
  if (row >= 8 && row <= 22 && col >= 2 && col <= 14) {
    const m = d.margin[row - 8];
    return m ? HEDGE_MARGIN_COLUMNS[col - 2]!(m) : undefined;
  }
  for (const [start, rows] of blocks) {
    if (row >= start && row < start + 15 && col >= 2 && col <= 30) {
      const h = rows[row - start];
      return h ? HEDGE_COLUMNS[col - 2]!(h, r) : undefined;
    }
  }
  return undefined;
}

function marginCell(r: HedgingResult, col: number, row: number): CellRead | undefined {
  if (row === 2 && col === 8) return v(r.inputs.futuresMargin);
  if (row < 6 || row > 20) return undefined;
  const m = r.markToMarket.rows[row - 6];
  const letter = String.fromCharCode(64 + col);
  const read = MARGIN_COLUMNS[letter];
  return m && read ? read(m) : undefined;
}

/** The engine value for one saved workbook cell, or undefined for a label, a helper or an unused slot. */
export function engineCell(r: HedgingResult, sheet: string, address: string): CellRead | undefined {
  const { col, row } = splitAddress(address);
  switch (sheet) {
    case "Pricer":
      return pricerCell(r, col, row);
    case "Summary Sheet":
      return summaryCell(r, col, row);
    case "Product Description":
      return descriptionCell(r, col, row);
    case "Day1 Vega Hedge":
      return hedgeCell(r, col, row);
    case "MTM & Margin req":
      return marginCell(r, col, row);
    default:
      return undefined;
  }
}
