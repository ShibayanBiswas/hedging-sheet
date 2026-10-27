# 01 · Layout Plan

The Hedging Sheet app rebuilds the workbook `Hedging Sheet 5y Accelerator_Aug26_Approval_.xlsm` as a desk web app. It uses the same design system as the Unwinding Calculator: maroon and gold masthead, glass cards, mesh background, a dark and light toggle, Times New Roman for body copy and Segoe UI for cards, inputs and tables.

## Header

- ARWL logo, then the title "Hedging Sheet".
- An underlying badge that reads Nifty or Sensex.
- The live spot with a "Fetched At" chip.
- The theme toggle.
- One primary button, "Download Excel". It is the only download in the app, apart from the vol surface sample on the Market Data page.

## Navigation

The app is one page per section, with a sticky nav rail under the masthead. The active tab has an animated gold underline.

| Order | Route | Section |
|---|---|---|
| 1 | `/` | Inputs |
| 2 | `/summary` | Summary Sheet |
| 3 | `/pricer` | Pricer |
| 4 | `/product` | Product Description |
| 5 | `/vega-hedge` | Day 1 Vega Hedge |
| 6 | `/margin` | Mark to Market and Margin Requirement |
| 7 | `/market-data` | Market Data |
| 8 | `/logic-atlas` | Logic Atlas |

All pages share one input state held in a React context, so a change on Inputs reprices every output page. The state is kept in session storage so a refresh keeps the inputs.

## Layout rules

- Every table, section and subsection takes the full width of the content area. No side-by-side half-width tables.
- Metrics sit as cards in a horizontal rail. On wide screens the cards fill the width equally. When they do not fit, the rail scrolls sideways.
- Wide tables scroll sideways inside a full-width card. The first column and the header are sticky. Numbers are tabular and right-aligned.
- Every output page starts with a KPI rail, then full-width tables in the same order and with the same labels as the workbook, cleaned per the copy rules.

## Inputs page

Segregated full-width sections, each a glass card:

1. **Underlying and Market.** Underlying segmented control, Mode switch between Workbook Defaults and Live, Valuation Date, Spot, Refresh From Yahoo, Hedge Strike.
2. **Rates in Percent.** NBFC Rate, Premium Growth Rate, Margin Growth Rate.
3. **Product Terms.** Target, Coupon, Protection, Decay, Tenor in Days, the Maturity Date chip, the Start Level Uplift.
4. **Observation Expiries.** Number Of Expiry Dates, one Expiry Month Number field per expiry with an animated date chip, manual date override, and the Option Expiry select.
5. **Strikes.** The derived strike list, highest to lowest, with the count check against the expiry count.
6. **Spreads.** Number Of Spreads stepper and one card per spread.
7. **Notional and Costs.** Notional in Crore, Transaction Cost, Issuance Cost, Margin Cost.
8. **Volatility and Margin.** Daily Volatility, the derived Annual Volatility, Compute Daily Volatility From History, Exposure Margin, Futures Margin, and the exchange and stressed rates used by the Day 1 Vega Hedge.

A "Reset To Workbook Defaults" button sits at the top of the page. Inputs are validated with zod and reprice live after a 150 ms debounce.

## Output pages

- **Summary Sheet.** KPI rail with Actual Inbuilt, Option Premium, Maturity Payout, Margin Requirement, Hedge Quantity, Net Vega, Net Delta and Internal Rate of Return. Then Product Specification, Product Greeks, Costs, Options Details and the Vega Hedge block.
- **Pricer.** Header block with the pots, then the leg grid with one column per live leg, grouped by strike, and every workbook row from Strike Percent to Rho in Rupees.
- **Product Description.** Term sheet cards, the accelerator block with the three pots, the payoff chart and the payoff table.
- **Day 1 Vega Hedge.** Margin Computation table, then the Fair Price, Exchange Price and Stressed Price computation grids for moves from minus 50 percent to plus 20 percent.
- **Mark to Market and Margin Requirement.** The A, B and C column groups, helper columns, the highlighted 0 percent row and a Worst Case Requirement card.

## Market Data page

The same pattern as the Unwinding Calculator: the vol surface grid with heat tint and sticky headers, the Surface Parameters, the rate curve and dividends, an upload that replaces the active surface, a sample download, and an Edit Surface toggle with Save and Discard.

## Logic Atlas

A horizontal module rail in the Primary SP Dashboard style, with descriptive copy only. A debug drawer shows the solver and loop iteration counts.

## Motion

`deskEase` everywhere, staggered reveals of 40 to 60 ms per card, count-up KPI values, a gold shimmer while a card recalculates, `AnimatePresence` for the expiry and strike fields, an animated tab underline, hover lift on table rows, and chart entrance animation. All motion respects `prefers-reduced-motion`.
