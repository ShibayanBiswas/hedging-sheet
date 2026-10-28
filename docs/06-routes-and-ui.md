# 06 · Routes and UI

## Shell

- **Header.** Logo, title, the underlying badge, Search with Ctrl K, the theme toggle, Upload Volatility Surface, and Download Excel. Download Excel is enabled after the first run and downloads the last run.
- **Market strip.** Nifty and Sensex closes, the valuation date, the active surface month and the simulation status: Not Run, Up To Date or Inputs Changed.
- **Tabs.** One full-width pill bar. Each tab takes an equal share of the width, with an icon, and the active pill slides between tabs on a spring.
- **Footer.** Desk footer in the Primary SP Dashboard style.

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

Inputs holds inputs only, in full-width sections: Underlying and Market, Rates in Percent, Product Terms, Observation Expiries, Strikes, Spreads and Option Type, Notional and Costs, and Volatility and Margin. Volatility and Margin has five subsections: Volatility, Exchange Pricing Rates, Stressed Pricing Rates, Stress Shock and Margins.

- **Expiries.** The weekday badge shows the underlying's expiry day. Each month card shows the computed expiry and the raw date it came from.
- **Strikes.** One row of strike cards, Strike 1 to Strike n + 4, each with its role, its units and Buy or Sell.
- **Spreads.** Read from the strikes. Editing a level writes its strike. The top spread's participation is Derived from the Coupon, or Overridden with a Reset To Derived button.
- **Volatility.** Daily and annual volatility stay in sync. Compute From History recalculates from Yahoo over the History Window. A badge shows Calculated, Overridden or Fallback.
- **Run Simulation.** A sticky full-width button at the bottom. It steps through Fetching Market Data, Pricing Legs, Solving Inbuilt and Building Stress Grid, shows a toast when done and opens the Summary Sheet.

## Popups

Every edge case in [10 Edge Cases](10-edge-cases.md) opens a blocking popup with a How To Fix line, a moment after the input changes. Run Simulation repeats the first blocking issue if any remain. Expiries past the last surface row raise a warning popup after the run.

## Output tabs

Before the first run, each output tab shows a centred popup, Run The Simulation To See Results, with Run Simulation and Go To Inputs buttons. After a run, changed inputs show an Inputs Changed banner above the results.

Every output tab starts with a Headline table in place of the old card rail, then its blocks as full-width tables: sticky header, maroon and gold header band, zebra rows, right-aligned numbers, a pinned first column and sideways scrolling.

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/market/levels` | GET | Last completed Nifty and Sensex closes |
| `/api/market/daily-vol` | GET | Daily volatility over a window |
| `/api/market/index-at-date` | GET | Closes on a date, for surface anchors |
| `/api/dataset` | GET | Active surface and surface parameters |
| `/api/surface` | POST | Save an edited surface |
| `/api/params` | GET, POST | Read or save the surface parameters |
| `/api/uploads/vol-surface` | POST | Parse and store an uploaded surface file |
