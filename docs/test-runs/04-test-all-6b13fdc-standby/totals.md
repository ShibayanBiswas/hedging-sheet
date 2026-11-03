# Totals · 04-test-all-6b13fdc-standby

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/all-2026-11-03_02-30-19`
- **HEAD When Saved:** 6b13fdc
- **Note:** npm run test:all, E2E_PORT=3007. The laptop was in Modern Standby from 02:43:09 to 03:29:27 during this run; the 2 failures were the 2 tests in flight (2 workers) and 40 chromium-writes did not run as a result.

## junit-vitest.xml

```
<testsuites name="vitest tests" tests="757" failures="0" errors="0" time="99.4558011">
```

Vitest skipped (0):

Vitest failed (0):

## junit-e2e.xml

```
<testsuites id="" name="" tests="317" failures="0" skipped="41" errors="2" time="3838.0514709999998">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-02T21:03:49.872Z","duration":3838051.471,"expected":274,"skipped":41,"unexpected":2,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 277 | 274 | 2 | 0 | 1 | 0 |
| chromium-writes | 40 | 0 | 0 | 0 | 0 | 40 |

## Failed (2)

- [chromium] final-inputs.spec.ts › Final Inputs at 390 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Test timeout of 180000ms exceeded.
- [chromium] layout.spec.ts › layout at 1024px › white surfaces, single line cells, no pinned columns, scroll boxes and tight gaps on every tab: Test timeout of 240000ms exceeded.

## Flaky (0)


## Skipped By The Test (1)

### The 360 px check is part of the full width run. (1)

- [chromium] responsive/r01-r07-pages.spec.ts › 360 px › R7 every heading takes at most two lines

## Did Not Run (40)

- [chromium-writes] default/default-mode.spec.ts › Default Values mode › loads the mock close, today and the calculated volatility
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › output tabs show the run gate, then results after a run, without console errors
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › a changed input brings the gate back with Inputs Changed
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › a Pricer volatility override keeps results and shows the banner
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › Nifty renames every label and moves the expiry weekday
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input reverts with a popup: expiries not strictly ascending
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input reverts with a popup: coupon out of range
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input reverts with a popup: participation at zero
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input blocks the run: strikes not strictly descending
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input blocks the run: protection not below 100%
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input blocks the run: floor units above the decay
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input blocks the run: valuation date in the future
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › invalid input blocks the run: coupon unreachable
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › spreads follow the strikes and participation resets to calculated
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › Excel download after a run has one title-case sheet per tab, the Audit sheet and no pivots
- [chromium-writes] default/default-mode.spec.ts › Default Values mode › Product payoff reads the client return at a typed move
- [chromium-writes] default/default-mode.spec.ts › Market Data › surface edit validates cells, and the surface downloads in the upload layout
- [chromium-writes] default/default-mode.spec.ts › Market Data › surface parameters save for the month and reset
- [chromium-writes] default/default-mode.spec.ts › Market Data › surface upload with the sample file: preview, confirm, then an inline status and no popup
- [chromium-writes] default/default-mode.spec.ts › Market Data › a save asks for the Desk Key, refuses a wrong one, and Cancel saves nothing
- [chromium-writes] default/parity.spec.ts › Default Values parity › D1 on load every field is filled, the spot is the mock close and the date is today in India
- [chromium-writes] default/parity.spec.ts › Default Values parity › D2 the headline numbers match the frozen regression for the mock spot
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D5 changing one input shows Inputs Changed and the gate returns
- [chromium-writes] default/parity.spec.ts › Default Values parity › D6 the footer shows both spots, Fetched At and the market status
- [chromium-writes] default/parity.spec.ts › Default Values parity › D7 surface parameters › D7 the editor loads this month's defaults, and an edit changes the outputs after a run
- [chromium-writes] market-data.spec.ts › Market Data 1440 by 900 › layout, grid, alignment, units, toolbar, copy and the removed tables
- [chromium-writes] market-data.spec.ts › Market Data 1024 by 768 › layout, grid, alignment, units, toolbar, copy and the removed tables
- [chromium-writes] market-data.spec.ts › Market Data 390 by 844 › layout, grid, alignment, units, toolbar, copy and the removed tables
- [chromium-writes] market-data.spec.ts › Market Data behaviour › editing marks abc and -5 invalid and turns Save off, with no popup
- [chromium-writes] market-data.spec.ts › Market Data behaviour › a text file and a workbook over 4.5 megabytes are refused inline, before any request
- [chromium-writes] market-data.spec.ts › Market Data behaviour › the upload, surface and parameter routes refuse a request without the Desk Key
- [chromium-writes] market-data.spec.ts › Market Data behaviour › Download Sample and Download Current Surface give non-empty workbooks
- [chromium-writes] market-data.spec.ts › Market Data behaviour › with reduced motion every section is fully visible within 500 ms of load
- [chromium-writes] market-data.spec.ts › Inputs page units and buttons › Compute From History has no icon, and Shock Sigmas, Shock Days and Volatility Multiplier show no unit

## Measured Annotations (12)

- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":224,"cls":0.00006924082647462277,"longTaskMs":13}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":216,"cls":0,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1098,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1072,"longestTaskMs":36,"tasksOver50Ms":0,"tasks":980}
