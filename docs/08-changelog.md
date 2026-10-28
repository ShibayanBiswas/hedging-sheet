# 08 · Changelog

## Round 5

### Test suites

- **Blank Inputs suite, `e2e/blank`.** B1 to B22, one named test per case and table-driven where the list is long.
  - The required-field and invalid-value cases are generated from `requiredFields` and `numberFieldRules` in `lib/inputs/validate.ts`, so no field is skipped.
  - The engine-level parts sit in `tests/unit/validate.test.ts`.
- **Default parity suite, `e2e/default`.** D1 to D7, plus the market data flows. Market status for pre-open, open, closed and holiday is unit-tested in `tests/unit/market-status.test.ts`.
- **Copy rules.** `lib/format/copy-rules.ts` holds the rules. They are checked by a unit test on every label constant and by `e2e/copy-rules.spec.ts` on every page in both modes.
- **Fixtures.** Two are generated from the engine exactly as the app computes it in mock mode:
  - `table-schema.json`;
  - the `mock` section of `regression-expected.json`, whose workbook tie-out part is unchanged.

### App

- **Cell keys.** Every table cell carries `data-cell` and its raw `data-value`, so tests compare numbers exactly, not as rounded text.
- **Coupon Not Reachable.** An unreachable coupon is reported on the Coupon field, with its own popup title and a suggestion.
- **Focus.** Popups take focus and give it back when they close. Arrow keys move through the mode switch and the section tabs. Keyboard focus is always visible.
- **Volatility Bump fix.** Pricer legs now read the Volatility Bump of their expiry from Pricing Params, as Pricer row 33 does. Before, the Surface Parameters edit never reached the prices. The unused `volBump` input is removed.
- **Overridden badge.** A typed daily volatility shows Overridden in both modes.
- **Copy.** Shortforms are spelled out: FORECAST, MTM, MB and ROUNDUP.

### Cleanup

`knip`, `ts-prune` and `depcheck` now report nothing unused.

| Removed | What |
|---|---|
| `e2e/blank-mode.spec.ts` | Replaced by the B1 to B22 suite. `e2e/default-mode.spec.ts` moved to `e2e/default/`. |
| `components/ui/page-motion.tsx` | `MotionBand`, `Stagger`, `StaggerItem`, `MotionPanelShell`, unused |
| `lib/motion.ts` | `bandEnter`, `staggerContainer`, `staggerItem`, `panelHover`, `softPulse`, `fadeScale`, `valuePop`, unused |
| `lib/workbook/export-theme.ts` | `PDF_THEME`, `excelBox`, `excelGoldBox`, `addExcelKpiTiles`, from the card rails the tables replaced |
| `lib/workbook/excel-cells.ts` | `writeExcelCell` and `ExcelCell`, only used by the KPI tiles |
| `components/ui/fields.tsx` | `IssueList`, unused |
| `lib/engine/dates.ts` | `lastWeekdayOfMonthAfter`, `monthsBetween`, from the old expiry rule |
| `lib/format.ts` | `rupeeText` and the `formatDate` re-export |
| `lib/db/mongo-config.ts` | `isMongoConfigured`, unused |
| `lib/engine` | The `volBump` input field |
| npm packages | `clsx`, `tailwind-merge`, `date-fns`, `@testing-library/user-event` |
| `postcss.config.mjs` | The create-next-app type comment that referenced an unlisted package |

52 exports that were only used inside their own file are now private.

These items from the cleanup list were already gone before this round:
- the workbook parity and default JSON files;
- `scripts/extract-workbook-seed.ts`;
- `/api/products` and the saved input sets;
- `kpi-rail.tsx`;
- `tests/parity.test.ts`;
- the create-next-app SVGs.

The local workbook and prompt files are git-ignored and were left in place.

### Decisions

- **Sheet name.** The fifth Excel sheet stays "Mark To Market And Margin", following the capitalisation rule, rather than the "Mark to Market and Margin" written in B17.2.
- **Number Of Spreads.** The stepper keeps its count of 2 in Blank Inputs so the six strike boxes can render. It is a control, not a value, so B1.1 leaves it out.
- **Invalid dates.** The date control cannot hold one, so B3.8 checks a future date in the browser and malformed dates such as 2026-02-30 in the unit tests.
- **Floor level.** A floor at or above protection less the step sits at or above Strike 5, so the strike order rule reports it, naming both strikes.
- **Cross-browser runs.** Rule and number checks run once, on desktop Chromium. The other three projects run the flows, the keyboard, layout and accessibility checks.
- **Production smoke trigger.** Vercel does not post GitHub deployment events for this repository, so the production smoke also runs after CI succeeds on `main`.

## Round 4

### Two input modes

- **Mode switch.** A full-width pill at the top of Inputs: Default Values, with the live spot, today's date and the calculated volatility, and Blank Inputs, where every field starts empty with an "Eg …" placeholder and the selects ask to choose. Switching asks to confirm, then resets the inputs and clears the results. Nothing is persisted.
- **Blank Inputs.** The expiry count comes first and that many empty month rows appear; computed dates show "-" until they can be worked out. Fetch Live Spot and Compute Volatility From History fill only their own fields. Surface parameters still come from the desk database.
- **Validation.** `lib/inputs/validate.ts` returns every missing or invalid field with its section, label, message and fix. Run Simulation with errors opens "Missing Or Invalid Inputs", grouped by section, with Go To First Field; closing it focuses the first invalid field. Invalid fields get `aria-invalid`, a red ring and inline text. Expiries past the surface stay a warning, so the desk product still runs.
- **Run gate.** Results appear only after a successful run. Changing any input brings the gate back with Inputs Changed; Pricer and hedge volatility overrides and market data changes keep the results and show the banner.
- **Test ids.** Every field is `input-<key>`, and every button, table, dialog and tab has a `data-testid`.

### Capitalisation

- Every word of headings, tabs, buttons, table headers, popup titles, field labels, Excel sheet names and header rows, and Logic Atlas titles and cards is capitalised, small words included. `lib/format/title-case.ts` holds the rule and the allowlist (%, ₹, Cr, L, numbers, dates, BSE, NSE). The Excel sheet is now "Mark To Market And Margin".

### Accessibility

- Gold label text on light panels is a deeper shade for 4.5:1 contrast, the dark ghost buttons are lighter, and every scrolling table is a labelled, keyboard-focusable region.

### Test framework

- Vitest split into unit, component, API and export layers with v8 coverage thresholds; Playwright across Chromium, Firefox, WebKit and Pixel 7 in mock mode with page objects; axe, visual, performance and read-only production specs; Lighthouse budgets; CI with 4 shards and a production smoke after each deployment. See [07 · Testing and Debug](07-testing-debug.md).

## Round 3

### Tables and copy

- **Single source.** Every headline, summary block, Pricer table, Product Description table, Day 1 grid and stress grid is defined once in `lib/tables.ts`, then rendered on screen and written to Excel.
- **Summary Sheet.** Market and Rates, Product Specification, Final Expiries, Product Greeks, Costs, Options Details, Day 1 Vega Hedge, and Volatility and Margin, each as a table.
- **Pricer.** Pot Computation lists B5 to V5 in sheet order. The leg grid header is the strike as "137% · 1,05,901" over the real expiry date; "Strike Block", "Field" and "Expiry N" are gone. Rows follow Pricer column A. Only live legs are shown.
- **Product Description.** Term Sheet, Product Details, Maturity Details, Greek Details with the sheet's twelve rows, and Weighted Average Rates. The payoff chart and scenario table follow the Primary SP Dashboard, and the Description column is gone.
- **Day 1 Vega Hedge.** The fair, exchange and stressed grids use the Pricer row set.
- **Mark to Market and Margin.** The group header row, the helper columns and the jargon intro are gone; the headline is a table.
- **Copy.** "%" replaces the word "percent" everywhere, including popups and Excel. No bracketed text.

### Market data

- **Forward data only.** Pricing Params rows from the valuation month on, and implied dividends from the valuation date on. Older rows are never looked up by a live expiry.
- **Surface Parameters editor.** Bid or Offer, Volatility Bump, Incremental Margin, Full Margin, Margin Cost, Forward Sell Rate, the dividend factor, both rate caps, the Premium Growth Rate link and the rate curve. Saved per month in the desk database, with a Reset.
- **Vol surface toolbar.** Edit Surface, Upload Surface and Download Surface, with cell validation. Download Surface writes the upload layout. Expiry rows before the valuation date are hidden.
- **Labels.** They follow the underlying: Reference Underlying Price, the selected underlying's strike row, and Implied Dividend In Index Points.

### Footer, status and Logic Atlas

- **Footer.** Both closes, Fetched At in IST, the market status, the data source, the Mongo status and the desk clock. The header strip keeps the valuation date, surface and simulation status.
- **Market status fix.** A weekday before the open was labelled a holiday or weekend. It is now Pre Open.
- **Logic Atlas.** Twelve sections with detailed descriptions, formulas in words with their sheet and row, edge cases, a primitives table, and a Debug Drawer with live goal-seek steps, per-leg values and the curve points used.

### Verification

- **Tests.** Acceptance tests for the closed form, parity, Greeks, the goal seek, Mark to Market parts and the expiry rule. A frozen regression fixture with explicit dates ties out to the approved numbers.
- **Scripts.** `verify:pricer`, `verify:vol-upload`, `verify:edge-cases`, `verify:mongo`, `bake:vol-surface` and `e2e:local` match the other desk apps.
- **Findings.** The saved sheet's H69 points at the 29-Oct-2026 row, not its August valuation month. The live-spot figures of 12,320.29 and 8.86% came from Round 1's last-Thursday expiries. See [02 Calculation Logic](02-calculation-logic.md#regression-and-live-tie-outs).

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
