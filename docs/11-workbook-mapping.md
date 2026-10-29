# Workbook To Code Mapping

Every formula cell on the five output sheets of the reference workbook, `fixtures/reference/reference-workbook.xlsm`, and the code that reproduces it. The workbook is a test fixture only: app code never imports it.

- `npm run verify:mapping` runs `scripts/extract-mapping.ts`. It lists every formula cell on the five sheets and fails if one is not inside a range below, or if a file named in the Code Function or Test column is missing.
- `tests/golden/g0-workbook.test.ts` compares 4,497 saved values, cell by cell, within 1e-6 relative, or 1e-4 absolute for prices and the bumped Greeks. The values are frozen in `tests/golden/fixtures/workbook-values.json` by `scripts/extract-workbook-values.ts`.
- G0 passes the expiries the workbook typed and the forward growth it pinned to 5.5%, as `tests/golden/cases.ts` shows. The app's own expiry rule picks different dates.

Rows marked **Not Reproduced** are labels, helpers, check columns or the older products left on Product Description; none of them reaches an output.

## Summary Sheet

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| Summary Sheet | C5 | Premium Rate, linked from the Pricing Params rate | `lib/engine/defaults.ts` defaultInputs | tests/golden/g0-workbook.test.ts |
| Summary Sheet | G2:M2, G3:O3, G4:M4, G6 | Expiry helpers: the trade date per column, days to each month, the half month dates and the median offset | `lib/engine/schedule.ts` expiryDates, medianExpiryIndex | tests/unit/engine.test.ts |
| Summary Sheet | E10 | Inbuilt solved by the goal seek | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Solver stage | tests/golden/g0-workbook.test.ts |
| Summary Sheet | F10 | IRR of the product | `lib/engine/hedging-sheet.ts` computeHedgingSheet | tests/golden/g0-workbook.test.ts |
| Summary Sheet | J10 | Spread 2 Sell Level, the target | `lib/engine/structure.ts` deriveTerms | tests/golden/g0-workbook.test.ts |
| Summary Sheet | L10 | Top spread participation derived from the coupon | `lib/engine/structure.ts` deriveTerms | tests/structure.test.ts |
| Summary Sheet | Q10 | Margin as a share of notional | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Stress And Margin stage | tests/golden/g0-workbook.test.ts |
| Summary Sheet | D15:J15 | Option Expiry, delta quantity, delta %, vega weighted volatility, vega, rho weighted forward and rho | `lib/engine/hedging-sheet.ts` computeHedgingSheet, summary | tests/golden/g0-workbook.test.ts |
| Summary Sheet | B21 | Expiry list as text | `lib/tables.ts` summary tables | tests/export/export.test.ts |
| Summary Sheet | B23:F28 | Leg table: strike, option type, quantity in lakh, average price and premium in crore | `lib/engine/hedging-sheet.ts` computeHedgingSheet, summary legs | tests/golden/g0-workbook.test.ts |
| Summary Sheet | G23 | Top strike as a % | `lib/engine/structure.ts` buildStrikes | tests/golden/g0-workbook.test.ts |
| Summary Sheet | H23:M23, M24 | Day 1 vega hedge: strike, expiry, type, quantity, price, premium and delta | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Vega Hedge stage | tests/golden/g0-workbook.test.ts |
| Summary Sheet | F29 | Total premium in crore | `lib/engine/hedging-sheet.ts` computeHedgingSheet, summary | tests/golden/g0-workbook.test.ts |

Typed inputs on this sheet, which are not formulas but are asserted by G0: C2 Trade Date, C3 and D3 spot, C4 NBFC Rate, C6 Margin Growth Rate, C10 to P10 product terms, C12 to H12 expiries, C15 notional, C18 to E18 costs, I25 daily volatility, J29 exposure margin.

## Pricer

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| Pricer | B1, B2 | Trade Date and closing spot | `lib/engine/hedging-sheet.ts` computeHedgingSheet | tests/golden/g0-workbook.test.ts |
| Pricer | A5:V5 | Header: start level, coupon, expiry, mobilisation, Inbuilt, product cost, NBFC amount, premium, rates, tenor, payout, achieved coupon, delta, vega, rho, gamma, IRR and margin | `lib/engine/hedging-sheet.ts` computeHedgingSheet, pricer header | tests/golden/g0-workbook.test.ts |
| Pricer | K7 | **Not Reproduced:** a switch helper the macros toggle | - | - |
| Pricer | B8:B10 | Transaction, issuance and margin cost | `lib/engine/defaults.ts` defaultInputs | tests/golden/g0-workbook.test.ts |
| Pricer | C12:E14 | Coupon, decay, spread payouts, protection and the loss at protection | `lib/engine/structure.ts` deriveTerms, upsideCash | tests/golden/g0-workbook.test.ts |
| Pricer | B17:CS17 | Strike as a % of the start level, per leg | `lib/engine/structure.ts` buildStrikes | tests/golden/g0-workbook.test.ts |
| Pricer | B19:CS19 | Rupee strike, ROUND of start times % | `lib/engine/structure.ts` rupeeStrike | tests/golden/g0-workbook.test.ts |
| Pricer | B20:CS20 | Maturity, the observation expiry of the leg | `lib/engine/schedule.ts` expiryDates | tests/golden/g0-workbook.test.ts |
| Pricer | B21:CS24 | Rate curve brackets: upper and lower maturity and forward. **Deviation:** the workbook's curve carries fixed 2025 dates, the engine anchors each tenor at the trade date. The discount yield they feed is unchanged | `lib/engine/rates.ts` readRateCurve, anchoredCurve | tests/unit/engine.test.ts |
| Pricer | B25:CS25 | Option type per leg | `lib/engine/structure.ts` buildStrikes | tests/call.test.ts |
| Pricer | B26:CS27 | Valuation date and spot | `lib/engine/hedging-sheet.ts` priceOption | tests/golden/g0-workbook.test.ts |
| Pricer | B28:CS28 | Forward growth from the Pricing Params month row | `lib/engine/vol-surface.ts` forwardSellRateForMonth | tests/golden/g0-workbook.test.ts |
| Pricer | B29:CS29 | Discount yield | `lib/engine/rates.ts` pricerDiscountYield | tests/golden/g0-workbook.test.ts |
| Pricer | B30:CS30 | Dividend yield to the leg's maturity | `lib/engine/rates.ts` dividendYield | tests/golden/g0-workbook.test.ts |
| Pricer | B31:CS31 | Forward, spot grown at the forward growth | `lib/engine/hedging-sheet.ts` priceOption | tests/golden/products.test.ts |
| Pricer | B32:CS33 | Surface volatility read per leg, and the vol bump | `lib/engine/vol-surface.ts` interpolateVolPercent, lookupVolBump | tests/golden/g0-workbook.test.ts |
| Pricer | B35:CS36 | Black price in rupees and as a % of spot | `lib/engine/black-scholes.ts` bsPrice | tests/golden/products.test.ts |
| Pricer | B38:CS41 | Incremental margin, its cost and the margin adjusted price | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Legs stage | tests/golden/g0-workbook.test.ts |
| Pricer | B43:CS46 | Full margin, its cost and the margin adjusted price | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Legs stage | tests/golden/g0-workbook.test.ts |
| Pricer | B47:CS47 | Units per strike, the change in payoff slope | `lib/engine/structure.ts` buildStrikes | tests/structure.test.ts |
| Pricer | B48:CS48 | Buy or Sell per leg | `lib/engine/structure.ts` derivedSides | tests/structure.test.ts |
| Pricer | B49:CS53 | Bumped Greeks: delta, gamma, theta, vega and rho | `lib/engine/black-scholes.ts` bsGreeks | tests/golden/g0-workbook.test.ts |
| Pricer | B55:CS62 | Contracts, option value and the Greeks in rupees and contracts | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Legs stage | tests/golden/g0-workbook.test.ts |
| Pricer | AL63, B64:AV64 | **Not Reproduced:** check sums the desk used while building the sheet | - | - |

Columns H, I, P, Q and the other seventh and eighth slots of each strike block are the unused expiry slots when there are six expiries. Columns AX to CS repeat columns B to AW for the second half of the book.

## Product Description

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| Product Description | D14, H19, D20, D21 | **Not Reproduced:** an older product left above the term sheet | - | - |
| Product Description | C27 | Product title | `lib/engine/hedging-sheet.ts` computeHedgingSheet, product description | tests/export/export.test.ts |
| Product Description | O28:Q28 | Weighted average annual, half yearly and quarterly rates | `lib/engine/hedging-sheet.ts` computeHedgingSheet, product description | tests/golden/g0-workbook.test.ts |
| Product Description | H31:H45 | Greek details: delta, total delta, hedge quantity, hedge premium, options delta, residual futures, volatility, vega, forward, rho, leverage and target | `lib/engine/hedging-sheet.ts` computeHedgingSheet, greeks | tests/golden/g0-workbook.test.ts |
| Product Description | D32:E37, D41:D49 | Term sheet: Inbuilt, issuance, transaction cost, margin, NBFC amount, premium, tenor, growth rates, final amounts, maturity amount and IRR | `lib/engine/hedging-sheet.ts` computeHedgingSheet, product description | tests/golden/g0-workbook.test.ts |
| Product Description | G41 | Vega hedge description text | `lib/tables.ts` product description tables | tests/export/export.test.ts |
| Product Description | K32:L53 | Payoff grid: client return and pre tax IRR at each performance | `lib/engine/structure.ts` clientReturn, preTaxIrr | tests/golden/g0-workbook.test.ts |
| Product Description | O32:O42 | **Not Reproduced:** a check column of return steps | - | - |
| Product Description | D68, H72, D74, D75 | **Not Reproduced:** a second, older product below the term sheet | - | - |

## Day1 Vega Hedge

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| Day1 Vega Hedge | C2:F4 | Hedge inputs: spot, daily and annual volatility, hedge strike and hedge expiry | `lib/engine/hedging-sheet.ts` annualVolFromDaily, computeHedgingSheet | tests/golden/g0-workbook.test.ts |
| Day1 Vega Hedge | B8:N22 | Margin table for the 15 moves: level, strike, expiry, quantity, prices, initial, exposure and total margin | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Vega Hedge stage | tests/golden/g0-workbook.test.ts |
| Day1 Vega Hedge | B26:AD40 | Fair price computation for the 15 moves | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Vega Hedge stage | tests/golden/g0-workbook.test.ts |
| Day1 Vega Hedge | B44:AD58 | Exchange price computation for the 15 moves | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Vega Hedge stage | tests/golden/g0-workbook.test.ts |
| Day1 Vega Hedge | B62:AD76 | Stressed price computation for the 15 moves | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Vega Hedge stage | tests/golden/g0-workbook.test.ts |
| Day1 Vega Hedge | AE26:AH40, AE44:AH58, AE62:AH76 | Rate curve brackets. **Deviation:** as Pricer rows 21 to 24 | `lib/engine/rates.ts` readRateCurve | tests/unit/engine.test.ts |

## MTM & Margin req

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| MTM & Margin req | C6:K20 | The 15 moves: level, move, product requirement, option delta, residual futures, futures margin, mark to market, options margin and total | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Stress And Margin stage | tests/golden/g0-workbook.test.ts |
| MTM & Margin req | L6:S20 | Delta change, step mark to market and total as a % of notional, written by the Mark To Market macro | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Stress And Margin stage | tests/golden/g0-workbook.test.ts |
| MTM & Margin req | C21 | Futures margin note text | `lib/tables.ts` margin notes | tests/export/export.test.ts |

## Macros

| Workbook Sheet | Cell Or Range | Meaning | Code Function | Test |
|---|---|---|---|---|
| Macro2 | Goal seek on Summary E10 | Solves the Inbuilt so the payout pays the coupon | `lib/engine/solver.ts` brentSolve | tests/golden/invariants.test.ts |
| Mark To Market Macro | MTM & Margin req O6:R20 | Walks the 15 moves, bumping the Pricer spot, and writes each step | `lib/engine/hedging-sheet.ts` computeHedgingSheet, Stress And Margin stage | tests/golden/g0-workbook.test.ts |
