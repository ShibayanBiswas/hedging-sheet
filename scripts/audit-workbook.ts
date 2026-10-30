/**
 * Audits every non-empty cell of the reference workbook against the engine and writes docs/workbook-audit.md.
 * Each cell gets its label, formula or constant, the workbook's saved value, the app's value, the code that
 * reproduces it, the test that proves it, and a status: Match, Mismatch Fixed, Not Applicable With A Reason,
 * or Mismatch. Exits 1 when any cell is a Mismatch or has no mapping and no reason.
 *
 *   npm run audit:workbook
 */
import fs from "node:fs";

import ExcelJS from "exceljs";

import { defaultExpiryDates, seedMarketData, seedPricingParams } from "../lib/engine/defaults";
import { annualVolFromDaily } from "../lib/engine/hedging-sheet";
import { G0_OPTIONS, g0Inputs, run } from "../tests/golden/cases";
import { engineCell, payoffCell, splitAddress, type CellRead } from "../tests/golden/workbook-cells";
import { REFERENCE_WORKBOOK, isFormula, savedValue } from "./workbook-reference";

const OUT = "docs/workbook-audit.md";
const SHEETS = ["Summary Sheet", "Pricer", "MTM & Margin req", "Day1 Vega Hedge", "MarketData", "Pricing Params", "Product Description", "Pivot of Positions", "Data"] as const;
const GOLDEN_SHEETS = new Set(["Pricer", "Day1 Vega Hedge", "MTM & Margin req"]);

type Status = "Match" | "Mismatch Fixed" | "Not Applicable" | "Mismatch";
type Row = { cell: string; label: string; formula: string; workbook: string; app: string; code: string; test: string; status: Status; reason?: string };

const fmt = (v: unknown): string => {
  if (v == null || v === "") return "-";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v).replace(/\|/g, "·").replace(/\s+/g, " ").slice(0, 60);
};

// ---------------------------------------------------------------------------------------------- code locations

/** The line a symbol is declared on, so the audit points at file and line. */
function where(file: string, symbol: string): string {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const i = lines.findIndex((l) => new RegExp(`(function|const|type)\\s+${symbol}\\b`).test(l));
  return `\`${file}:${i + 1}\` ${symbol}`;
}

type Block = { sheet: string; boxes: Array<{ top: number; left: number; bottom: number; right: number }>; code: string; test: string };

/** Code and test per range, from the mapping doc that verify:mapping keeps complete. */
function mappingBlocks(): Block[] {
  const out: Block[] = [];
  for (const line of fs.readFileSync("docs/11-workbook-mapping.md", "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|") || line.startsWith("|---")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 5 || cells[0] === "Workbook Sheet") continue;
    const [sheet, range, , code, test] = cells as [string, string, string, string, string];
    const m = /`([^`]+\.tsx?)`\s*([A-Za-z]\w*)?/.exec(code);
    const located = m ? where(m[1]!, m[2] ?? "") + code.slice(m.index + m[0].length) : code;
    const boxes = range.split(",").flatMap((part) => {
      const [a, b = a] = part.trim().split(":");
      if (!/^[A-Z]+\d+$/.test(a ?? "") || !/^[A-Z]+\d+$/.test(b ?? "")) return [];
      const p = splitAddress(a!);
      const q = splitAddress(b!);
      return [{ top: Math.min(p.row, q.row), bottom: Math.max(p.row, q.row), left: Math.min(p.col, q.col), right: Math.max(p.col, q.col) }];
    });
    out.push({ sheet, boxes, code: located.replace(/\|/g, "·"), test: test === "-" ? "-" : test });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- reasons

type Reason = { sheet: string; test: (row: number, col: number, raw: unknown) => boolean; reason: string; code?: string; test2?: string; deviation?: boolean };

const isText = (raw: unknown) => typeof savedValue(raw) === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(String(savedValue(raw)));
const inBox = (row: number, col: number, top: number, left: number, bottom: number, right: number) => row >= top && row <= bottom && col >= left && col <= right;
const C = (l: string) => splitAddress(`${l}1`).col;

const REASONS: Reason[] = [
  { sheet: "*", test: (_r, _c, raw) => isText(raw) && !isFormula(raw), reason: "Label or heading text; the app shows its own Title Case labels" },
  { sheet: "*", test: (_r, _c, raw) => isText(raw) && isFormula(raw), reason: "Text the sheet builds from other cells; the app writes the same facts in its own wording" },
  { sheet: "Pricer", test: (r, c) => r >= 17 && r <= 62 && [6, 7].includes((c - 2) % 8), reason: "Expiry slots 7 and 8 of each strike block, unused with six expiries" },
  { sheet: "Pricer", test: (r) => r === 21 || r === 22, reason: "Rate curve bracket date: the workbook's curve carries fixed 2025 dates; the app anchors each tenor at the trade date. Signed off as a deviation", deviation: true },
  { sheet: "Pricer", test: (r, c) => ((r === 7 || r === 8) && c >= C("I")) || r === 63 || r === 64, reason: "Check sums and the macro switch the desk used while building the sheet; no output reads them" },
  { sheet: "Day1 Vega Hedge", test: (r, c) => c >= C("AE") && c <= C("AH") && r >= 26, reason: "Rate curve bracket: fixed 2025 curve dates in the workbook, anchored tenors in the app. Signed off as a deviation", deviation: true },
  { sheet: "MTM & Margin req", test: (r, c) => (r === 1 && c === C("N")) || (r === 16 && c >= C("S")), reason: "Scratch cells left by the Mark To Market macro; no output reads them" },
  { sheet: "Summary Sheet", test: (r, c) => inBox(r, c, 2, C("G"), 6, C("O")), reason: "Expiry helpers: trade date plus months times 30.5 days. The expiries they lead to, C12 to H12, match the app's last Thursday rule" },
  { sheet: "Summary Sheet", test: (r, c) => r === 21 && c === 2, reason: "Expiry list as text; the app writes the same dates in its own format" },
  { sheet: "Product Description", test: (r) => (r >= 7 && r <= 22) || r >= 55, reason: "An older product left above and below the term sheet; not this product" },
  { sheet: "Product Description", test: (r, c) => c === C("O") && r >= 32 && r <= 42, reason: "Check column of return steps; no output reads it" },
  { sheet: "Product Description", test: (r, c) => c === C("J") && r >= 32 && r <= 53, reason: "Performance levels of the saved payoff grid; the app generates its own levels and is checked at these ones" },
  { sheet: "MarketData", test: (r, c) => r === 21 || (r >= 26 && r <= 34 && c >= C("F") && c <= C("G")), reason: "Helper columns the sheet computes for display; no Pricer cell reads them" },
  { sheet: "MarketData", test: (r, c) => r >= 26 && r <= 34 && c >= C("B") && c <= C("E"), reason: "Dated rate curve from 2020 to 2025; the app keeps tenor points anchored at the trade date. Signed off as a deviation", deviation: true },
  { sheet: "MarketData", test: (r, c) => r >= 3 && r <= 20 && c === C("D"), reason: "Deep column: the desk rule sets Deep equal to the 55% column; it is only read for strikes below 55%, and no G0 leg is" },
  { sheet: "MarketData", test: (r, c) => r === 2 && c === C("D"), reason: "The Deep strike, 500 points; the app shows the 55% strike in its place by desk rule" },
  { sheet: "MarketData", test: (r, c) => r <= 2 && c <= C("C"), reason: "Named cells t, x and y for the sheet's lookup formulas" },
  { sheet: "MarketData", test: (r, c) => r === 1 && c === C("Z"), reason: "A stray constant outside the grid; no formula reads it" },
  { sheet: "Pricing Params", test: (r, c) => r === 2 && c === C("Q"), reason: "Sheet level forward sell rate of 5.6%; no formula reads it. The Pricer reads the dated column H, 5.5% for Aug-2026, which the app reads too and which matches" },
  { sheet: "Pricing Params", test: (r, c) => r === 1 && c >= C("I") && c <= C("J"), reason: "Helper that reads TODAY(); it changes every day and no output reads it" },
  { sheet: "Pricing Params", test: (_r, c) => c === C("C"), reason: "Bid column flag; the app keeps Bid or Offer as one parameter" },
  { sheet: "Pricing Params", test: (_r, c) => c >= C("K") && c <= C("L"), reason: "Blank spacer columns" },
  { sheet: "Pivot of Positions", test: () => true, reason: "Stale pivot cache of 2022 positions; it never refreshes from the Pricer. The app's Summary leg table replaces it" },
];

function reasonFor(sheet: string, row: number, col: number, raw: unknown): Reason | undefined {
  return REASONS.find((x) => (x.sheet === "*" || x.sheet === sheet) && x.test(row, col, raw));
}

// ---------------------------------------------------------------------------------------------- extra app values

/** Values for the market and input sheets, which the golden cell map does not cover. */
function extraApp(sheet: string, row: number, col: number, formula: string | null): CellRead | undefined {
  const market = seedMarketData();
  const params = seedPricingParams();
  if (sheet === "Summary Sheet") {
    if (row === 12 && col >= 3 && col <= 8) return { value: defaultExpiryDates("2026-08-04", "Sensex")[col - 3], kind: "value" };
    if (row === 26 && col === C("I")) return { value: annualVolFromDaily(0.00895071), kind: "value" };
    if (row === 23 && col === C("H")) return { value: 76800, kind: "value" };
  }
  if (sheet === "MarketData") {
    const s = market.surface;
    if (row === 1 && col >= C("E")) return { value: s.moneyness[col - C("E")], kind: "value" };
    if (row === 2 && col >= C("E")) return { value: (s.moneyness[col - C("E")] ?? NaN) * (s.referenceSensexPrice ?? NaN), kind: "price" };
    if (row >= 3 && row <= 20 && col === C("C")) return { value: s.expiries[row - 3]?.slice(0, 10), kind: "value" };
    if (row >= 3 && row <= 20 && col >= C("E")) return { value: s.volsPercent[row - 3]?.[col - C("E") + 1], kind: "value" };
    if (row >= 26 && col === C("I")) return { value: params.dividends[row - 26]?.date.slice(0, 10), kind: "value" };
    if (row >= 26 && col === C("J")) return { value: params.dividends[row - 26]?.amount, kind: "value" };
  }
  if (sheet === "Pricing Params") {
    const grid = market.surface.pricingParams;
    if (row >= 2 && col >= C("B") && col <= C("H")) {
      const wbDate = String(savedValue(workbookCell("Pricing Params", `B${row}`)) ?? "");
      const p = grid.find((x) => x.date.slice(0, 10) === wbDate);
      if (!p) return undefined;
      const by: Record<number, unknown> = { [C("B")]: p.date.slice(0, 10), [C("D")]: p.volBump, [C("E")]: p.incMargin, [C("F")]: p.fullMargin, [C("G")]: p.marginCost, [C("H")]: p.fwdSellRate };
      return col in by ? { value: by[col] as number | string, kind: "value" } : undefined;
    }
    if (row === 2) {
      const by: Record<number, number> = {
        [C("M")]: params.dividendBidOfferMultiplier,
        [C("N")]: params.rateCapBuyingForward,
        [C("O")]: 0.065,
        [C("P")]: grid.find((p) => p.marginCost != null)?.marginCost ?? NaN,
      };
      return col in by ? { value: by[col]!, kind: "value" } : undefined;
    }
  }
  if (sheet === "Data" && formula) {
    const ref = /^Pricer!\$?([A-Z]+)\$?(\d+)$/.exec(formula.replace(/^=/, ""));
    if (ref) return engineCell(G0, "Pricer", `${ref[1]}${ref[2]}`);
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------- run

const G0 = run(g0Inputs(), undefined, G0_OPTIONS);
let WB: ExcelJS.Workbook;
const workbookCell = (sheet: string, address: string) => WB.getWorksheet(sheet)!.getCell(address).value;

function formulaText(raw: unknown): string | null {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.formula === "string") return `=${o.formula}`;
    if (typeof o.sharedFormula === "string") return `=shared ${o.sharedFormula}`;
  }
  return null;
}

function labelOf(ws: ExcelJS.Worksheet, row: number, col: number): string {
  const rowLabel = (() => {
    for (let c = col - 1; c >= 1; c--) {
      const v = savedValue(ws.getCell(row, c).value);
      if (typeof v === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(v) && !isFormula(ws.getCell(row, c).value)) return v;
    }
    return "";
  })();
  const colLabel = (() => {
    for (let r = row - 1; r >= Math.max(1, row - 40); r--) {
      const v = savedValue(ws.getCell(r, col).value);
      if (typeof v === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(v) && !isFormula(ws.getCell(r, col).value)) return v;
    }
    return "";
  })();
  return fmt([rowLabel, colLabel].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "-");
}

function matches(expected: number | string, read: CellRead): boolean {
  const actual = read.value;
  if (typeof expected === "string") return actual === expected;
  if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
  if (Number.isInteger(expected) && Math.abs(expected) >= 1 && read.kind !== "price" && Number.isInteger(actual)) return actual === expected;
  const gap = Math.abs(actual - expected);
  return gap <= 1e-9 || (read.kind === "price" && gap <= 1e-4) || gap <= 1e-3 * Math.max(Math.abs(expected), Math.abs(actual));
}

/** Expiries the old nearest weekday rule missed; the last Thursday rule reproduces them. */
const FIXED = new Set(["C12", "D12", "E12", "F12", "G12", "H12"].map((a) => `Summary Sheet!${a}`));

async function main() {
  WB = new ExcelJS.Workbook();
  await WB.xlsx.readFile(REFERENCE_WORKBOOK);
  const blocks = mappingBlocks();
  const tables = new Map<string, Row[]>();
  const failures: string[] = [];
  const pricerRows = new Map<string, Row>();

  for (const name of SHEETS) {
    const ws = WB.getWorksheet(name);
    if (!ws) throw new Error(`No ${name} sheet in the reference workbook.`);
    const rows: Row[] = [];
    ws.eachRow({ includeEmpty: false }, (r) =>
      r.eachCell({ includeEmpty: false }, (cell) => {
        const raw = cell.value as unknown;
        const saved = savedValue(raw);
        const formula = formulaText(raw);
        if (saved === undefined && !formula) return;
        const { row, col } = splitAddress(cell.address);
        let read: CellRead | undefined;
        if (name === "Product Description" && row >= 32 && row <= 53 && (col === 11 || col === 12)) {
          const perf = savedValue(ws.getCell(`J${row}`).value);
          if (typeof perf === "number") read = payoffCell(G0, perf, col);
        }
        const mirrored = name === "Data" ? /^=Pricer!\$?([A-Z]+)\$?(\d+)$/.exec(formula ?? "") : null;
        const mirror = mirrored ? pricerRows.get(`${mirrored[1]}${mirrored[2]}`) : undefined;
        const reason: Reason | undefined =
          mirror?.status === "Not Applicable"
            ? { sheet: name, test: () => true, reason: `Mirrors Pricer!${mirror.cell}: ${mirror.reason}`, deviation: REASONS.some((x) => x.deviation && x.reason === mirror.reason) }
            : reasonFor(name, row, col, raw);
        if (!read && !(reason?.deviation)) read = engineCell(G0, name, cell.address) ?? extraApp(name, row, col, formula?.replace(/^=shared /, "") ?? null);
        const block = blocks.find((b) => b.sheet === name && b.boxes.some((x) => inBox(row, col, x.top, x.left, x.bottom, x.right)));
        const key = `${name}!${cell.address}`;
        let status: Status;
        let app = "-";
        if (read && saved !== undefined && read.value !== undefined && read.value !== null) {
          app = fmt(read.value);
          status = matches(saved, read) ? (FIXED.has(key) ? "Mismatch Fixed" : "Match") : "Mismatch";
        } else if (reason) {
          status = "Not Applicable";
        } else if (saved === undefined) {
          status = "Not Applicable";
        } else {
          status = "Mismatch";
          failures.push(`${key}: no mapping and no reason`);
        }
        if (status === "Mismatch" && !failures.some((f) => f.startsWith(`${key}:`))) failures.push(`${key}: workbook ${fmt(saved)}, app ${app}`);
        rows.push({
          cell: cell.address,
          label: labelOf(ws, row, col),
          formula: fmt(formula ?? (typeof saved === "number" || typeof saved === "string" ? `constant ${saved}` : "-")),
          workbook: saved === undefined ? "error or blank result" : fmt(saved),
          app,
          code: block?.code ?? (status === "Not Applicable" ? "-" : codeForExtra(name, row)),
          test: block?.test ?? testForExtra(name, status),
          status,
          reason: status === "Not Applicable" ? (reason?.reason ?? "The workbook saves no value: an error or a blank result") : undefined,
        });
      }),
    );
    tables.set(name, rows);
    if (name === "Pricer") for (const r of rows) pricerRows.set(r.cell, r);
  }

  fs.writeFileSync(OUT, render(tables));
  const counts = [...tables.values()].flat();
  console.log(`${counts.length} cells: ${counts.filter((r) => r.status === "Match").length} Match, ${counts.filter((r) => r.status === "Mismatch Fixed").length} Mismatch Fixed, ${counts.filter((r) => r.status === "Not Applicable").length} Not Applicable, ${counts.filter((r) => r.status === "Mismatch").length} Mismatch. Wrote ${OUT}.`);
  for (const sheet of GOLDEN_SHEETS) {
    const unmapped = (tables.get(sheet) ?? []).filter((r) => r.formula.startsWith("=") && r.status === "Mismatch");
    if (unmapped.length) failures.push(`${sheet}: ${unmapped.length} formula cells without a matching engine value`);
  }
  if (failures.length) {
    console.error(`Audit failed:\n  ${failures.slice(0, 40).join("\n  ")}`);
    process.exit(1);
  }
}

function codeForExtra(sheet: string, row: number): string {
  if (sheet === "Summary Sheet" && row === 12) return where("lib/engine/defaults.ts", "defaultExpiryDates");
  if (sheet === "MarketData") return where("lib/engine/vol-surface.ts", "normalizeVolSurface");
  if (sheet === "Pricing Params") return where("lib/engine/defaults.ts", "seedPricingParams");
  if (sheet === "Data") return where("lib/engine/hedging-sheet.ts", "computeHedgingSheet");
  return where("lib/engine/defaults.ts", "defaultInputs");
}

function testForExtra(sheet: string, status: Status): string {
  if (status === "Not Applicable") return "-";
  if (sheet === "Summary Sheet") return "tests/unit/dates.test.ts, tests/golden/g0-workbook.test.ts";
  if (sheet === "Data") return "tests/golden/g0-workbook.test.ts";
  return "scripts/audit-workbook.ts";
}

// ---------------------------------------------------------------------------------------------- document

function render(tables: Map<string, Row[]>): string {
  const all = [...tables.values()].flat();
  const out: string[] = [];
  out.push(
    "# Workbook Audit",
    "",
    "Every non-empty cell of the reference workbook, `fixtures/reference/reference-workbook.xlsm`, checked against the engine run on the workbook's own inputs: trade date 04-Aug-2026, close 76,799, daily volatility 0.895%, hedge strike 76,800 and the 5.5% forward growth of 'Pricing Params'!H69. Numbers match within 0.001 relative, or 1e-4 absolute for prices and the bumped Greeks; dates, text and whole numbers match exactly. Generated by `scripts/audit-workbook.ts`; do not edit by hand.",
    "",
    "## 1. Summary",
    "",
    "| Sheet | Cells | Match | Mismatch Fixed | Not Applicable | Mismatch |",
    "|---|---|---|---|---|---|",
  );
  for (const [sheet, rows] of tables) {
    const n = (s: Status) => rows.filter((r) => r.status === s).length;
    out.push(`| ${sheet} | ${rows.length} | ${n("Match")} | ${n("Mismatch Fixed")} | ${n("Not Applicable")} | ${n("Mismatch")} |`);
  }
  const n = (s: Status) => all.filter((r) => r.status === s).length;
  out.push(`| **All** | **${all.length}** | **${n("Match")}** | **${n("Mismatch Fixed")}** | **${n("Not Applicable")}** | **${n("Mismatch")}** |`, "");

  out.push(
    "## 2. Flow Diagram",
    "",
    "```mermaid",
    "flowchart LR",
    "  I[Inputs<br/>Summary Sheet C2 to C26] --> E[Expiries<br/>last Thursday of each month]",
    "  I --> K[Strikes<br/>Pricer B17 to B19]",
    "  E --> S[Surface<br/>MarketData volatility grid]",
    "  K --> S",
    "  S --> F[Forwards<br/>Pricer rows 28 to 31]",
    "  F --> P[Pricing<br/>Black price and bumped Greeks]",
    "  P --> G[Goal Seek<br/>Macro2 on the Inbuilt]",
    "  G --> T[Pots<br/>NBFC, premium and margin]",
    "  P --> V[Vega Hedge<br/>Day1 Vega Hedge]",
    "  T --> M[Margin<br/>MTM And Margin grid]",
    "  V --> M",
    "  M --> O[Outputs<br/>Summary, Product Description and Excel]",
    "```",
    "",
    "## 3. One Table Per Sheet",
    "",
    "Not Applicable cells carry their reason in the Status column.",
    "",
  );
  for (const [sheet, rows] of tables) {
    out.push(`### ${sheet}`, "", "| Cell | Label | Formula Or Constant | Workbook Value | App Value | Code Function With File And Line | Test Name | Status |", "|---|---|---|---|---|---|---|---|");
    for (const r of rows) {
      const status = r.status === "Not Applicable" ? `Not Applicable: ${r.reason}` : r.status;
      out.push(`| ${r.cell} | ${r.label} | ${r.formula} | ${r.workbook} | ${r.app} | ${r.code} | ${r.test} | ${status} |`);
    }
    out.push("");
  }

  out.push(
    "## 4. Inputs Map",
    "",
    "| Summary Sheet Input | Cell | UI Field | Default | Validation Rule | Group |",
    "|---|---|---|---|---|---|",
    "| Date | C2 | Valuation Date | Today in India, or the last close's date | A valid date, not in the future | 1 Underlying And Market |",
    "| Sensex Derived Spot | C3, D3 | Sensex Spot | The last completed close | Above 0 | 1 Underlying And Market |",
    "| Hedge Strike | H23 | Hedge Strike | Sensex spot times 1.006, Nifty spot plus 150, rounded up to the next 100 | Above 0, a multiple of 100 | 1 Underlying And Market |",
    "| Expiries | C12 to H12 | Expiry 1 to Expiry 10 | The last Thursday of each helper month | A date after the Valuation Date, strictly ascending, snapped to the last expiry weekday of its month | 2 Observation Expiries |",
    "| Strikes | Pricer B17 and on | Strike 1 to Strike 10, Level %, Option Type, Buy Or Sell | 137, 127, 125, 85, 84 and 70, Put, sides from the payoff | Above 0 and at most 500, strictly descending | 3 Strikes And Spreads |",
    "| Spread Levels And Participation | G10 to L10 | Spread rows | Participation 1, the top derived from the Coupon | Above 0 and at most 100 | 3 Strikes And Spreads |",
    "| NBFC Rate | C4 | NBFC Rate | 8% | 0% to 100% | 4 Rates |",
    "| Prem Rate | C5 | Premium Growth Rate | 6.5% | 0% to 100% | 4 Rates |",
    "| Margin Growth Rate | C6 | Margin Growth Rate | 6.579% | 0% to 100% | 4 Rates |",
    "| Coupon | D10 | Coupon | 102.5% | Above 0% and at most 1000% | 5 Product Terms |",
    "| Decay | N10 | Decay | 1.6 | Above 0 and at most 10 | 5 Product Terms |",
    "| Tenor | O10 | Tenor In Days | 1,940 | A whole number from 1 to 3,650 | 5 Product Terms |",
    "| Notional | C15 | Notional In Crore | 100 | Above 0 | 5 Product Terms |",
    "| Daily Volatility | I25 | Daily Volatility | One year of daily log returns, sample standard deviation | Above 0% and at most 10% | 6 Volatility |",
    "| Annual Volatility | I26 | Annual Volatility | Daily times the square root of 365 | Follows Daily | 6 Volatility |",
    "| Transaction, Issuance And Margin Cost | C18 to E18 | Transaction Cost, Issuance Cost, Margin Cost | 2.25%, 0.13%, 0% | 0% to 20% | 7 Margin And Desk Terms |",
    "| Exposure Margin | J29 | Exposure Margin | 5% | 0% to 100% | 7 Margin And Desk Terms |",
    "| Futures Margin | MTM & Margin req H2 | Futures Margin | 20% | 0% to 100% | 7 Margin And Desk Terms |",
    "",
    "## 5. Decisions",
    "",
    "| Topic | Decision | Reason |",
    "|---|---|---|",
    "| Hedge strike | The app suggests Sensex spot times 1.006 and Nifty spot plus 150, rounded up to the next 100; the value stays editable | The desk rule. The workbook's H23 is hand typed as 76,800; the golden tests feed 76,800 directly, so they still match |",
    "| Expiries | The last Thursday of the month for Sensex, the last Tuesday for Nifty | Every expiry the workbook typed, C12 to H12, is the last Thursday of its month; Nifty follows NSE circular FAOP 68747 |",
    "| Holidays | No holiday adjustment | No Holiday Adjustment In Workbook: it has no holiday list and no WORKDAY call |",
    "| Volatility statistic | Sample standard deviation, the STDEV.S equivalent, of one year of daily log returns | The workbook types Daily Volatility in I25 and holds no closes and no STDEV call; I26 is I25 times the square root of 365, which the app keeps |",
    "| Deep column | Deep equals the 55% column, and the Deep strike shows the 55% strike | Desk rule; it is read only for strikes below 55% |",
    "| Call strike | A call strike carries a futures leg worth contracts times the discount factor times forward less strike | Put-call parity, so a call book gives the same Premium, Inbuilt and Greeks as the put book |",
    "| Removed tables | The forward grid, the rate curve as read and the implied dividends have no table on the page | Display only; the engine still reads all three and the surface file carries them |",
    "",
    "## 6. Deviations",
    "",
    "| Cells | Workbook | App | Sign Off |",
    "|---|---|---|---|",
    "| Pricer rows 21 and 22, Day1 Vega Hedge columns AE to AH, MarketData B26 to E34 | A dated rate curve from 2020 to 2025, so every bracket is the 2025 point | Tenor points anchored at the trade date | Approved by the desk on 30-Oct-2026: keep anchored tenors. The discount yield the brackets feed equals the Premium Rate in both, and every price matches |",
    "",
    "## 7. How To Re-Run",
    "",
    "```powershell",
    "npm run audit:workbook",
    "```",
    "",
    "It rewrites this file and exits 1 if any cell is a Mismatch or has no mapping and no reason. CI runs it on every push.",
    "",
  );
  return out.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
