# Project Complete · Hedging Sheet

Closed 05-Nov-2026. Live at [hedging-sheet.vercel.app](https://hedging-sheet.vercel.app); source at [ShibayanBiswas/hedging-sheet](https://github.com/ShibayanBiswas/hedging-sheet).

## Excel Code Audit

VERDICT: PASS WITH DOCUMENTED DEVIATIONS — Project Complete. Every Pricer row from 17 to 62 and the A5:V5 header match both reference workbooks; the only fix was a display one, `4f4b2f6`. Full audit: [Excel Code Audit Verdict](EXCEL-CODE-AUDIT-VERDICT.md).

## Product

The Hedging Sheet for Anand Rathi Wealth prices a structured product's option book and its Day 1 hedge. The desk fills Inputs, presses Run Simulation, and reads the results on Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge, Mark To Market, Market Data and Logic Atlas. Each output tab downloads as Excel and as PDF. Inputs are never stored, and results appear only after a run.

## Architecture

| Layer | What |
|---|---|
| App | Next.js App Router, React, the pricing engine in a Web Worker (`lib/engine`) |
| Desk database | MongoDB Atlas `hedging_sheet`: `vol_surfaces` and `pricing_params`, one document per month |
| Shared surface | The volatility grid is the Unwinding Calculator's active surface, read from `unwinding_calculator.vol_surfaces` on the same cluster, mirrored into `hedging_sheet`, and written through on Upload Surface and Edit Surface |
| Market data | Yahoo closes and history for Nifty and Sensex |
| Hosting | Vercel production from `main`; GitHub Actions CI of about 4 minutes (type check, lint, Vitest, build), then a read-only Production Smoke |

## Logic Sources

| Source | Used for |
|---|---|
| August 2026 Sensex approval workbook, `fixtures/reference/reference-workbook.xlsm` | Every formula; G0 reproduces every saved value of its output sheets |
| 17-Jul-2026 Nifty rollover workbook, `fixtures/reference/nifty-rollover-workbook.xlsm` | G1 checks the formulas on a Nifty case with seven expiries |
| Unwinding Calculator's active surface | The live volatility surface. The workbooks' MarketData grids are fixtures only, never live |

## Desk Rules

| Rule | Value |
|---|---|
| Hedge Strike, Auto | Nifty `ceil((spot + 150) / 100) × 100`; Sensex `ceil(spot × 1.006 / 100) × 100` |
| Start Level | ROUNDUP(spot × (1 + Start Level Uplift), −2), uplift 0.6% |
| Default expiries | The last expiry weekday (Nifty Tuesday, Sensex Thursday) of the months 41, 44, 47, 50, 53 and 56 after the valuation date |
| Hedge expiry | The median expiry unless picked |
| Deep strike | ₹500, carrying the 55% column's volatility |
| Display | At most 3 decimals, "-" for missing, dates as 05-Nov-2026, every word capitalised |

Default Values starts on Sensex, today, the live close, the calculated daily volatility and the desk terms. Blank Inputs starts empty and unlocks step by step. A spot fills Hedge Strike, Start Level and Fetched At, and Level In Points and Units follow the strikes, tagged Calculated.

Surface Parameters, all editable on Market Data, with their defaults: Month (current), Bid Or Offer (Bid), Volatility Bump (0.00%), Incremental Margin (6.03%), Full Margin (12.03%), Margin Cost (3.00%), Forward Sell Rate (6.50% for November 2026), Dividend Bid Or Offer Factor (1.00), Rate Cap While Buying Forward (6.80%), Rate Cap While Selling Forward (the last rate curve point, or a typed cap), Premium Growth Rate Link (All Points Linked) and the rate curve points.

Details: [Input Parameters Guide](input-parameters-guide.md), [Market Data Parameters Guide](market-data-parameters-guide.md), [Sign Off · Logic Round](signoff-logic-round.md).

## Final State

| Item | Value |
|---|---|
| Last code commit | `e3f7c63`; this document follows `9f460ca` |
| CI | [Run 41979405800](https://github.com/ShibayanBiswas/hedging-sheet/actions/runs/41979405800), success at 11:49 am IST |
| Production Smoke | [Run 41979619690](https://github.com/ShibayanBiswas/hedging-sheet/actions/runs/41979619690), success at 11:50 am IST |
| Vercel production | `e3f7c63` Ready at 11:48 am IST; `9f460ca` Ready at 11:52 am IST |
| Local, 12:27 pm IST | Type check, lint, `test:ci` (78 files, 749 tests), build and `knip` green |

`GET /api/health` at 12:27 pm IST:

```json
{"status":"ok","environment":"production","database":{"connected":true,"name":"hedging_sheet","collections":{"vol_surfaces":2,"pricing_params":2},"latestSurfaceMonth":"2026-11","latestParamsMonth":"2026-11","sharedSurface":{"database":"unwinding_calculator","month":"2026-10"}},"market":{"source":"yahoo","latestCloseDate":"2026-11-04"}}
```

### Wind Up Checks On Production · 05-Nov-2026

| Time | Check | Result |
|---|---|---|
| 12:22 pm IST | Blank Inputs: Nifty, 05-11-2026 typed, Fetch | Valuation Date 05-Nov-2026, spot 23,960.60, Hedge Strike 24,200 Calculated, Start Level 24,200, Fetched At 12:22 pm IST; strikes 137 to 70 give Level In Points 33,154 to 16,940 and Units, both tagged Calculated |
| 12:23 pm IST | Surface Parameters | Every row opens for editing with a value; December opens as a new month from November; Reset reloads from the desk database |
| 12:23 pm IST | Save | November saved unchanged through `/api/params` with the Desk Key, read back identical; the shared grid kept; no Unwinding document changed |
| 12:24 pm IST | Default Values Run | Results gated before the run, Simulation Completed toast bottom right, Excel `SP-Hedging-Sheet-Sensex-05-Nov-2026.xlsx` and PDF `Hedging_Sheet_Summary_Sheet_05-Nov-2026.pdf` downloaded |
| 12:25 pm IST | Shared surface identity | Every grid field equal to the Unwinding Calculator's `/api/dataset`: November 2026 label, Deep 500 equal to the 55% column, 20 moneyness columns, 14 expiries, every volatility, Nifty 23,053.10 and Sensex 74,459.53 |

All five wind-up checks passed, so no code changed in this round. The desk's November Pricing Params sit on top of the Unwinding Calculator's October grid, which is presented as November. That composition is intended and is documented in the Market Data Parameters Guide.

### Known Workbook Deviations

Workbook values that are typed, not formulas: Summary D3, a second spot (the app has one spot; both give Start Level 24,500); Pricer H5 and Summary Q10, pasted Goal Seek results 0.015% from a fresh solve; Summary P10, a stale spread width; the MTM product requirement column, typed for a 100 Crore book; and the "Sensex" label on the Nifty book's Day 1 sheet.

## Out Of Scope

The manual visual suite will drift where the Blank Inputs strike table now shows Calculated tags; its baselines were not regenerated. Lighthouse and multi-browser runs were not made. A selling forward cap inside an uploaded file is not read; it is set on Surface Parameters.

## Close

The Hedging Sheet is complete for desk use. It prices on the same surface as the Unwinding Calculator, reproduces both reference workbooks' formulas, and runs green in CI and in production. Further work is maintenance only: monthly surface uploads, parameter edits and dependency updates.
