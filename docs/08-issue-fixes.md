# 08 · Issue Fixes

Every item of the workbook risks list, plus the display issues found while rebuilding it. Where a fix would change a saved number, the engine keeps the workbook behaviour so `tests/parity.test.ts` stays green, and the note says so.

## Workbook risks list

| Number | Workbook issue | What the app does |
|---|---|---|
| 1 | The Inbuilt is a pasted goal-seek result and goes stale when any input moves. | Brent's method with a bisection fallback solves the Inbuilt on every change, to a 1e-10 tolerance. It matches the saved Inbuilt to 7e-10 relative. |
| 2 | The MTM macro writes each move into the Pricer spot and never resets it. | Book delta is repriced directly at each shocked spot in a pure function. No shared spot exists, so nothing can be left shocked. |
| 3 | The rate curve ends on 30-Dec-2025, before the trade date, so every leg reads the last point and Lower Maturity is blank. | The engine reproduces this exactly for parity. Lower Maturity shows "-". The curve is visible on Market Data and can be replaced through the upload's Rate Curve sheet. |
| 4 | Dividends are computed in the Pricer but not used in the price. | Kept as in the workbook: shown in the Pricer, used only in the Day 1 fair growth. The saved list runs to Jul-2029, not Nov-2025 as the walkthrough says. For Nifty the Sensex points are scaled by the ratio of the two anchors. |
| 5 | The surface anchor of 76,835.78 differs from the spot of 76,799. | Workbook Defaults keep the 76,835.78 anchor so parity holds. Live mode uses the active surface's anchors, which carry into each month from the Yahoo close on the 1st. Market Data shows both anchors. |
| 6 | Copied 2029 rows and difference formulas sit inside the named range read by the vol lookup. | Only real expiry rows are read. Beyond the last row the vol is held flat, never extrapolated through the difference row. |
| 7 | Pricer forward growth is pinned to one Pricing Params cell, and the chain below it is irregular. | Forward growth is looked up by expiry, on or before. All rows equal 5.5 percent in the saved file, so values are unchanged. |
| 8 | The Product Description payoff hard-codes every constant, and two legacy product blocks are unrelated. | The payoff is generated from the inputs. Payoff levels are generated from the strikes, the protection step, zero and regular steps. The legacy blocks are dropped. |
| 9 | Strike keys, the 70 strike and the floor units are hard-coded. | Strikes come from the spreads, protection, one point below it and the Decay Floor Level input. Units come from the slope rule. Floor Units is an input. |
| 10 | The margin uses only the 0 percent row. | Kept for parity. The 0 percent row is highlighted and a Worst Case Requirement card shows the worst row, with a note. |
| 11 | The macro delta range stops two columns short of the book delta range. | The full leg set is always summed. |
| 12 | The Summary vol and forward are weighted by signed vega and rho, so long and short legs offset. | The parity value is kept and labelled Vega Weighted Volatility with an explanation. An Absolute Vega Weighted Volatility, weighted by the size of each leg's vega, sits beside it. |
| 13 | A broken name formula and a filter pointing to a deleted range. | Not reproduced. Any value that cannot be computed renders as "-" with a tooltip giving the reason, never NaN or Infinity. |
| 14 | Names point to external workbooks on another drive. | Not reproduced. |
| 15 | Dead cells, a stale pivot sheet and an unused mirror sheet. | Not reproduced. The Excel download holds only the five working sheets. |
| 16 | Exchange and stressed rates are typed separately from the curve. | They are inputs in the Volatility and Margin section, next to the stress sigmas, days and volatility multiplier. |

## Display and copy fixes

- **Dates.** Day 1 Upper Maturity, Lower Maturity and Upper Forward showed 00-Jan-00 or a time such as 01:33:36. Every date column now shows DD-MMM-YYYY or "-" when blank, zero or not applicable, on screen and in the Excel file. Upper Forward and Lower Forward are percentages.
- **Labels.** Abbreviations, brackets and "/" are gone. Examples: "Prd Req. (L)" is "Product Requirement in Lakh", "(A + B + C)" is "Total of Futures Margin, Mark to Market and Options Margin", "Trans Cost (%)" is "Transaction Cost", "Px." is "Price", "C/P" is "Call or Put", "BID/OFFER" is "Bid or Offer".
- **Underlying.** No copy hard-codes Sensex. A Playwright test switches to Nifty and checks that the Summary, Pricer, Product Description, Day 1 Vega Hedge and margin pages contain no Sensex text. The Market Data page names both indices on purpose.
- **Exposure margin.** The unreferenced Summary cell and the buried Day 1 rate are replaced by one Exposure Margin input.
- **Derived spot.** The derived spot always equals the fetched spot. The hedge strike defaults to the nearest 100 point listed strike of the spot, which gives the workbook's 76,800 from 76,799, and can be overridden.
- **Numbers.** Crore values use Indian grouping with two decimals.

## Fixes found while rebuilding

- **Notional.** The Summary margin divided by a hard-coded 100 and the Product Description started from a hard-coded 100. Both now use the Notional in Crore. Values are unchanged at 100 crore.
- **Pricing Params lookups.** Exact date lookups threw #N/A for any expiry not in the table. Lookups now take the row on or before the expiry, which equals the exact match for every saved expiry.
- **Excel sheet names.** Excel caps sheet names at 31 characters, so the fifth tab is "Mark to Market and Margin". Its masthead carries the full title.
- **Upload parser.** A masthead sentence that mentioned "Strike Change" was taken for the header row. Only short header cells count now. A round-trip test reads the generated sample back to the seed.
- **Session restore.** A click landing between hydration and the session restore was persisted and then restored on top of itself. The restore now runs in a layout effect, before any input can be handled.
- **Expiry weekday.** Nifty defaults to the last Tuesday and Sensex to the last Thursday, per NSE circular FAOP 68747 and BSE notice 20250623-59, both effective 1 September 2025.

## A finding about the margin loop

The walkthrough describes a loop from the margin to the Inbuilt and back. In the formulas the margin depends only on the legs, the hedge and the market, not on the Inbuilt. The fixed-point loop is still in place and settles on its first pass. The pass count is in the Logic Atlas debug drawer.
