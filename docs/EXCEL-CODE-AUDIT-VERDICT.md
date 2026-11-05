# Excel Code Audit Verdict

VERDICT: PASS WITH DOCUMENTED DEVIATIONS — Project Complete

## Scope

This audit checks the reference workbooks' logic against the TypeScript engine independently, with every Pricer row checked cell by cell, and walks the macro flow end to end. Workbooks: G0, the August 2026 Sensex approval (`fixtures/reference/reference-workbook.xlsm`), and G1, the 17-Jul-2026 Nifty rollover (`fixtures/reference/nifty-rollover-workbook.xlsm`). Audited on 05-Nov-2026 between 1:27 pm and 1:55 pm IST.

| Item | Value |
|---|---|
| Audited code | `e3f7c63` (engine), through `884fa16` |
| Fix shipped | `4f4b2f6`: the Pricer volatility override keeps its gold ring |
| CI | [Run 41993282620](https://github.com/ShibayanBiswas/hedging-sheet/actions/runs/41993282620), success at 1:49 pm IST |
| Production Smoke | [Run 41993550214](https://github.com/ShibayanBiswas/hedging-sheet/actions/runs/41993550214), success at 1:51 pm IST |
| Vercel production | `4f4b2f6` Ready at 1:47 pm IST |

## Phase A · Mechanical Gates

| Command | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass, no warnings |
| `npm run verify:mapping` | Pass: 5,821 formula cells on 5 sheets, 5,821 mapped, every named file exists |
| `npm run verify:calculations` | Pass: Inbuilt solves to the coupon (gap 0), book matches payoff at every kink (4.88e-15), spot bump reset after the stress grid (0), Lower Maturity resolves for all 36 legs, every price finite, 15 stress moves |
| `npx vitest run tests/golden` | Pass: 5 files, 79 tests (G0, G1, invariants, products, blank fill) |
| `npm run test:ci` | Pass: 78 files, 749 tests; 750 with this round's regression test |
| `npm run build` | Pass |

## Pricer Audit

"G0" and "G1" give the cells compared on each workbook. A cell passes within 1e-6 relative, or 1e-4 absolute for prices and the bumped Greeks. Every listed row had zero misses on both workbooks unless the result says otherwise.

| Row | Meaning | Code | G0 | G1 | Result |
|---|---|---|---|---|---|
| B5 | Start Level, ROUNDUP(spot × 1.006, −2) | `startLevel` | 1 | 1 | Pass |
| C5 | Coupon | inputs | 1 | 1 | Pass |
| D5 | Expiry | `expiryDates` | 1 | 1 | Pass |
| E5 | Mobilisation | header | 1 | 1 | Pass |
| F5 | Actual Inbuilt | `brentSolve` | 1 | 1 | Pass on G0. G1 deviation: the workbook keeps a pasted Goal Seek H5, 0.015% from a fresh solve |
| G5 | Product cost | header | 1 | 1 | Pass |
| H5 | Inbuilt in rupees | `brentSolve` | 1 | 1 | Pass on G0. G1 deviation: the same pasted Goal Seek |
| I5 | Transaction cost in rupees | header | 1 | 1 | Pass |
| J5 | Net mobilisation | header | 1 | 1 | Pass on G0. G1 deviation: it follows H5 and the typed Summary Q10 |
| K5 | Premium | sum of row 56 | 1 | 1 | Pass |
| L5 to N5 | NBFC rate, premium rate, tenor | inputs | 3 | 3 | Pass |
| O5 | Maturity payout | header | 1 | 1 | Pass |
| P5 | Achieved Coupon | header | 1 | 1 | Pass: 102.5% on both, gap 0 |
| Q5 to T5 | Delta, vega, rho, gamma | sums of rows 57 to 62 | 4 | 4 | Pass; largest gap 2.7e-6 absolute on T5 |
| U5 | IRR | header | 1 | 1 | Pass |
| V5 | Margin cost | header | 1 | 1 | Pass on G0. G1 deviation: the typed Summary Q10 |
| 17 | Strike % | `buildStrikes` | 72 | 84 | Pass |
| 18 | Underlying label | - | - | - | Deviation: typed text, "Sensex" even on the Nifty book; the app labels from the inputs |
| 19 | Rupee strike, ROUND(B5 × B17%, 0) | `rupeeStrike` | 72 | 84 | Pass |
| 20 | Maturity | `expiryDates` | 72 | 84 | Pass |
| 21, 22 | Upper and Lower Maturity | `readRateCurve`, `anchoredCurve` | - | - | Deviation: the workbook curve holds fixed 2025 dates; the engine anchors tenors at the valuation date. Rows 23, 24 and 29, which they feed, match |
| 23, 24 | Upper and Lower forward | `readRateCurve` | 72 | 84 | Pass |
| 25 | Option type | `buildStrikes` | 72 | 84 | Pass |
| 26, 27 | Valuation date, spot | `priceOption` | 144 | 168 | Pass |
| 28 | Forward growth | `forwardSellRateForMonth` | 72 | 84 | Pass: G0 pins 5.5%, G1 6.6% (H69); live reads the valuation month row |
| 29 | Discount yield, MIN(cap, FORECAST) | `pricerDiscountYield` | 72 | 84 | Pass: put on Bid takes the selling cap, put on Offer the buying cap |
| 30 | Dividend yield | `dividendYield` | 72 | 84 | Pass. G1 relies on the Logic Round's parser fix, which reads all 119 dividends |
| 31 | Forward | `priceOption` | 72 | 84 | Pass |
| 32 | Volatility | `interpolateVolPercent` | 72 | 84 | Pass: bilinear, Deep ₹500 equals 55% |
| 33 | Volatility bump | `lookupVolBump` | 1 | 84 | Pass |
| 34 | Bid or Offer | params | 72 | 84 | Pass |
| 35, 36 | Black price in rupees and % | `bsPrice` | 144 | 168 | Pass; largest gap 2.2e-11 |
| 37, 42, 54 | Blank separators | - | - | - | Not applicable |
| 38, 40 | Incremental margin and its cost | Legs stage | - | 168 | Pass on G1; G0's frozen fixture saves no value (zero on Bid) |
| 39, 41 | Margin cost, adjusted price | Legs stage | 144 | 168 | Pass |
| 43 to 46 | Full margin, cost, rupees, adjusted price | Legs stage | 288 | 336 | Pass |
| 47 | Units | `strikeUnits` | 72 | 84 | Pass: G1's −91.5 top spread units match |
| 48 | Buy or Sell | `derivedSides` | 72 | 84 | Pass |
| 49 to 53 | Bumped delta, gamma, theta, vega, rho | `bsGreeks` | 360 | 420 | Pass; largest gap 2.9e-11 |
| 55 to 62 | Contracts and the values and Greeks in rupees and contracts | Legs stage, two halves | 576 | 672 | Pass; largest relative gap 2.9e-6 on row 59 gamma contracts, within 1e-4 absolute |

Pricer rows failed: none.

## Flow Checklist

| Stage | What was checked | Result |
|---|---|---|
| B1 Inputs And Derived Terms | Spot and trade date; Start Level ROUNDUP; strikes, target, spreads, protection, outflow and floor (`deriveTerms`); top participation L10 derived (G1: 91.5); G0's typed expiries (the app's own rule may pick other dates, documented in mapping); G0's typed hedge strike 76,800, with Auto for live | Pass |
| B2 Macro2 Goal Seek | Achieved Coupon = Coupon 102.5% on both, gap 0; Actual Inbuilt 7.9499% matches G0 | Pass |
| B3 Rate Curve, Forward, Dividend, Volatility | Rows 21 to 36 above, 36 legs on G0 and 42 on G1, both halves of the book | Pass, with the curve date deviation |
| B4 Book Totals And Call Equivalence | Totals are twice one half; `tests/call.test.ts` and `products.test.ts` keep all Call and mixed books equal to all Put; book to payoff gap 4.88e-15 | Pass |
| B5 Day 1 Vega Hedge | Fair, exchange and stressed blocks and the B8:N22 margin table: 1,464 G0 cells, zero misses; quantity, premium and residual futures match. G1 numbers match; 45 misses are the template's "Sensex" text | Pass |
| B6 Mark To Market | 15 moves from −50% to +20%; spot bump reset to 0; options margin from Day 1 N8. G0 180 cells, zero misses. G1 columns C, D, F and J match | Pass, with the G1 typed column E deviation |
| B7 Summary And Product Description | G0 Summary 84 and Product Description 73 cells, zero misses (Greek details H31:H45, payoff grid K32:L53); the older products stay Not Reproduced as mapped | Pass |
| B8 G1 Nifty Rollover | Seven expiries, every one a Tuesday; 42 legs; Nifty Auto hedge strike rule; no Sensex-only hard coding | Pass |

## G0 And G1

| Case | Cells compared | Misses | Largest gap |
|---|---|---|---|
| G0 | 4,497: Summary 84, Pricer 2,696, Product Description 73, Day 1 Vega Hedge 1,464, Mark To Market 180 | 0 | 1.3e-5 relative on Pricer T5, which is 2.7e-6 absolute |
| G1 | Pricer 3,140; Summary 84; Day 1 Vega Hedge 1,464; Mark To Market 180; Product Description 34. `tests/golden/g1-nifty-rollover.test.ts` asserts the key cells | Only the typed cells below | Formula cells within tolerance |

## Known Deviations

Typed cells in the workbooks, kept out of the app:

| Cell | Workbook | Why |
|---|---|---|
| Summary D3 | G1 | A second spot, 24,334.30. The app has one spot, the derived 24,264.86; both give Start Level 24,500 |
| Pricer H5, Summary Q10, and F5, J5, V5 from them | G1 | Pasted Goal Seek results, 0.015% from a fresh solve |
| Summary P10 | G1 | A stale spread width |
| Mark To Market column E, and G, H, I, K, O, P, R from it | G1 | Product requirement typed for a 100 Crore book while Summary C15 is 3 Crore |
| Product Description D31, and D32 to D34 and D49 from it | G1 | Notional typed as 100 Crore against 3; D49 shows −40.96% where the workbook's own Summary F10 and the engine give 14.196% |
| Pricer row 18, Day 1 Vega Hedge column Q | G1 | "Sensex" label text on a Nifty book |

Intentional live differences:

| Difference | Why |
|---|---|
| Rate curve rows 21 and 22 | Tenors anchored at the valuation date instead of fixed 2025 dates; the discount yield is unchanged |
| Dividends | A live run reads dividends on or after the valuation date; G0 keeps the full saved list |
| Surface | Live reads the Unwinding Calculator's active grid; the workbooks' MarketData grids are fixtures only. No live code path reads them |
| Forward growth | Live reads the valuation month's row; G0 and G1 pin 5.5% and 6.6% as the workbooks do |

A worked example of the expected drift: G0 prices 04-Aug-2026 at spot 76,799 (Start Level 77,300) on the August MarketData grid with forward growth pinned at 5.5%, and solves the Actual Inbuilt to 7.95%. Live on 05-Nov-2026, Default Values prices spot 77,301.40 (Start Level 77,800) on the Unwinding Calculator's grid with the November forward of 6.50%, and solves it to 3.31%. Both reach the 102.50% coupon and the same 14.20% IRR, which depends only on the coupon and the 1,940 day tenor.

## Production Spot Check · 05-Nov-2026

| Time | Check | Result |
|---|---|---|
| 1:45 pm IST | `GET /api/health` | ok; `sharedSurface` is `unwinding_calculator` 2026-10 |
| 1:45 pm IST | Grid against the Unwinding Calculator's `/api/dataset` | Source shared; month, label, Deep 500, moneyness, strikes, expiries, every volatility and both anchors identical; Deep equals the 55% column on every row |
| 1:43 pm IST | Default Values Run | Toast bottom right; Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge and Mark To Market populate with no run gate |
| 1:43 pm IST | Pricer | Headline: Start 77,800, Actual Inbuilt 3.31%, Premium ₹45.99 Crore, Payout ₹202.50 Crore, Achieved Coupon 102.50%, IRR 14.20%. The leg grid has 36 volatility cells, the live legs only; an override is marked and Reset clears it. No value shows more than 3 decimals |
| 1:52 pm IST | Pricer override ring after `4f4b2f6` | Gold inset ring, `rgba(212, 178, 76, 0.65)`, shown with the Overridden badge |
| 1:45 pm IST | Blank Inputs | Nifty, 05-11-2026 typed shows 05-Nov-2026; Fetch gives 23,960.60, Hedge Strike 24,200 Calculated, Start Level 24,200, Fetched At 1:45 pm IST |
| 12:23 pm IST | Surface Parameters | Every row editable with a default; month picker; Save round trip; Reset reloads (from [Project Complete](PROJECT-COMPLETE.md)) |
| 1:45 pm IST | Downloads | Summary Excel and PDF; Pricer Excel with a Pricer sheet whose Volatility row carries all 36 legs |

## Fixes Shipped This Round

`4f4b2f6`, a display fix found on the live Pricer. A later white-background rule, `.data-table-premium tbody td { box-shadow: none !important }`, had wiped out the gold ring of an overridden volatility cell, leaving only the badge. One rule restores the ring; `tests/unit/design-tokens.test.ts` fails without it. No engine formula needed a change.

![The overridden volatility with its gold ring on production](screenshots/audit-pricer-override-ring.png)

## Close

The engine reproduces every formula of both reference workbooks within the golden tolerance. Every remaining difference is a typed workbook cell or an intentional live choice listed above. The Hedging Sheet is desk-ready, and further work is maintenance only.
