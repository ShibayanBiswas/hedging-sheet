import * as XLSX from "xlsx";

import { istTodayYmd } from "@/lib/engine/dates";
import type { BidOffer, DividendPoint, PricingParamPoint, PricingParams, RatePoint, VolSurface } from "@/lib/engine/types";
import { DEEP_STRIKE, DEFAULT_FWD_SELL_RATE, surfaceMonthLabel } from "@/lib/engine/vol-surface";

type Grid = (string | number | Date | null)[][];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function utcMidnightIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T00:00:00.000Z`;
}

/** Calendar date only; rounds SheetJS time-of-day artifacts to the Excel day. */
function excelDateToIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return utcMidnightIso(new Date(Math.round(v.getTime() / 86_400_000) * 86_400_000));
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return utcMidnightIso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000));
  }
  if (typeof v === "string" && v.trim()) {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return utcMidnightIso(new Date(Math.round(parsed.getTime() / 86_400_000) * 86_400_000));
  }
  return null;
}

/** Percents: 5.5 or 0.055 both mean 5.5 percent. */
function asFraction(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.abs(n) > 1 ? n / 100 : n;
}

/** Strike Change percents: 0.55, 55 and 150 all name a column. */
function asMoneyness(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 0.2 && n <= 2) return n;
  if (n >= 20 && n <= 200) return n / 100;
  return null;
}

function cellIsDate(v: unknown): boolean {
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === "number") return v > 20000 && v < 80000;
  if (typeof v === "string") return /\d{4}-\d{2}-\d{2}/.test(v) || /\d{1,2}[-/ ][A-Za-z]{3}/.test(v);
  return false;
}

function text(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function sheetGrid(wb: XLSX.WorkBook, name: string): Grid {
  return XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(wb.Sheets[name]!, { header: 1, defval: null, raw: true });
}

function findCol(row: unknown[], ...needles: string[]): number {
  return row.findIndex((cell) => {
    const h = text(cell);
    return h.length > 0 && needles.some((n) => h === n || h.includes(n));
  });
}

function positivePrice(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 10 ? n : undefined;
}

/** A Strike Change header cell, not a sentence that mentions it. */
function isStrikeHeader(label: string): boolean {
  return label === "strike" || (label.startsWith("strike change") && label.length <= 24);
}

function gridLooksLikeVolSurface(grid: Grid): boolean {
  return grid.slice(0, 25).some((row) => {
    const labels = (row ?? []).slice(0, 4).map(text);
    if (labels.some(isStrikeHeader)) return true;
    return (row ?? []).filter((cell) => asMoneyness(cell) != null).length >= 3;
  });
}

export type ParsedSurfaceUpload = {
  surface: VolSurface;
  params: Partial<PricingParams>;
};

/** Surface Parameters: key and value rows, a Date and Vol Bump table, or the native Pricing Params layout. */
function parseParameters(grid: Grid) {
  let volBump = 0;
  let fwdSellRate: number | undefined;
  let referenceUnderlyingPrice: number | undefined;
  let referenceSensexPrice: number | undefined;
  let rateCapBuyingForward: number | undefined;
  let dividendBidOfferMultiplier: number | undefined;
  let bidOffer: BidOffer | undefined;
  const pricingParams: PricingParamPoint[] = [];

  let tableHeader = -1;
  let dateCol = -1;
  let bumpCol = -1;
  let fwdCol = -1;
  let incCol = -1;
  let fullCol = -1;
  let costCol = -1;

  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const a = text(row[0]);
    const b = row[1];
    if (a === "volatility bump" || a === "vol bump") volBump = asFraction(b, 0);
    if (a === "forward sell rate") fwdSellRate = asFraction(b, DEFAULT_FWD_SELL_RATE);
    if (a.includes("reference") && a.includes("sensex")) referenceSensexPrice = positivePrice(b);
    else if (a.includes("reference") && (a.includes("nifty") || a.includes("underlying"))) referenceUnderlyingPrice = positivePrice(b);
    if (a.includes("rate cap") && a.includes("buying")) rateCapBuyingForward = asFraction(b, 0.068);
    if (a.includes("dividend") && (a.includes("multiplier") || a.includes("factor"))) dividendBidOfferMultiplier = Number(b) || 1;
    if (a === "bid or offer") bidOffer = /^o/i.test(String(b ?? "")) ? "O" : "B";

    if (tableHeader < 0) {
      const fwd = findCol(row, "fwd sell", "forward sell rate");
      const date = findCol(row, "date", "dates", "month");
      const isKeyValue = fwd === 0;
      if (fwd > 0 || (date >= 0 && findCol(row, "vol bump", "volatility bump", "bid") > date && !isKeyValue)) {
        tableHeader = i;
        fwdCol = fwd;
        bumpCol = findCol(row, "bid", "vol bump", "volatility bump");
        incCol = findCol(row, "inc. margin", "incremental margin");
        fullCol = findCol(row, "full margin");
        costCol = findCol(row, "margin cost");
        const next = grid[i + 1] ?? [];
        dateCol = next.findIndex((cell, idx) => idx <= 3 && cellIsDate(cell));
        if (dateCol < 0) dateCol = date >= 0 ? date : 1;
      }
    }
  }

  if (tableHeader >= 0) {
    for (let r = tableHeader + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const iso = cellIsDate(row[dateCol]) ? excelDateToIso(row[dateCol]) : null;
      if (!iso) {
        if (pricingParams.length) break;
        continue;
      }
      pricingParams.push({
        date: iso,
        volBump: bumpCol >= 0 ? asFraction(row[bumpCol], 0) : volBump,
        fwdSellRate: fwdCol >= 0 ? asFraction(row[fwdCol], fwdSellRate ?? DEFAULT_FWD_SELL_RATE) : (fwdSellRate ?? DEFAULT_FWD_SELL_RATE),
        ...(incCol >= 0 ? { incMargin: asFraction(row[incCol], 0) } : {}),
        ...(fullCol >= 0 ? { fullMargin: asFraction(row[fullCol], 0) } : {}),
        ...(costCol >= 0 ? { marginCost: asFraction(row[costCol], 0) } : {}),
      });
    }
  }
  return {
    pricingParams,
    volBump,
    fwdSellRate,
    referenceUnderlyingPrice,
    referenceSensexPrice,
    rateCapBuyingForward,
    dividendBidOfferMultiplier,
    bidOffer,
  };
}

/** Rate curve and implied dividends, from their own sheets or the native MarketData blocks. */
function parseCurveAndDividends(wb: XLSX.WorkBook): { rateCurve?: RatePoint[]; dividends?: DividendPoint[] } {
  let rateCurve: RatePoint[] | undefined;
  let dividends: DividendPoint[] | undefined;
  for (const name of wb.SheetNames) {
    const grid = sheetGrid(wb, name);
    for (let i = 0; i < grid.length; i++) {
      const row = grid[i] ?? [];
      const rateCol = findCol(row, "rate in percent", "rate (%pa)", "rate (% pa)", "rate %");
      const divCol = findCol(row, "implied dividend", "implied dividends");
      if (!rateCurve && rateCol > 0) {
        const tenorCol = row.findIndex((c, idx) => idx < rateCol && text(c).startsWith("tenor"));
        const linkCol = findCol(row, "linked");
        if (tenorCol >= 0) {
          const points: RatePoint[] = [];
          for (let r = i + 1; r < grid.length; r++) {
            const years = Number(grid[r]?.[tenorCol]);
            const rate = Number(grid[r]?.[rateCol]);
            if (!Number.isFinite(years) || !Number.isFinite(rate)) {
              if (points.length) break;
              continue;
            }
            const linked = linkCol >= 0 ? /^y/i.test(String(grid[r]?.[linkCol] ?? "")) : false;
            points.push({ years, ratePercent: rate <= 1 ? rate * 100 : rate, linkedToPremiumRate: linked });
          }
          if (points.length) rateCurve = points;
        }
      }
      if (!dividends && divCol > 0) {
        const dateCol = row.findIndex((c, idx) => idx < divCol && text(c) === "date");
        if (dateCol >= 0) {
          const points: DividendPoint[] = [];
          for (let r = i + 1; r < grid.length; r++) {
            const iso = excelDateToIso(grid[r]?.[dateCol]);
            const amount = Number(grid[r]?.[divCol]);
            if (!iso || !Number.isFinite(amount)) {
              if (points.length) break;
              continue;
            }
            points.push({ date: iso, amount });
          }
          if (points.length) dividends = points;
        }
      }
    }
  }
  return { rateCurve, dividends };
}

function volSheetRank(name: string): number {
  const n = name.toLowerCase();
  if (/market\s*data/.test(n)) return 3;
  if (/vol|surface/.test(n) && !/param/.test(n)) return 2;
  if (/param|calculator|master|pricer|summary/.test(n)) return 0;
  return 1;
}

export function parseVolSurfaceFile(buffer: ArrayBuffer, monthKey: string = istTodayYmd().slice(0, 7)): ParsedSurfaceUpload {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ranked = [...wb.SheetNames].sort((a, b) => volSheetRank(b) - volSheetRank(a));
  const surfaceName = ranked.find((name) => gridLooksLikeVolSurface(sheetGrid(wb, name))) ?? ranked[0];
  if (!surfaceName) throw new Error("The Excel file has no tabs.");
  const grid = sheetGrid(wb, surfaceName);

  let headerRow = -1;
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const row = grid[i] ?? [];
    if (row.slice(0, 4).map(text).some(isStrikeHeader)) {
      headerRow = i;
      break;
    }
    if (row.filter((cell) => asMoneyness(cell) != null).length >= 3) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) throw new Error("The Strike Change header row was not found on the Volatility Surface Sheet.");

  const headRow = grid[headerRow] ?? [];
  const moneyness: number[] = [];
  let firstMoneyCol = -1;
  for (let c = 0; c < headRow.length; c++) {
    const raw = text(headRow[c]);
    if (raw === "deep" || isStrikeHeader(raw)) continue;
    const m = asMoneyness(headRow[c]);
    if (m == null) {
      if (firstMoneyCol >= 0 && moneyness.length) break;
      continue;
    }
    if (firstMoneyCol < 0) firstMoneyCol = c;
    moneyness.push(Math.round(m * 10000) / 10000);
  }
  if (!moneyness.length || firstMoneyCol < 1) throw new Error("No Strike Change % columns were found.");
  const deepCol = firstMoneyCol - 1;

  let dataRow = headerRow + 1;
  while (dataRow < grid.length) {
    const probe = grid[dataRow] ?? [];
    const labels = probe.slice(0, 4).map(text);
    if (labels.some((l) => l.includes("strike") || l.includes("expiry"))) {
      dataRow += 1;
      continue;
    }
    const early = cellIsDate(probe[0]) || cellIsDate(probe[1]) || cellIsDate(probe[2]);
    const numeric = probe.slice(deepCol, deepCol + 1 + moneyness.length).filter((c) => typeof c === "number").length;
    if (!early && numeric >= 3) {
      dataRow += 1;
      continue;
    }
    break;
  }

  const expiries: string[] = [];
  const volsPercent: number[][] = [];
  let dateCol = -1;
  for (let r = dataRow; r < grid.length; r++) {
    const row = grid[r] ?? [];
    if (text(row[0]) === "date" || text(row[1]) === "date") break;
    if (dateCol < 0) {
      dateCol = row.findIndex((cell, idx) => idx <= 3 && idx < deepCol && cellIsDate(cell));
      if (dateCol < 0) {
        if (expiries.length) break;
        continue;
      }
    }
    const iso = cellIsDate(row[dateCol]) ? excelDateToIso(row[dateCol]) : null;
    if (!iso) {
      if (expiries.length) break;
      continue;
    }
    expiries.push(iso);
    const vols: number[] = [];
    for (let c = deepCol; c < deepCol + 1 + moneyness.length; c++) {
      const v = Number(row[c]);
      vols.push(Number.isFinite(v) ? v : 0);
    }
    volsPercent.push(vols);
  }
  if (!expiries.length) throw new Error("No expiry rows were found on the Volatility Surface Sheet.");

  const paramName =
    wb.SheetNames.find((n) => /param/i.test(n) && n !== surfaceName) ?? wb.SheetNames.find((n) => n !== surfaceName);
  const parsed = paramName ? parseParameters(sheetGrid(wb, paramName)) : null;
  const pricingParams = parsed?.pricingParams.length
    ? parsed.pricingParams
    : (() => {
        const [y, m] = monthKey.split("-").map(Number);
        const end = new Date(Date.UTC(y || 2026, m || 1, 0));
        return [{ date: utcMidnightIso(end), volBump: parsed?.volBump ?? 0, fwdSellRate: parsed?.fwdSellRate ?? DEFAULT_FWD_SELL_RATE }];
      })();

  const extras = parseCurveAndDividends(wb);
  const params: Partial<PricingParams> = {};
  if (parsed?.fwdSellRate != null) params.forwardSellRate = parsed.fwdSellRate;
  if (parsed?.rateCapBuyingForward != null) params.rateCapBuyingForward = parsed.rateCapBuyingForward;
  if (parsed?.dividendBidOfferMultiplier != null) params.dividendBidOfferMultiplier = parsed.dividendBidOfferMultiplier;
  if (parsed?.bidOffer) params.bidOffer = parsed.bidOffer;
  if (extras.rateCurve) params.rateCurve = extras.rateCurve;
  if (extras.dividends) params.dividends = extras.dividends;

  return {
    surface: {
      monthKey,
      label: surfaceMonthLabel(monthKey),
      deepStrike: DEEP_STRIKE,
      moneyness,
      strikes: [DEEP_STRIKE, ...moneyness],
      expiries,
      volsPercent,
      pricingParams,
      referenceUnderlyingPrice: parsed?.referenceUnderlyingPrice,
      referenceSensexPrice: parsed?.referenceSensexPrice,
    },
    params,
  };
}
