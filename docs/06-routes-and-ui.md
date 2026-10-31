# 06 · Routes and UI

## Shell

- **Header.** Logo, title, the underlying badge, Search with Ctrl K, Upload Volatility Surface, and Download Excel. Download Excel is enabled after a run and turns off while the inputs differ from that run. Every surface is plain white.
- **Strip.** The valuation date, the active surface month and the simulation status: Not Run, Running, Up To Date or Inputs Changed.
- **Tabs.** One full-width pill bar. The tabs share the width, each with an icon, and the active pill slides between tabs on a spring. From 1024 px every tab is visible on one line. Between 1024 and 1359 px the labels use the caption size, 4 px of padding and a 16 px icon, so a wide fallback for Segoe UI still fits. From 1360 px they use the body size and a 20 px icon. Below 1024 px the bar scrolls sideways with faded edges and keeps the active tab in view.
- **Footer.** Nifty and Sensex closes, Fetched At in IST, the market status (Open, Pre Open, Closed, Holiday or Weekend), the data source, the Mongo status and the desk clock. On phones and short screens it keeps two lines: the closes, then Fetched At and the market status.
- **Rendering.** Every page renders per request, because Inputs opens on today's date in India; a page built ahead of time would carry the build date.

### Sizes on every screen

- **Type and spacing.** One scale in `app/globals.css` and `tailwind.config.ts`. Font sizes grow smoothly from 320 px to 2560 px: Display 28 to 44 px, H1 24 to 34, H2 20 to 26, H3 17 to 21, Body 14 to 16, Table 13 to 15, Table Head 12 to 14 and Caption 12 to 13. Spacing uses 4, 8, 12, 16, 24, 32, 48 and 64 px; sections pad 16 px on phones, 24 on tablets and 32 on desktops. Icons are 14, 16, 20, 24 or 32 px with a 1.75 stroke; tab icons are 16 px on phones, 20 px from 768 px, 16 px from 1024 to 1359 px, and 20 px again from 1360 px.
- **Header.** Sticks to the top from 640 px wide and 500 px tall; on smaller screens it scrolls away so the form keeps its room.
- **Inputs.** Fields sit in one column on phones, two from 640 px, three from 1280 px and four from 1920 px, with the label above the box and the hint below it. The Run Simulation bar stays pinned to the bottom edge and clears the phone home indicator.
- **Tables.** The Primary SP Dashboard DataTable: 11 px bold upper case headers with 14 by 20 px padding, 14 px cells with 12 by 20 px padding, numbers right aligned with tabular figures, nothing wraps. Only the header row is sticky; no column is pinned. A table wider than the screen scrolls inside its own box, at most min(72 dvh, 780 px) tall, with shadows at the edges, so the page never scrolls sideways.
- **Controls.** Buttons, nav pills, tabs, the mode switch, selects, steppers, segmented controls and chips are gold glass: a translucent fill, a gold border and a backdrop blur, with hover, pressed, focus and disabled states. Run Simulation is a stronger maroon to gold glass.
- **Popups.** Full-height sheets from the bottom on phones, centred dialogs from 640 px; the content scrolls inside.
- **Charts.** Fewer axis ticks and tighter margins on phones.
- **Touch.** On touch screens every button, tab, select and checkbox is at least 44 by 44 px.

## Tabs

| Route | Tab | Needs a run |
|---|---|---|
| `/` | Inputs | No |
| `/summary` | Summary Sheet | Yes |
| `/pricer` | Pricer | Yes |
| `/product` | Product Description | Yes |
| `/vega-hedge` | Day 1 Vega Hedge | Yes |
| `/margin` | Mark To Market | Yes |
| `/market-data` | Market Data | No |
| `/logic-atlas` | Logic Atlas | No |

## Inputs

Inputs holds inputs only, in seven numbered groups in fill order: 1 Underlying And Market, 2 Observation Expiries, 3 Strikes And Spreads, 4 Rates, 5 Product Terms, 6 Volatility and 7 Margin And Desk Terms. Fields sit 4 across at 1440 px, 3 at 1024, 2 at 768 and 1 on phones, 36 px tall with one-line labels and 12 px helper text. A group stays locked, with "Complete Step N First", until every field of the steps before it is filled: step 2 opens after the Underlying and Valuation Date, step 3 after the expiries, steps 4 to 7 after the strikes and spreads.

- **Counts.** Number Of Expiry Dates (1 to 10) and Number Of Spreads (1 to 6) are dropdowns with a stepper either side. In Blank Inputs they show "Select …" and nothing appears below until a count is picked. The spread count sets the strikes, n + 4, shown read-only, and each strike row shows its units read-only.
- **Expiries.** Each is a date. A typed date moves to the last expiry weekday of its month, Thursday for Sensex and Tuesday for Nifty, with a note such as "Moved To The Last Thursday, 25-Apr-2030". The median expiry is labelled Observation And Hedge Option Expiry. Quarterly From First Expiry fills the rest three months apart.
- **Bulk Edit.** Expiries and strikes each take a pasted block from a sheet, tab or comma separated, with a live preview that checks every row. More than 10 rows are refused, and Apply stays off until every row passes.
- **Field checks.** Every rule lives in `lib/validation/inputRules.ts`. A typed value that breaks its rule is never applied; leaving the field opens a popup with the allowed range and puts the last valid value back. Run Simulation checks everything again and lists each problem, by group, as a link to its field.
- **Volatility.** Daily and Annual carry one tag, Calculated or Edited, and Compute From History sets both back to Calculated.
- **Run bar.** A slim sticky bar at the bottom holds Run Simulation and, after a change, "Inputs Changed · Run Again".

A pill at the top switches between two modes, after a confirm popup that also clears the results:

- **Default Values.** The live spot, today's date in India, the calculated volatility and the desk terms. Reset To Defaults restores them.
- **Blank Inputs.** Every field is empty with an "Eg …" placeholder and the selects read "Select …". Choose the number of expiry dates first, then that many month rows appear. Computed dates show "-" until they can be worked out, and derived fields fill as the inputs arrive and stay editable. Fetch Live Spot and Compute Volatility fill only their own fields. Clear All Inputs empties every field again.

Run Simulation validates first. Missing or invalid fields open "Missing Or Invalid Inputs", grouped by section, with Go To Field; closing the popup focuses the first invalid field, and each invalid field has a red ring and inline text. A typed value that breaks a rule across fields opens "Please Fix This Input" straight away, or "Coupon Not Reachable" when the spreads cannot pay the Coupon.

Every popup takes keyboard focus and Escape closes it. Focus then returns to where it was, or to the field the popup is about. Arrow keys, Home and End move between the mode tabs and between the section tabs, and Enter opens the focused one.

## Output tabs

Before the first run each output tab shows a centred popup, Run The Simulation To See Results, with Run Simulation and Go To Inputs. Changing any input brings that popup back with an Inputs Changed badge, so stale results are never shown. Pricer and hedge volatility overrides and market data changes keep the results and show an Inputs Changed banner instead. Every tab starts with a Headline table; every block is a full-width table with a sticky header, zebra rows, right-aligned numbers, sideways scrolling inside its own box and a reveal animation.

| Tab | Tables |
|---|---|
| Summary Sheet | Headline, Market and Rates, Product Specification, Final Expiries, Product Greeks, Costs, Options Details, Day 1 Vega Hedge, Volatility and Margin |
| Pricer | Headline, Pot Computation, Payout Construction, Leg Grid |
| Product Description | Headline, Term Sheet, Product Details, Maturity Details, Greek Details, Weighted Average Rates, the payoff chart and Payoff Scenarios |
| Day 1 Vega Hedge | Headline, Hedge Fair Volatility, Hedge Inputs, Margin Computation, Fair, Exchange and Stressed Price Computation |
| Mark to Market and Margin | Headline, Stress Grid |

The payoff chart and scenario table follow the Primary SP Dashboard. The chart has a gradient payoff area, the index level on the right axis, markers at the strikes, a protection band, a tooltip and axes in %. A move box reads off the level and the return. Scenario rows are marked Initial, Target, Protection and Floor.

## Market Data

- **Headline.** Label and value pairs across the full width, four a row from 1024 px and two below: Surface, Source, Fetched At, Bid Or Offer, Expiry Rows, Strike Columns, the reference price and this month's Forward Sell Rate.
- **Volatility Surface.**
  - One toolbar above the grid, as in the Unwinding Calculator: Edit Surface, Upload Surface, Download Current Surface, Download Sample and Reload From Desk Database.
  - Every result shows in a status row under the toolbar, with a toast, and never in a blocking popup.
  - The grid has an Expiry column, the Nifty and Sensex strike rows under Reference Strikes, a Volatility % header over the strike columns, one heat scale with a legend, and a sticky header.
  - While editing, each cell is checked as it is typed, and Save Surface stays off until every cell holds a volatility above 0 and at most 200.
  - An upload is checked in the browser, shown as a preview table and grid, and written only on Confirm Upload.
- **Surface Parameters.** A Parameter and Value table beside the Rate Curve Points table, Tenor In Years and Rate %, from 1024 px, with Edit Parameters, Save and Reset, and its own status row. The Premium Growth Rate Link row sets whether the curve points follow the Premium Growth Rate.
- **Not shown.** The forward pricing parameters by expiry, the rate curve as read and the implied dividends still drive pricing, and they travel in the Download Current Surface file, but they have no table on the page.

## Logic Atlas

Eleven sections: Inputs, Expiries, Strikes And Spreads, Pricer, Solver, Summary, Product Description, Day 1 Vega Hedge, Mark To Market And Margin, Market Data and Export.

- **Section cards.** Each has a description, a flow diagram with selectable steps, a formulas table with Formula, In Words, Inputs, Output and the value from the last run, edge cases, insights from the run, and outputs with their values and links to the tab.
- **Debug Drawer.** Live values from the last run: stage timings, the input hash and Copy JSON, diagnostics, the inputs, every goal-seek step, per-leg forward, discount yield, volatility and maturities, and the rate curve points used.
- **Stale runs.** A run made with other inputs is never shown; the Atlas waits for Run Simulation.

## Popups

Every edge case in [10 Edge Cases](10-edge-cases.md) opens a blocking popup with a How To Fix line. Run Simulation repeats the first blocking issue if any remain. Expiries past the last surface row raise a warning popup after the run.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/market/levels` | GET | Last completed Nifty and Sensex closes and the market status |
| `/api/market/daily-vol` | GET | Daily volatility over a window |
| `/api/market/index-at-date` | GET | Closes on a date, for surface anchors |
| `/api/dataset` | GET | Active surface and surface parameters, with their sources |
| `/api/surface` | GET, POST | Read the active surface, or save an edited one |
| `/api/params` | GET, POST | Read or save this month's surface parameters and forward grid |
| `/api/uploads/vol-surface` | POST | Parse, check and store an uploaded surface file |
| `/api/health` | GET | Database connection, counts, the latest surface month and the latest close date |
| `/api/admin/revalidate` | POST | Expire the surface and history caches |

GET routes only read. Every POST needs the Desk Key in the `x-desk-key` header; the app asks for it once per page load in a popup and keeps it in memory only. Without the key the answer is 401, after too many attempts 429, for a body too large 413, and on a deployment without `DESK_WRITE_KEY` 503.
