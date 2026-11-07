# Engine Worker And Market Data · Production · 55e2739

Google Chrome 156.0.8078.74, driven by Playwright, against https://hedging-sheet.vercel.app (`55e2739`) at 1440 by 900, India time zone. Saturday 07-Nov-2026, market closed, laptop saturated by other sessions (see [22](22-lighthouse-production-55e2739.md)). Nothing was saved: no run writes, and the Market Data check aborted every request that was not GET or HEAD. None was attempted.

## Engine Worker · 20:57 To 20:59 IST

Each case is a fresh browser context. "Run To Summary" is from the click on Run Simulation until the address is `/summary`, as `e2e/perf.spec.ts` measures it; "Headline" is until Summary's headline table is on the page. Long tasks are from a PerformanceObserver on the main thread during the run.

| Case | Inputs | Worker | Run To Summary | Headline | Longest Main-Thread Task | Summary Sheet |
|---|---|---|---|---|---|---|
| Default Values 1 | Sensex, 07-Nov-2026, spot 81,028.02 | One `DedicatedWorkerGlobalScope` started at Run | 1,380 ms | 1,460 ms | 0 ms | 86 of 86 cells are numbers, no run gate |
| Default Values 2 | The same | The same | 1,639 ms | 1,694 ms | 0 ms | The same |
| Default Values 3 | The same | The same | 1,132 ms | 1,186 ms | 0 ms | The same |
| Blank Inputs, the workbook case | `tests/fixtures/blank-workbook-fill.json`, 53 fields typed in 4.6 s: Sensex, 04-Aug-2026, spot 76,799, six expiry dates typed from 05-Jan-2030 | The same | 1,267 ms | 1,303 ms | 0 ms | 86 of 86 cells are numbers, no run gate |

- **Worker:** no worker existed before Run. Each run started one dedicated worker, `/_next/static/immutable/chunks/turbopack-worker-17xj571juv_5b.js`, whose global scope reports `DedicatedWorkerGlobalScope`, and the main thread logged no long task during the run.
- **Run time:** median 1,380 ms for Default Values; one of four runs, 1,639 ms, was over the 1.5 s target on the saturated laptop.
- **Console:** no error and no warning, no page error and no response of 400 or more, in all four cases. The only failed requests were Next.js route prefetches (`?_rsc=`) cancelled by the navigation to Summary (`net::ERR_ABORTED`), which `e2e/crawl.spec.ts` also leaves out.
- **Popups:** each run showed "Expiries Beyond The Surface", which the check closed. Filling the workbook case raised none.
- **Headline, Default Values:** Actual Inbuilt 3.26%, Option Premium ₹45.88 Crore, Maturity Payout ₹202.50 Crore, Margin Requirement 35.79%, Hedge Quantity 18,635.90, Vega ₹0.81 Crore, Delta 15,582 contracts, IRR 14.20%.
- **Headline, workbook case:** Actual Inbuilt 2.54%, Option Premium ₹45.06 Crore, Maturity Payout ₹202.50 Crore, Margin Requirement 35.28%, Hedge Quantity 20,158.66, Vega ₹0.84 Crore, Delta 16,221 contracts, IRR 14.20%. The workbook itself solves 7.95% on its own August MarketData grid; live prices on the Unwinding Calculator's grid with the desk's Pricing Params, the drift [the audit](../EXCEL-CODE-AUDIT-VERDICT.md) describes. Both reach the 102.50% coupon and the 14.20% IRR.

## Market Data · 20:59 To 21:01 IST

| Check | Result |
|---|---|
| `GET /api/health` | `sharedSurface`: `unwinding_calculator`, 2026-11. `hedging_sheet`: latest surface month 2026-11, latest parameters month 2026-11 |
| Market Data Headline | Surface **November 2026**; Source **Shared With The Unwinding Calculator**; Bid; 17 expiry rows, 20 strike columns; Reference Sensex Price 76,835.78; Forward Sell Rate This Month 6.60% |
| Header strip | Surface November 2026 |
| Surface Parameters, as loaded | Month November 2026, Bid, Volatility Bump 0.00%, Incremental Margin 6.03%, Full Margin 12.03%, Margin Cost 3.00%, Forward Sell Rate 6.60%, Dividend Factor 1.00, Rate Cap While Buying Forward 6.80%, Rate Cap While Selling Forward 7.60%, All Points Linked, 7 rate curve tenors |
| Edit, then the month picker to 2026-12 | `GET /api/params?month=2026-12` 200, stored month 2026-11. Status "December 2026 Is New: It Starts From The Latest Earlier Month Until Saved". Forward Sell Rate 6.60, selling forward cap 7.60 |
| Month picker to 2026-10 | `GET /api/params?month=2026-10` 200, stored month 2026-10. Status "Loaded October 2026 From Desk Database". Forward Sell Rate 5.50, selling forward cap 6.50 |
| Month picker back to 2026-11 | No request; the desk month's values return, 6.60 and 7.60 |
| Cancel | Every Surface Parameters row is the same as before Edit |
| Requests other than GET or HEAD | **0 attempted** (each would have been aborted) |
| Console | No error, no warning, no response of 400 or more |

## Note On Reads That Write

On `55e2739` a read can write. `loadActiveSurface()` in `lib/data/load.ts`, behind `GET /api/dataset`, `GET /api/surface` and `GET /api/params?month=`, copies the Unwinding Calculator's grid into `hedging_sheet.vol_surfaces` whenever the desk's month document differs from it. This is the design in [the logic round's Surface Wiring Choice](../signoff-logic-round.md): one idempotent `replaceOne` per change of the shared grid, made by whichever visitor reads first. None of the checks here or in `npm run test:vercel` posts, uploads or saves, but any of their page loads could have been that first read after the Unwinding Calculator's November upload. No read-only route shows whether the desk's document already matched, so this note cannot say whether one of these reads wrote it.
