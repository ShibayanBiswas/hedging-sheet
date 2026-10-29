# 08 · Changelog

## Round 11: Fewer Columns And Tables On Market Data

| Area | Change |
|---|---|
| Columns | Used In is gone from Surface Parameters; Linked To Premium Growth Rate and Rate Used % are gone from Rate Curve Points. The Premium Growth Rate Link row still sets the link |
| Tables | Pricing Parameters By Expiry, the forward grid, Rate Curve As Read and Implied Dividends are gone from Market Data, with their footnotes and Show History buttons |
| Engine | Unchanged: the forward grid, the rate curve and the dividends still price every leg, and the frozen regression and table schema regenerate identically. The forward grid now keeps one row per date, the first; the built in surface repeated 25-Mar-2027 with the same values |
| Surface file | Download Current Surface still writes the forward grid, the Rate Curve with its linked flags and the Dividends sheets, so a downloaded file uploads back without losing pricing data |
| Tests | `tests/unit/forward-grid.test.ts`, `tests/copy/removed-display.test.ts` and `e2e/removed-display.spec.ts` |

## Round 10: Mapping, Golden Tests, Crawls And Sign Off

| Area | Change |
|---|---|
| Strikes | Each strike takes its own Option Type and Buy Or Sell. A strike on the wrong side shows "This Strike Must Be A Buy To Give The Product Payoff" under it and turns Run off. A call strike carries a futures leg worth contracts × discount × (forward − strike), so every total equals the all Put book; Summary shows the Futures Adjustment For Call Strikes row in crore. Spreads keep Buy Level, Sell Level and Participation only. Strikes can be added at any level between the target and protection, and spread strikes removed |
| Limits | Up to 12 expiries. A protection of 0% is allowed, for a product with no protection |
| Warnings | `loss-cap` when the decayed loss reaches 100% before a 90% fall |
| Surfaces | Plain white everywhere, no dark theme; controls carry a faint neutral fill with a 1 px border; Run Simulation keeps a maroon border |
| Numbers | At most 3 decimals on screen and in every Excel number format |
| Tables | One line per cell, no pinned column, long tables scroll in a box of at most min(70vh, 40rem) with a sticky header; "Total Margin In Crore" with a tooltip |
| Expiries | The hedge expiry reads "Observation And Hedge Option Expiry", and follows the chosen Option Expiry |
| Footer And Inputs | The footer fills the width; the gap above the footer is at most 24 px |
| Market Data | Deep is the 55% column everywhere and reads "Deep" |
| Logic Atlas | No primitives table; insights and outputs from the last run; a Debug Drawer with stage timings, the input hash and Copy JSON; never shows a run made with other inputs |
| Stale Results | Download Excel is off while the inputs differ from the last run |
| Copy | No wording about the spreadsheet the app replaced; `lib/workbook` is now `lib/excel`; underlying names come from `lib/underlyings.ts` |
| API | `daily-vol` refuses an unknown underlying with 400 |
| Tests | Golden G0 to G6 and fast-check invariants, the workbook mapping check, the stage spy test, API contracts for every route, the number, button and layout crawls, the pipeline specs and the strike matrix |
| Housekeeping | Linux only visual baselines, 24 files; build and test output ignored by git; package scripts renamed to `test:*` and `verify:*` |

See [13 Bug Log](13-bug-log.md) for every defect and its regression test.

## Round 9: Strikes, Spreads, Per Spread Option Type, Call Logic, Tables And Glass Buttons

| ID | Before | After |
|---|---|---|
| SK1 | Strike and expiry cards in a grid, not full width | One full-width row per strike and per expiry, at least 95% of the panel at 1440 and 390 px |
| SK2 | Strike % only; the rupee level not shown | Strike % and an editable Strike Level in rupees per row; a typed level sets % = level ÷ start × 100 to 4 decimals; % stays the source, so levels move with the spot and the underlying; "-" with no spot |
| SK3 | Role labels, Units and Buy or Sell chips, "Units are the change in slope…", the outflow step and ROUNDUP hints, "Spread 1 · Strike 3 To Strike 2", the Maturity Date chip | All removed; units stay in the Pricer; Floor Units is now Decay Reduction Below Floor |
| SK4 | Participation 12 gave "Maximum Upside 135.76%" with no error | Inline error under the field, "The Spreads Pay 122.00%, Above The Coupon Of 102.50%" on the fixture, Run disabled, no popup |
| SK5 | Call reused the put units: Inbuilt −75.39%, Premium −₹ 39.25 Cr, NBFC ₹ 142.81 Cr, Delta 10,047 against the put book's 8.65%, ₹ 51.44 Cr, ₹ 56.46 Cr and 17,822 | Each spread takes Put or Call. A call spread buys u calls at its Buy Level and sells u at its Sell Level with no cash term; the downside and the Day 1 Vega Hedge stay puts. The book matches the payoff table within 1e-15 for every mix |
| SK6 | `col-pinned` sticky first columns in every table | No pinned column anywhere; only the header row is sticky; every table scrolls inside its own box |
| SK7 | Download Excel: a solid gold gradient from rgb 217 163 59, at opacity 0.5 when off. Active nav pill: a gradient from gold at 0.18 alpha to white. Search: solid white. Selects: a gradient from rgba 255 252 245 0.95 to white | Glass: gold fill at 0.14 alpha, 0.26 on hover, 0.34 pressed (0.16, 0.28, 0.36 in dark), a 0.35 gold border (0.4 in dark), text #5a1420 (#f3e6c4 in dark), blur 10 px with 140% saturation, a 2 px gold focus ring, scale 0.98 when pressed, opacity 0.5 when off |

### Call spreads

- **Equivalence.** Put-call parity holds on every leg, and a call book has the same delta and vega as the put book. Premium differs by the call spreads' payout discounted at the options' own rates, and Premium plus that discounted payout matches the put book exactly.
- **Inbuilt.** The option legs settle at the observation expiries, 3.4 to 4.6 years out, while the pots grow premium at the Premium Growth Rate to maturity, 5.3 years out. A call spread pays its part of the coupon at expiry instead of from the pots, so the Inbuilt moves by payout × (1 − discount factor × premium growth) ÷ NBFC growth. On the fixture that is 8.38% for all Put and 3.35% for all Call. The tests assert this formula within 1e-6, not the 0.25% in the brief, as agreed.

### Reduced motion

- **Hidden pages.** With the system set to reduce motion, the page wrapper kept the server's hidden start, opacity 0, so every Inputs and output section was invisible in production. It now always renders the motion wrapper and jumps to the end state; S14 checks every section is visible.

### Tables and buttons

- **Tables.** Copied from the Primary SP Dashboard DataTable: a `data-table-premium-wrap` box at most min(72 dvh, 780 px), headers 11 px bold upper case with 0.18 em tracking and 14 by 20 px padding, cells 14 px with 12 by 20 px padding, rows white and rgba 250 248 243 0.65, a gold hover and a thin gold scrollbar.
- **Run Simulation.** A maroon to gold glass at 0.55 and 0.45, 0.7 and 0.6 on hover, with a 0.5 gold border and a larger shadow. White text on that glass over the light page measures about 2 to 1, so the light theme keeps the glass text colour and only the dark theme uses white, to hold 4.5 to 1.

## Round 8: Market Data

Before: production on 28 Oct 2026. After: the mock server on the same data, Chromium at 1440 by 900, 1024 by 768 and 390 by 844, light and dark.

| ID | Before | After |
|---|---|---|
| MD1 | Cards 20 px, 16 px on phones; cells 12 by 20 px; rows 45 px; page 3483 px at 1440 and 4184 px at 390 | Cards 16 px, 12 px on phones; cells 8 by 12 px; grid rows 32 px, table rows 36 px; gaps 16 px; page 3290 px at 1440 and 4152 px at 390 |
| MD2 | Buttons 44, 46, 38 and 52 px in one row; Edit Surface stacked; remove buttons 36 by 48 px with no name | Every toolbar and section button 44 px with the icon beside the text; remove buttons 44 by 44 px named "Remove Tenor 1 Years" |
| MD3 | Upper case labels with 2.5 px spacing, wrapping to 30 px; one column; 1104 px tall at 390 | Title Case labels at the table size, normal spacing, one line; parameters and rate curve side by side from 1024 px; values to 2 decimals |
| MD4 | Rate curve cells 1 px padding, inputs 260 px wide, silver gradient inputs in dark | Cells 8 by 12 px, inputs 112 px, sticky header; dark inputs are flat dark boxes with light text, contrast above 4.5 to 1 |
| MD5 | One row of 8 columns, 1223 px wide: 917 px visible at 1024, 307 px at 390 | Pairs table: 4 pairs a row from 1024 px, 2 below; 1340 of 1340 px visible at 1440, 940 of 940 at 1024, 330 of 330 at 390 |
| MD6 | "Source Desk Database" three times | Once, in the Headline |
| MD7 | Grid 2160 px wide; pinned column about 134 px of 307 px on a phone | Grid 1849 px wide in a 26 rem box; pinned column 57 px on a phone with dates as "Dec 26"; header and column hold within 2 px after scrolling 400 across and 300 down |
| MD8 | First header "Strike Change" over dates and strike rows | First column "Expiry"; strike rows under "Reference Strikes", volatilities under "Volatility By Expiry" |
| MD9 | Deep strike hardcoded 500 for one underlying | Nifty and Sensex rows read the Deep strike from the surface, or "-" |
| MD10 | No unit on volatilities; "Vols are in percent points" | "Volatility %" group header; subtitle "Volatility In %" |
| MD11 | Gold then maroon bands from alpha 0.08 to 0.40, with row striping | One sequential scale from alpha 0.05 to 0.45, maroon in light and gold in dark, with a Low and High legend; no striping |
| MD12 | Indian grouping beside plain grouping | Indian grouping and tabular figures in every cell |
| MD13 | 378 inputs of 80 px, rows 51 px; text ignored; zero and negatives accepted | Inputs 72 px in 4 by 8 px cells; each cell checked as typed, red border and a count; Save off until every cell is valid |
| MD14 | Blocking alerts after a save or a local save | A toast and a status row: "Saved To Desk Database" or "Applied For This Session" |
| MD15 | Edit, upload and download split between two places | One toolbar above the grid, as in the Unwinding Calculator: Edit Surface, Upload Surface, Download Current Surface, Download Sample, Reload From Desk Database |
| MD16 | 4.5 megabytes in the browser, 8 on the server | One shared 4.5 megabyte limit in `lib/upload-limits.ts` |
| MD17 | Extension and type checked by the file picker only | The server checks the name and the file signature |
| MD18 | No secret and no rate limit on writes; no preview | Desk Key and rate limit on every write, Round 7; uploads now show a preview table and grid and write only on Confirm Upload |
| MD19 | Blocking "Upload Complete" alert | A toast and a status row with the file, expiry rows, strike columns and time |
| MD20 | Reload with no feedback; no Fetched At | Fetched At in the Headline; Reload spins and reports in the status row |
| MD21 | About 124 and 120 rows from 2020 and 2019 in 520 px boxes | 56 and 34 rows from 29-Oct-2026 and 31-Oct-2026 in 22 rem boxes; Show History lists every row |
| MD22 | Dates right aligned | Dates left aligned in every table on every page, numbers right aligned |
| MD23 | "Pricing Params", "Upload Vol Surface", "Vol Surface sheet", "Rate In Percent", "Rate Used" to 3 decimals | "Pricing Parameters By Expiry", "Upload Surface", "Volatility Surface Sheet", "Rate %", "Rate Used %" to 2 decimals |
| MD24 | "Simulation not run" | "Simulation Not Run" |
| MD25 | Headers only with no surface | One empty row, eight skeleton rows while loading, an inline error row |
| MD26 | Sections invisible until scrolled into view; with reduced motion, a direct load left them invisible | Sections and tables animate on mount and are visible at once with reduced motion |
| MD27 | Summation icon on Compute From History | Text only, in the standard button style |
| MD28 | "Sigmas", "Days" and "Times" after Shock Sigmas, Shock Days and Volatility Multiplier | Plain numbers; the same for Decay, Tenor In Days and Notional In Crore, whose labels already name the unit |

### Decisions

- **Button name.** "Reload From Desk Database" keeps the four words the brief names; the responsive audit lists it as the one exception to the three word rule.
- **Header upload.** The header Upload Surface button opens Market Data, where the preview and the outcome show.
- **Admin secret.** The Desk Key from Round 7, `DESK_WRITE_KEY`, is the server-side secret; it is set on Vercel for production and preview.

### Tests

`e2e/market-data.spec.ts` checks every finding at the three widths in both themes. It is read-only, so it also runs against production in the `prod` project.

## Round 7

### Database audit and cleanup

- `scripts/db-audit.ts` writes a read-only inventory to [the audit report](db-audit-report.md): counts, sizes, indexes, a masked sample, schema variations, duplicates, orphans, test documents, empty keys, expired months and collections the code no longer uses.
- `scripts/db-cleanup.ts` is a dry run by default. With `--apply` it backs every affected collection up to the git-ignored `backups/<date>/` as Extended JSON, checks the backup, then applies.
- **Applied on `hedging_sheet`:**
  - deleted the legacy parameters document, which had no month and an old dated rate curve;
  - dropped `upload_logs`, 3 log entries;
  - removed the old `isActive` and `key` flags;
  - dropped the leftover test database `hedging_sheet_e2e`, 21 documents.
- **Kept:** the August 2026 surface and the October 2026 surface parameters. Before, there were 6 documents in 3 collections, plus 21 in a test database; after, 2 documents in 2 collections.

### Database design

- **One data access layer in `lib/db`:**
  - `client.ts` keeps one cached client with pool and timeout limits;
  - `vol-surfaces.ts` and `pricing-params.ts` are the only modules that touch a collection;
  - `schemas.ts` holds the Zod schemas and the matching `$jsonSchema` validators;
  - `setup.ts` holds the indexes and validators;
  - `config.ts` keeps previews, development deployments and tests off the production database name.
- **Validators:** strict `$jsonSchema` validators and unique `monthKey` indexes, applied by `db-apply-validators`, `db-ensure-indexes` and on every Vercel build through `vercel-build`.
- **Whole writes:** every save is checked in full before writing, then the surface and parameters are replaced in one transaction. A missing volatility row used to be filled with zeros; now it is refused.
- **Desk Key:** saves need a Desk Key set on the server as `DESK_WRITE_KEY`, typed once per page load into a popup and held in memory only. Saves are rate limited, bodies are capped, and uploads must be Excel workbooks by name and content.
- **No logs:** upload logs are no longer written.
- **Health:** `GET /api/health` reports the connection, counts and the latest close date, without secrets.
- **Tests:** the API tests and the mock server run on an in-memory replica set with the production validators. `tests/api/database.test.ts` proves rejection of bad documents, no duplicates, no writes from a run, write protection and database separation.

### Caching

- **Daily history:** cached for three hours under `history` tags.
- **Surface and parameters:** cached under the `surface` tag, which every save expires at once.
- **Static assets:** brand images are immutable for a year.
- **Clearing:** `npm run cache:clear` clears the local, app and Vercel caches. The policy is in [01 Architecture](01-architecture.md#caching).

### Environment

- **Previews:** set to `MONGODB_DB=hedging_sheet_preview`.
- **Desk Keys:** production and previews each have their own `DESK_WRITE_KEY`.
- **Secrets:** a scan of the whole git history found no committed secrets; `.env.example` holds placeholders only.

## Round 6

### Sizes and layout

- **Design tokens.** One type, icon and spacing scale in `app/globals.css` and `tailwind.config.ts`. Font sizes use `clamp()` between 320 px and 2560 px. Tailwind's own font sizes and off-scale spacing are removed from the theme, so a stray class produces no CSS, and `tests/unit/design-tokens.test.ts` keeps them out of the source.
- **Inputs.** Fields sit in a grid of one to four columns, with the label above the box. Input and button rows wrap on narrow screens.
- **Tables.** Wrapped, balanced headers; numbers that never wrap; scroll shadows; a pinned first column. Item and value tables split into two or three column pairs on wide screens.
- **Shell.** The tab bar scrolls below 1024 px. Popups become bottom sheets on phones, the footer keeps two lines on phones, and the Run Simulation bar respects the phone safe area. Every `vh` is now `dvh`.
- **Sticky fix.** The page wrapper used `overflow-x: hidden`, which turned it into a scroll container, so neither the header nor the Run Simulation bar ever stuck. It now uses `overflow-x: clip`.
- **Short labels.** The margin tab reads Mark To Market, the popup action reads Go To Field, and the blank-mode volatility button reads Compute Volatility.
- **Excel.** Long text cells wrap, and the row height grows to fit them.
- **Accessibility.** The Search button's name now includes its visible text.

### Rendering

Every page now renders per request through `connection()` in `app/layout.tsx`. Inputs opens on today's date in India, so a page prerendered at build time carried the deploy date. On every later day, React reported a hydration mismatch, error 418, and rebuilt the page in the browser.

### Removed

About 320 CSS rules that no page used, which halved `app/globals.css`.

### Tests

`e2e/responsive` holds R1 to R11 on 12 viewports, with `npm run e2e:responsive` and `npm run e2e:responsive:update`. R1 to R7, R9, R10 and R11 run in the Chromium shards, and the R8 screenshots run in the visual job.

### Decisions

- **Tab bar below 1024 px.** It scrolls sideways with faded edges rather than opening a sheet menu, which keeps the sliding active pill on every screen.
- **Footer.** It sits at the end of the page rather than staying pinned, so it never covers content. R9 checks that it is fully visible and uncovered there.
- **Buttons.** Compact header buttons use the Caption size and every other button uses Body; both are on the scale.

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
