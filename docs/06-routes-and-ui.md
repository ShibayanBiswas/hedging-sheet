# 06 · Routes and UI

## Shell

- **Header.** Logo, title, the underlying badge, Search with Ctrl K, the theme toggle, Upload Volatility Surface, and Download Excel. Download Excel is enabled after the first run and downloads the last run.
- **Strip.** The valuation date, the active surface month and the simulation status: Not Run, Running, Up To Date or Inputs Changed.
- **Tabs.** One full-width pill bar. Each tab takes an equal share of the width, with an icon, and the active pill slides between tabs on a spring.
- **Footer.** Nifty and Sensex closes, Fetched At in IST, the market status (Open, Pre Open, Closed, Holiday or Weekend), the data source, the Mongo status and the desk clock.

## Tabs

| Route | Tab | Needs a run |
|---|---|---|
| `/` | Inputs | No |
| `/summary` | Summary Sheet | Yes |
| `/pricer` | Pricer | Yes |
| `/product` | Product Description | Yes |
| `/vega-hedge` | Day 1 Vega Hedge | Yes |
| `/margin` | Mark to Market and Margin | Yes |
| `/market-data` | Market Data | No |
| `/logic-atlas` | Logic Atlas | No |

## Inputs

Inputs holds inputs only, in full-width sections: Underlying And Market, Rates, Product Terms, Observation Expiries, Strikes, Spreads And Option Type, Notional And Costs, and Volatility And Margin. Volatility And Margin has five subsections: Volatility, Exchange Pricing Rates, Stressed Pricing Rates, Stress Shock and Margins. A sticky full-width Run Simulation button sits at the bottom.

A pill at the top switches between two modes, after a confirm popup that also clears the results:

- **Default Values.** The live spot, today's date in India, the calculated volatility and the desk terms. Reset To Defaults restores them.
- **Blank Inputs.** Every field is empty with an "Eg …" placeholder and the selects read "Select …". Choose the number of expiry dates first, then that many month rows appear. Computed dates show "-" until they can be worked out, and derived fields fill as the inputs arrive and stay editable. Fetch Live Spot and Compute Volatility From History fill only their own fields. Clear All Inputs empties every field again.

Run Simulation validates first. Missing or invalid fields open "Missing Or Invalid Inputs", grouped by section, with Go To First Field; closing the popup focuses the first invalid field, and each invalid field has a red ring and inline text. A typed value that breaks a rule across fields opens "Please Fix This Input" straight away.

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
| `/api/surface` | POST | Save an edited surface |
| `/api/params` | GET, POST | Read or save this month's surface parameters and forward grid |
| `/api/uploads/vol-surface` | POST | Parse and store an uploaded surface file |
