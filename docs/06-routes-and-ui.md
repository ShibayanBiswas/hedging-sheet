# 06 · Routes and UI

## Shell

- **Header.** Logo, title, the underlying badge, Search with Ctrl K, the theme toggle, Upload Volatility Surface, and Download Excel. Download Excel is enabled after the first run and downloads the last run.
- **Strip.** The valuation date, the active surface month and the simulation status: Not Run, Running, Up To Date or Inputs Changed.
- **Tabs.** One full-width pill bar. The tabs share the width, each with an icon, and the active pill slides between tabs on a spring. From 1024 px every tab is visible; where a font runs wide, a long label takes two lines rather than pushing the bar off screen. Below 1024 px the bar scrolls sideways with faded edges and keeps the active tab in view.
- **Footer.** Nifty and Sensex closes, Fetched At in IST, the market status (Open, Pre Open, Closed, Holiday or Weekend), the data source, the Mongo status and the desk clock. On phones and short screens it keeps two lines: the closes, then Fetched At and the market status.
- **Rendering.** Every page renders per request, because Inputs opens on today's date in India; a page built ahead of time would carry the build date.

### Sizes on every screen

- **Type and spacing.** One scale in `app/globals.css` and `tailwind.config.ts`. Font sizes grow smoothly from 320 px to 2560 px: Display 28 to 44 px, H1 24 to 34, H2 20 to 26, H3 17 to 21, Body 14 to 16, Table 13 to 15, Table Head 12 to 14 and Caption 12 to 13. Spacing uses 4, 8, 12, 16, 24, 32, 48 and 64 px; sections pad 16 px on phones, 24 on tablets and 32 on desktops. Icons are 14, 16, 20, 24 or 32 px with a 1.75 stroke; tab icons are 16 px on phones and 20 px from 768 px.
- **Header.** Sticks to the top from 640 px wide and 500 px tall; on smaller screens it scrolls away so the form keeps its room.
- **Inputs.** Fields sit in one column on phones, two from 640 px, three from 1280 px and four from 1920 px, with the label above the box and the hint below it. The Run Simulation bar stays pinned to the bottom edge and clears the phone home indicator.
- **Tables.** Numbers are right aligned with tabular figures and never wrap; headers wrap to two balanced lines at most. A table wider than the screen scrolls inside its card with shadows at the edges, and the first column stays pinned.
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

Inputs holds inputs only, in full-width sections: Underlying And Market, Rates, Product Terms, Observation Expiries, Strikes, Spreads And Option Type, Notional And Costs, and Volatility And Margin. Volatility And Margin has five subsections: Volatility, Exchange Pricing Rates, Stressed Pricing Rates, Stress Shock and Margins. A sticky full-width Run Simulation button sits at the bottom.

A pill at the top switches between two modes, after a confirm popup that also clears the results:

- **Default Values.** The live spot, today's date in India, the calculated volatility and the desk terms. Reset To Defaults restores them.
- **Blank Inputs.** Every field is empty with an "Eg …" placeholder and the selects read "Select …". Choose the number of expiry dates first, then that many month rows appear. Computed dates show "-" until they can be worked out, and derived fields fill as the inputs arrive and stay editable. Fetch Live Spot and Compute Volatility fill only their own fields. Clear All Inputs empties every field again.

Run Simulation validates first. Missing or invalid fields open "Missing Or Invalid Inputs", grouped by section, with Go To Field; closing the popup focuses the first invalid field, and each invalid field has a red ring and inline text. A typed value that breaks a rule across fields opens "Please Fix This Input" straight away, or "Coupon Not Reachable" when the spreads cannot pay the Coupon.

Every popup takes keyboard focus and Escape closes it. Focus then returns to where it was, or to the field the popup is about. Arrow keys, Home and End move between the mode tabs and between the section tabs, and Enter opens the focused one.

## Output tabs

Before the first run each output tab shows a centred popup, Run The Simulation To See Results, with Run Simulation and Go To Inputs. Changing any input brings that popup back with an Inputs Changed badge, so stale results are never shown. Pricer and hedge volatility overrides and market data changes keep the results and show an Inputs Changed banner instead. Every tab starts with a Headline table; every block is a full-width table with a sticky header, a maroon and gold band, zebra rows, right-aligned numbers, a pinned first column, sideways scrolling and a reveal animation.

| Tab | Tables |
|---|---|
| Summary Sheet | Headline, Market and Rates, Product Specification, Final Expiries, Product Greeks, Costs, Options Details, Day 1 Vega Hedge, Volatility and Margin |
| Pricer | Headline, Pot Computation, Payout Construction, Leg Grid |
| Product Description | Headline, Term Sheet, Product Details, Maturity Details, Greek Details, Weighted Average Rates, the payoff chart and Payoff Scenarios |
| Day 1 Vega Hedge | Headline, Hedge Fair Volatility, Hedge Inputs, Margin Computation, Fair, Exchange and Stressed Price Computation |
| Mark to Market and Margin | Headline, Stress Grid |

The payoff chart and scenario table follow the Primary SP Dashboard. The chart has a gradient payoff area, the index level on the right axis, markers at the strikes, a protection band, a tooltip and axes in %. A move box reads off the level and the return. Scenario rows are marked Initial, Target, Protection and Floor.

## Market Data

- **Volatility Surface.** A full-width grid with a toolbar on the right: Edit Surface, Upload Surface, Download Surface. While editing, each cell is validated on leaving it; Save Surface and Cancel replace Edit Surface.
- **Surface Parameters.** A Parameter, Value and Used In table with Edit Parameters, Save and Reset. A rate curve table sits underneath.
- **Pricing Params Forward Grid**, **Rate Curve As Read** and **Implied Dividends** from the valuation date on.

## Logic Atlas

Twelve sections: Inputs, Expiries, Strikes and Spreads, Pricer, Solver, Summary, Product Description, Day 1 Vega Hedge, Mark to Market and Margin, Market Data, Surface Parameters and Export.

- **Section cards.** Each has a 3 to 6 sentence description, a flow diagram with selectable steps, a formulas table (formula, in words, source sheet and row), edge cases, insights and output chips.
- **Computation Primitives.** A table of the shared building blocks.
- **Debug Drawer.** Live values from the last run: diagnostics, the inputs, every goal-seek step, per-leg forward, discount yield, volatility and maturities, and the rate curve points used.

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
