# Sign Off · Logic And Market Data Round

Commit `e3f7c63` on `main`, 05-Nov-2026. Backend and logic first; the only UI changes are the Blank Inputs tags and Fetched At, and the Surface Parameters month picker and selling forward cap.

## What Changed

| Area | Change | Code | Tests |
|---|---|---|---|
| Volatility surface | The grid is the Unwinding Calculator's active surface, read from `unwinding_calculator.vol_surfaces` with its own month rule and presentation, composed with this desk's dated Pricing Params grid, and mirrored into `hedging_sheet.vol_surfaces`. Upload Surface and Edit Surface write the grid to both databases in one transaction. | `lib/db/unwinding-surface.ts`, `lib/data/load.ts`, `lib/db/config.ts`, `app/api/surface`, `app/api/uploads/vol-surface` | `tests/edge/shared-surface.test.ts` |
| Upload | A one point Surface Parameters file, the Unwinding layout, keeps the desk's dated Pricing Params grid. Implied Dividends are read from the Date column beside them; before, a desk workbook paired them with the rate curve's dates and kept 9 of 119. | `lib/excel/parse-vol-surface.ts`, `withMonthScalars` | `tests/edge/shared-surface.test.ts`, `tests/golden/g1-nifty-rollover.test.ts` |
| Blank Inputs | A spot arriving fills an empty Start Level Uplift with 0.6%, so Start Level, Level In Points and Units show at once; Units read the Default Values terms for product terms not entered yet; Level In Points and Units are tagged Calculated; Fetched At shows after Fetch in India time and clears when the spot is typed. | `lib/inputs/derive.ts`, `lib/inputs/strikes.ts` `tableUnits`, `lib/context/desk-provider.tsx`, `components/inputs/input-sections.tsx` | `tests/unit/blank-autofill.test.ts` |
| Surface Parameters | Month picker: another month loads its saved values, or the latest earlier ones for a new month, and Save writes that month. Rate Cap While Selling Forward is editable, stored as an optional `rateCapSellingForward`, and Follow The Rate Curve clears it. Missing margins open with the built in row of the month. | `app/market-data/page.tsx`, `app/api/params/route.ts`, `lib/engine/rates.ts`, `lib/db/schemas.ts` | `tests/unit/surface-params.test.ts` |
| Health | `database.sharedSurface` names the shared database and month; production smoke asserts it. | `app/api/health/route.ts`, `e2e/prod-smoke.spec.ts` | Production Smoke |
| Docs | [Input Parameters Guide](input-parameters-guide.md), [Market Data Parameters Guide](market-data-parameters-guide.md), [05 MongoDB and Seed](05-mongodb-and-seed.md) | | |

## Surface Wiring Choice

Option A, shared read, with a mirror and write through. The Unwinding Calculator's database is the source of the grid; this desk owns its Pricing Params grid and surface parameters. The read refreshes every five minutes. Previews, development deployments and tests use `unwinding_calculator_preview`, `unwinding_calculator_development` and `unwinding_calculator_test`, so only production touches the live surface. The workbooks' MarketData grids are fixtures only.

## Workbook Logic

G0 still reproduces every saved value of the August Sensex approval workbook. New G1 checks the 17-Jul-2026 Nifty rollover workbook on its own MarketData, anchored at MarketData!N2 = 24,021.65: the Summary inputs and Spread 2 participation of 91.5, seven expiries and the hedge expiry, the greeks and strike prices, Pricer start level 24,500, rupee strikes, forward growth 6.60%, the 7.60% selling forward cap, dividends, forwards, volatilities, prices and units, the Day 1 hedge at 24,000 with its margins, and the MTM ladder from −50% to +20% with the 20% futures margin. Once the dividend parse was fixed and the anchor set, every engine formula matched.

Workbook values that are typed, not formulas, and differ for that reason:

| Cell | Why |
|---|---|
| Summary D3 | The workbook keeps a second spot, 24,334.30; the app has one spot, the derived 24,264.86. Both give the 24,500 Start Level. |
| Pricer H5 and Summary Q10 | Pasted Goal Seek results, 0.015% from a fresh solve; G1 checks them within 0.1%. |
| Summary P10 | A stale typed spread width. |
| MTM & Margin req column E | Typed product requirement for a 100 Crore book while Summary C15 says 3 Crore. |
| Day1 Vega Hedge column Q | The template's "Sensex" label on a Nifty book. |

## Checks

| Check | Result |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm run build` | Green |
| `npm run test:ci` | 78 files, 749 tests, green; 723 before this round |
| `tests/api` (not in CI) | 3 files, 41 tests, green |
| GitHub CI on `e3f7c63` | Success, started 11:47 am IST |
| Vercel production deployment | Ready before 11:49 am IST |
| Production Smoke | Success at 11:50 am IST |

## Production Check · 05-Nov-2026, Asia/Calcutta

| Time | Check | Result |
|---|---|---|
| 11:48 am IST | First production read mirrors the shared grid | `hedging_sheet.vol_surfaces` 2026-11, source `unwinding 2026-10`, first expiry 27-Oct-2026, Nifty anchor 23,053.10 |
| 11:49 am IST | `GET /api/health` | status ok, `hedging_sheet` connected, 2 surfaces, 2 parameter months, shared surface `unwinding_calculator` 2026-10, Yahoo close 04-Nov-2026 |
| 11:49 am IST | `GET /api/dataset` against the Unwinding Calculator's `/api/dataset` | Source shared; month, label, Deep, moneyness, strikes, 14 expiries, every volatility and both anchors (Nifty 23,053.10, Sensex 74,459.53) identical; this desk's November row kept, Forward Sell Rate 6.50% |
| 11:49 am IST | Unwinding Calculator database | No document changed and no upload logged by a read |
| 11:51 am IST | `GET /api/params?month=2026-12` | December opens from November's parameters; a bad month answers 400 |

## Not Done This Round

No visual baselines were regenerated and no Lighthouse or multi browser run was made. The Blank Inputs strike table header now carries Calculated tags, so the manual visual suite will show that change in Blank Inputs only. A Rate Cap While Selling Forward in an uploaded file is not read; it is set on Surface Parameters.
