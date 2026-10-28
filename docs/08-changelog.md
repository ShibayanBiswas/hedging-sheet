# 08 · Changelog

## Round 2

### Model

- **Live defaults only.** The saved-day mode and every fixed-date default are gone. Spot comes from the last close, the valuation date is today in India, daily volatility is calculated from one year of history, and the surface and its parameters come from the latest month in the desk database. Product terms are unchanged.
- **Strikes are the primary inputs.** Spreads, target, protection and the decay floor are read from them. The top participation is derived from the coupon, can be overridden and resets to derived. Spread edits write back to strikes.
- **Option Type.** One Put or Call input feeds every Option Type column on screen and in Excel.
- **Expiries.** The weekday is fixed by the underlying, Sensex Thursday and Nifty Tuesday. The date is the nearest such weekday to the valuation date plus the months times 30.5 days. Manual dates are removed. The count runs from 1 to 8 and months must rise strictly.
- **Rate curve.** The curve is a list of tenors anchored at the valuation date and extended a year past the longest expiry, so Upper and Lower Maturity always resolve. This fixes the stale curve that ended before the trade date.
- **Forward growth.** Every leg takes the Forward Sell Rate of the valuation month, as `'Pricing Params'!H69` does.
- **Discount yield cap.** The cap now depends on the option type and Bid or Offer.
- **Bid or Offer** moved from the inputs to the surface parameters, Bid by default.
- **Mark to Market loop.** The spot bump is set, the delta read, and the bump reset to 0 for every move, as the macro does; the reset is checked after every run.
- **Volatility overrides.** Any Pricer leg and the Day 1 fair volatility can be overridden, with Overridden badges and reset.

### Interface

- Full-width pill tabs with icons in the Primary SP Dashboard style, a market strip, a command palette and a new header with the upload shortcut.
- Inputs holds inputs only. Strikes sit in one row of cards with roles, units and Buy or Sell. Volatility and Margin is split into five subsections with a Compute From History button.
- **Run Simulation** replaces live repricing. Output tabs ask for a run until the first one and show an Inputs Changed banner when the inputs move.
- Every card rail is replaced by a Headline table, and every block is a full-width table.
- Blocking popups with a How To Fix line for every edge case. See [10 Edge Cases](10-edge-cases.md).
- Market Data edits Bid or Offer, the rate caps and the rate curve tenors.
- Logic Atlas uses the Primary console layout: module rail, pipeline with node selection, Module Intelligence, Module Outputs, Flows and the Debug Drawer.

### Removed

- Saved input sets, input persistence and the products API.
- The saved-day defaults, their fixtures, the extraction script and the parity test, replaced by invariant tests.

## Round 1 fixes still in place

| Issue in the original sheet | What the app does |
|---|---|
| The Inbuilt is a pasted goal-seek result and goes stale. | Brent's method solves it on every run to 1e-10. |
| The MTM macro leaves the Pricer spot shocked. | The bump is reset to 0 after every move. |
| Copied rows and difference formulas sit inside the vol lookup range. | Only real expiry rows are read; beyond the last row the vol is held flat. |
| The payoff table hard-codes every constant. | The payoff is generated from the inputs. |
| Strike keys, the 70 strike and the floor units are hard-coded. | Strikes and Floor Units are inputs; units come from the slope rule. |
| The macro delta range stops two columns short. | The full leg set is always summed. |
| The Summary vol is weighted by signed vega. | The value is kept and labelled; an Absolute Vega Weighted Volatility sits beside it. |
| Broken names, external links and dead sheets. | Not reproduced. Values that cannot be computed show "-" with a tooltip. |
| Dates shown as 00-Jan-00 or a time. | Every date is DD-MMM-YYYY or "-". |
| Abbreviations, brackets and "/" in labels. | Full words throughout. |
| Hard-coded 100 crore notional. | Notional in Crore is used everywhere. |
| Exact-date Pricing Params lookups. | Lookups take the row on or before the date. |
| Excel caps sheet names at 31 characters. | The fifth sheet is "Mark to Market and Margin"; its masthead has the full title. |

## The margin loop

The margin depends only on the legs, the hedge and the market, not on the Inbuilt. The fixed-point loop is kept and settles on its first pass; the count is in the Debug Drawer.
