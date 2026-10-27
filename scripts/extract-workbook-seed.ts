/**
 * Reads the saved workbook (cached values) and writes:
 *   lib/data/vol-surface-seed.json
 *   lib/data/pricing-params-seed.json
 *   lib/data/workbook-defaults.json
 *   lib/data/workbook-parity.json
 *
 * Usage: npx tsx scripts/extract-workbook-seed.ts [path-to-xlsm]
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_BOOK = path.join(ROOT, "Hedging Sheet 5y Accelerator_Aug26_Approval_.xlsm");
const FALLBACK_BOOK = path.join(ROOT, ".scratch", "hs.xlsm");
const OUT_DIR = path.join(ROOT, "lib", "data");

type Cell = string | number | boolean | null;

function readBook(): XLSX.WorkBook {
  const arg = process.argv[2];
  const candidates = [arg, DEFAULT_BOOK, FALLBACK_BOOK].filter(Boolean) as string[];
  for (const file of candidates) {
    try {
      const buffer = fs.readFileSync(file);
      console.log(`[extract] reading ${path.basename(file)}`);
      return XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: false });
    } catch (err) {
      console.warn(`[extract] could not read ${file}: ${(err as Error).message}`);
    }
  }
  throw new Error("Workbook not found. Pass the .xlsm path as the first argument.");
}

const wb = readBook();

function sheet(name: string): XLSX.WorkSheet {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet missing: ${name}`);
  return ws;
}

function v(ws: XLSX.WorkSheet, addr: string): Cell {
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell || cell.v == null) return null;
  if (cell.t === "e") return null;
  if (cell.t === "s" && String(cell.v) === "") return null;
  return cell.v as Cell;
}

function num(ws: XLSX.WorkSheet, addr: string): number | null {
  const x = v(ws, addr);
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function str(ws: XLSX.WorkSheet, addr: string): string | null {
  const x = v(ws, addr);
  return x == null ? null : String(x);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Excel serial → YYYY-MM-DD (1900 date system). Zero or blank is null. */
function serialToIso(serial: number | null): string | null {
  if (serial == null || !Number.isFinite(serial) || serial < 1) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function date(ws: XLSX.WorkSheet, addr: string): string | null {
  return serialToIso(num(ws, addr));
}

function colName(index1: number): string {
  let n = index1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

const summary = sheet("Summary Sheet");
const pricer = sheet("Pricer");
const market = sheet("MarketData");
const params = sheet("Pricing Params");
const product = sheet("Product Description");
const day1 = sheet("Day1 Vega Hedge");
const mtm = sheet("MTM & Margin req");

// ---------------------------------------------------------------- vol surface
const moneyness: number[] = [];
for (let c = colIndex("E"); c <= colIndex("X"); c++) {
  const m = num(market, `${colName(c)}1`);
  if (m != null) moneyness.push(Math.round(m * 10000) / 10000);
}
const expiries: string[] = [];
const volsPercent: number[][] = [];
for (let r = 3; r <= 40; r++) {
  const d = date(market, `C${r}`);
  if (!d) break;
  expiries.push(`${d}T00:00:00.000Z`);
  const row: number[] = [];
  for (let c = colIndex("D"); c <= colIndex("X"); c++) row.push(num(market, `${colName(c)}${r}`) ?? 0);
  volsPercent.push(row);
}
const referenceSensexPrice = num(market, "N2") ?? 0;

type ParamRow = {
  date: string;
  volBump: number;
  volBidOffer: number;
  incMargin: number;
  fullMargin: number;
  marginCost: number;
  fwdSellRate: number;
};
const paramRows: ParamRow[] = [];
for (let r = 2; r <= 400; r++) {
  const d = date(params, `B${r}`);
  if (!d) {
    if (paramRows.length) break;
    continue;
  }
  paramRows.push({
    date: `${d}T00:00:00.000Z`,
    volBump: num(params, `C${r}`) ?? 0,
    volBidOffer: num(params, `D${r}`) ?? 0,
    incMargin: num(params, `E${r}`) ?? 0,
    fullMargin: num(params, `F${r}`) ?? 0,
    marginCost: num(params, `G${r}`) ?? 0,
    fwdSellRate: num(params, `H${r}`) ?? 0,
  });
}

// Rate curve: MarketData B26:D64. D32:D34 are links to the Premium Growth Rate.
const rateCurve: Array<{ date: string; ratePercent: number; linkedToPremiumRate: boolean }> = [];
const premiumRate = num(summary, "C5") ?? 0;
for (let r = 26; r <= 64; r++) {
  const d = date(market, `B${r}`);
  if (!d) continue;
  const rate = num(market, `D${r}`) ?? 0;
  rateCurve.push({
    date: `${d}T00:00:00.000Z`,
    ratePercent: rate,
    linkedToPremiumRate: r >= 32 && r <= 34,
  });
}

const dividends: Array<{ date: string; amount: number }> = [];
for (let r = 26; r <= 1204; r++) {
  const d = date(market, `I${r}`);
  if (!d) continue;
  dividends.push({ date: `${d}T00:00:00.000Z`, amount: num(market, `J${r}`) ?? 0 });
}

// The Forward Sell Rate typed most recently (H69); later rows are links to it.
const forwardSellRate = num(params, "H69") ?? 0;

const pricingParamsSeed = {
  source: "Pricing Params and MarketData sheets of the saved workbook",
  forwardSellRate,
  premiumRateSpread: Number((premiumRate - forwardSellRate).toFixed(10)),
  rateCapBuyingForward: num(params, "N2") ?? 0,
  dividendBidOfferMultiplier: num(params, "M2") ?? 1,
  rows: paramRows,
  rateCurve,
  dividends,
};

// ---------------------------------------------------------------- defaults
const valuationDate = date(summary, "C2")!;
const [vy, vm] = valuationDate.split("-").map(Number) as [number, number];
const expiryDates: string[] = [];
for (const c of ["C", "D", "E", "F", "G", "H", "I", "J"]) {
  const d = date(summary, `${c}12`);
  if (d) expiryDates.push(d);
}
const expiryMonths = expiryDates.map((d) => {
  const [y, m] = d.split("-").map(Number) as [number, number];
  return (y - vy) * 12 + (m - vm);
});

const defaults = {
  underlying: "Sensex",
  valuationDate,
  spot: num(summary, "C3"),
  derivedSpot: num(summary, "D3"),
  startLevelUplift: 0.006,
  startLevelRounding: 100,
  nbfcRate: num(summary, "C4"),
  premiumRate,
  marginGrowthRate: num(summary, "C6"),
  target: num(summary, "C10"),
  coupon: num(summary, "D10"),
  spreads: [
    { buy: num(summary, "G10"), sell: num(summary, "H10"), participation: num(summary, "K10") },
    { buy: num(summary, "I10"), sell: num(summary, "J10"), participation: num(summary, "L10") },
  ],
  protection: num(summary, "M10"),
  decay: num(summary, "N10"),
  tenorDays: num(summary, "O10"),
  expiryDates,
  expiryMonths,
  hedgeExpiry: date(summary, "D15"),
  strikePercents: ["G23", "G24", "G25", "G26", "G27", "G28"].map((a) => num(summary, a)),
  outflowWidth: 0.01,
  floorLevel: (num(pricer, "AP17") ?? 70) / 100,
  floorUnits: num(pricer, "AP47"),
  notionalCr: num(summary, "C15"),
  transactionCost: num(summary, "C18"),
  issuanceCost: num(summary, "D18"),
  marginCost: num(summary, "E18"),
  hedgeStrike: num(summary, "H23"),
  hedgeOptionType: str(summary, "J23"),
  dailyVol: num(summary, "I25"),
  annualVol: num(summary, "I26"),
  exposureMargin: num(day1, "M6"),
  futuresMargin: num(mtm, "H2"),
  exchangeForwardRate: num(day1, "I2"),
  exchangeDiscountRate: num(day1, "I3"),
  stressedForwardRate: num(day1, "L2"),
  stressedDiscountRate: num(day1, "L3"),
  stressSigmas: 6,
  stressDays: 2,
  stressVolMultiplier: 1.25,
  scenarioMoves: Array.from({ length: 15 }, (_, i) => num(mtm, `D${6 + i}`)),
};

// ---------------------------------------------------------------- parity
const PRICER_ROWS: Record<number, string> = {
  17: "strikePercent",
  19: "strike",
  20: "maturity",
  21: "upperMaturity",
  22: "lowerMaturity",
  23: "upperForward",
  24: "lowerForward",
  25: "callPut",
  26: "valuationDate",
  27: "spot",
  28: "forwardGrowth",
  29: "discountYield",
  30: "dividends",
  31: "forward",
  32: "volatility",
  33: "volBump",
  34: "bidOffer",
  35: "price",
  36: "pricePercent",
  38: "incrementalMargin",
  39: "incrementalMarginCost",
  40: "incrementalCostInr",
  41: "incrementalAdjustedPrice",
  43: "fullMargin",
  44: "fullMarginCost",
  45: "fullCostInr",
  46: "fullAdjustedPrice",
  47: "units",
  48: "action",
  49: "delta",
  50: "gamma",
  51: "theta",
  52: "vega",
  53: "rho",
  55: "contracts",
  56: "optionValue",
  57: "deltaInr",
  58: "deltaContracts",
  59: "gammaContracts",
  60: "thetaInr",
  61: "vegaInr",
  62: "rhoInr",
};
const DATE_KEYS = new Set(["maturity", "upperMaturity", "lowerMaturity", "valuationDate"]);

const pricerColumns: Array<Record<string, Cell>> = [];
for (let c = colIndex("B"); c <= colIndex("CS"); c++) {
  const letters = colName(c);
  const record: Record<string, Cell> = { column: letters };
  for (const [rowText, key] of Object.entries(PRICER_ROWS)) {
    const addr = `${letters}${rowText}`;
    record[key] = DATE_KEYS.has(key) ? date(pricer, addr) : v(pricer, addr);
  }
  pricerColumns.push(record);
}

const pricerHeader: Record<string, Cell> = {};
const HEADER_CELLS: Record<string, string> = {
  B5: "startLevel",
  C5: "coupon",
  E5: "mobilisation",
  F5: "actualInbuilt",
  G5: "productCost",
  H5: "inbuiltInr",
  I5: "transactionCostInr",
  J5: "nbfcAmount",
  K5: "premium",
  L5: "nbfcRate",
  M5: "premiumRate",
  N5: "tenorDays",
  O5: "payout",
  P5: "achievedCoupon",
  Q5: "delta",
  R5: "vega",
  S5: "rho",
  T5: "gamma",
  U5: "irr",
  V5: "margin",
  K7: "deltaLakh",
  C13: "spreadOnePayout",
  C14: "spreadTwoPayout",
  E14: "protectionLoss",
};
for (const [addr, key] of Object.entries(HEADER_CELLS)) pricerHeader[key] = v(pricer, addr);
pricerHeader.expiry = date(pricer, "D5");

const summaryParity = {
  actualInbuilt: num(summary, "E10"),
  irr: num(summary, "F10"),
  spreadTwoParticipation: num(summary, "L10"),
  margin: num(summary, "Q10"),
  optionExpiry: date(summary, "D15"),
  deltaContracts: num(summary, "E15"),
  deltaPercent: num(summary, "F15"),
  vegaWeightedVol: num(summary, "G15"),
  vegaCr: num(summary, "H15"),
  rhoWeightedForward: num(summary, "I15"),
  rhoCr: num(summary, "J15"),
  legs: [23, 24, 25, 26, 27, 28].map((r) => ({
    strike: num(summary, `B${r}`),
    optionType: str(summary, `C${r}`),
    quantityLakh: num(summary, `D${r}`),
    averagePrice: num(summary, `E${r}`),
    premiumCr: num(summary, `F${r}`),
    strikePercent: num(summary, `G${r}`),
  })),
  totalPremiumCr: num(summary, "F29"),
  hedgeStrike: num(summary, "H23"),
  hedgeExpiry: date(summary, "I23"),
  hedgeQuantityLakh: num(summary, "K23"),
  hedgePrice: num(summary, "L23"),
  hedgePremiumCr: num(summary, "M23"),
  hedgeDelta: num(summary, "M24"),
};

const productParity = {
  initialInvestment: num(product, "D31"),
  inbuiltCr: num(product, "D32"),
  issuanceCostCr: num(product, "D33"),
  transactionCostCr: num(product, "D34"),
  marginCr: num(product, "D35"),
  nbfcCr: num(product, "D36"),
  premiumCr: num(product, "D37"),
  tenorDays: num(product, "D41"),
  nbfcRate: num(product, "D42"),
  finalNbfcCr: num(product, "D43"),
  premiumRate: num(product, "D44"),
  finalPremiumCr: num(product, "D45"),
  marginRate: num(product, "D46"),
  finalMarginCr: num(product, "D47"),
  maturityCr: num(product, "D48"),
  irr: num(product, "D49"),
  weightedCompRate: num(product, "O28"),
  weightedHalfYearlyRate: num(product, "P28"),
  weightedQuarterlyRate: num(product, "Q28"),
  greeks: {
    deltaPercent: num(product, "H31"),
    totalDelta: num(product, "H32"),
    hedgeQuantity: num(product, "H33"),
    hedgePremiumCr: num(product, "H34"),
    optionsDelta: num(product, "H35"),
    residualFutures: num(product, "H36"),
    vegaWeightedVol: num(product, "H37"),
    vegaCr: num(product, "H38"),
    rhoWeightedForward: num(product, "H39"),
    rhoCr: num(product, "H40"),
    leverage: num(product, "H44"),
    targetLevel: num(product, "H45"),
  },
  payoff: Array.from({ length: 22 }, (_, i) => ({
    performance: num(product, `J${32 + i}`),
    clientReturn: num(product, `K${32 + i}`),
    preTaxIrr: num(product, `L${32 + i}`),
  })),
};

const DAY1_BLOCK_COLS: Record<string, string> = {
  B: "valuationDate",
  C: "performance",
  D: "spot",
  E: "strike",
  F: "maturity",
  G: "callPut",
  H: "price",
  I: "delta",
  J: "vega",
  K: "contracts",
  L: "vegaInr",
  M: "deltaContracts",
  N: "volatility",
  O: "forwardGrowth",
  P: "discountYield",
  Q: "underlying",
  R: "dividends",
  S: "forward",
  T: "volBump",
  U: "bidOffer",
  V: "pricePercent",
  W: "gamma",
  X: "theta",
  Y: "rho",
  Z: "optionValue",
  AA: "deltaInr",
  AB: "gammaContracts",
  AC: "thetaInr",
  AD: "rhoInr",
  AE: "upperMaturity",
  AF: "lowerMaturity",
  AG: "upperForward",
  AH: "lowerForward",
};
const DAY1_DATE_KEYS = new Set(["valuationDate", "maturity", "upperMaturity", "lowerMaturity"]);

function day1Block(startRow: number): Array<Record<string, Cell>> {
  const rows: Array<Record<string, Cell>> = [];
  for (let r = startRow; r < startRow + 15; r++) {
    const rec: Record<string, Cell> = {};
    for (const [col, key] of Object.entries(DAY1_BLOCK_COLS)) {
      rec[key] = DAY1_DATE_KEYS.has(key) ? date(day1, `${col}${r}`) : v(day1, `${col}${r}`);
    }
    rows.push(rec);
  }
  return rows;
}

const day1Margin = Array.from({ length: 15 }, (_, i) => {
  const r = 8 + i;
  return {
    level: num(day1, `B${r}`),
    move: num(day1, `C${r}`),
    strike: num(day1, `D${r}`),
    expiry: date(day1, `E${r}`),
    quantity: num(day1, `F${r}`),
    dayOneFairPrice: num(day1, `G${r}`),
    premiumCr: num(day1, `H${r}`),
    exchangePrice: num(day1, `I${r}`),
    stressedPrice: num(day1, `J${r}`),
    fairPrice: num(day1, `K${r}`),
    initialMarginCr: num(day1, `L${r}`),
    exposureMarginCr: num(day1, `M${r}`),
    totalMarginCr: num(day1, `N${r}`),
  };
});

const mtmRows = Array.from({ length: 15 }, (_, i) => {
  const r = 6 + i;
  return {
    level: num(mtm, `C${r}`),
    move: num(mtm, `D${r}`),
    productRequirementLakh: num(mtm, `E${r}`),
    optionDeltaLakh: num(mtm, `F${r}`),
    residualFuturesLakh: num(mtm, `G${r}`),
    futuresMarginCr: num(mtm, `H${r}`),
    markToMarketCr: num(mtm, `I${r}`),
    optionsMarginCr: num(mtm, `J${r}`),
    totalRequirementCr: num(mtm, `K${r}`),
    deltaChangeLakh: num(mtm, `O${r}`),
    stepMarkToMarketCr: num(mtm, `P${r}`),
    totalRequirementPercent: num(mtm, `R${r}`),
  };
});

const parity = {
  source: "Hedging Sheet 5y Accelerator_Aug26_Approval_.xlsm cached values",
  summary: summaryParity,
  pricer: { header: pricerHeader, columns: pricerColumns },
  productDescription: productParity,
  dayOneVegaHedge: {
    margin: day1Margin,
    fair: day1Block(26),
    exchange: day1Block(44),
    stressed: day1Block(62),
  },
  markToMarket: mtmRows,
};

// ---------------------------------------------------------------- nifty anchor
async function niftyAnchor(): Promise<{ nifty: number | null; asOf: string | null }> {
  // The workbook only carries the Sensex 100 percent anchor. Nifty mode uses the Nifty close
  // on the session whose Sensex close is nearest that anchor in the month before the trade date.
  const end = Math.floor(Date.UTC(vy, vm - 1, 6) / 1000);
  const start = end - 60 * 86_400;
  async function closes(symbol: string): Promise<Map<string, number>> {
    for (const host of ["query1.finance.yahoo.com", "query2.finance.yahoo.com"]) {
      try {
        const res = await fetch(
          `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${start}&period2=${end}`,
          { headers: { "User-Agent": "Mozilla/5.0 Hedging-Sheet/1.0" } },
        );
        if (!res.ok) continue;
        const json = (await res.json()) as {
          chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
        };
        const result = json.chart?.result?.[0];
        const ts = result?.timestamp ?? [];
        const cl = result?.indicators?.quote?.[0]?.close ?? [];
        const out = new Map<string, number>();
        ts.forEach((t, i) => {
          const c = cl[i];
          if (c == null || !Number.isFinite(c)) return;
          const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(t * 1000));
          out.set(ymd, Math.round(c * 100) / 100);
        });
        return out;
      } catch {
        continue;
      }
    }
    return new Map();
  }
  const [sensex, nifty] = await Promise.all([closes("^BSESN"), closes("^NSEI")]);
  let best: { day: string; gap: number } | null = null;
  for (const [day, close] of sensex) {
    if (!nifty.has(day)) continue;
    const gap = Math.abs(close - referenceSensexPrice);
    if (!best || gap < best.gap) best = { day, gap };
  }
  if (!best) return { nifty: null, asOf: null };
  return { nifty: nifty.get(best.day) ?? null, asOf: best.day };
}

async function main() {
  const anchor = await niftyAnchor();
  if (anchor.nifty == null) console.warn("[extract] Yahoo Nifty anchor unavailable; Nifty uses the live spot as anchor.");
  else console.log(`[extract] Nifty anchor ${anchor.nifty} from ${anchor.asOf}`);

  const monthKey = valuationDate.slice(0, 7);
  const monthName = new Date(Date.UTC(vy, vm - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });
  const volSeed = {
    monthKey,
    label: `${monthName} ${vy} Volatility Surface`,
    deepStrike: 500,
    moneyness,
    strikes: [500, ...moneyness],
    expiries,
    volsPercent,
    pricingParams: paramRows.map((p) => ({
      date: p.date,
      volBump: p.volBump,
      fwdSellRate: p.fwdSellRate,
      incMargin: p.incMargin,
      fullMargin: p.fullMargin,
      marginCost: p.marginCost,
    })),
    referenceUnderlyingPrice: anchor.nifty ?? undefined,
    referenceSensexPrice,
    niftyAnchorAsOf: anchor.asOf ?? undefined,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name: string, data: unknown) => {
    fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
    console.log(`[extract] wrote lib/data/${name}`);
  };
  write("vol-surface-seed.json", volSeed);
  write("pricing-params-seed.json", pricingParamsSeed);
  write("workbook-defaults.json", defaults);
  write("workbook-parity.json", parity);
}

void main();
