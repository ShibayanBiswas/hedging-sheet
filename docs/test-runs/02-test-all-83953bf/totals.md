# Totals · 02-test-all-83953bf

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/all-2026-11-03_02-04-51`
- **HEAD When Saved:** 83953bf
- **Note:** npm run test:all, E2E_PORT=3007. 6 Chromium failures, 40 chromium-writes did not run. Cause: a stale .next/cache/fetch-cache entry holding volBump 0.02, left by a parity-only rerun at 00:15; fixed in scripts/e2e-server.ts on the next commit.

## junit-vitest.xml

```
<testsuites name="vitest tests" tests="757" failures="0" errors="0" time="95.4257769">
```

Vitest skipped (0):

Vitest failed (0):

## junit-e2e.xml

```
<testsuites id="" name="" tests="317" failures="6" skipped="41" errors="0" time="1025.17206">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-02T20:39:18.988Z","duration":1025172.06,"expected":270,"skipped":41,"unexpected":6,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 277 | 270 | 6 | 0 | 1 | 0 |
| chromium-writes | 40 | 0 | 0 | 0 | 0 | 40 |

## Failed (6)

- [chromium] blank/b13-b17-outputs.spec.ts › B13 Full valid fill › B13.1 and B13.2 the valid fill runs and every headline number matches the frozen regression: Error: expect(received).toEqual(expected) // deep equality  - Expected  -   1 + Received  + 142
- [chromium] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 summary: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules: Error: expect(received).toEqual(expected) // deep equality  - Expected  - 1 + Received  + 3
- [chromium] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 margin: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules: Error: expect(received).toEqual(expected) // deep equality  - Expected  - 1 + Received  + 3
- [chromium] blank/b20-b22-mobile-themes-a11y.spec.ts › B21 White theme › B21.1 the valid fill matches the regression and every output tab passes the table checks: Error: expect(received).toBe(expected) // Object.is equality  Expected: true Received: false
- [chromium] copy-rules.spec.ts › every output cell shows a value or "-" and every table fills its width: Error: summary-headline row labels ["9.06%"] != ["7.88%"] margin-headline row labels ["₹ -70.16"] != ["₹ -71.77"]  expect(received).toEqual(expected) // deep equality
- [chromium] strikes.spec.ts › Strikes, spreads and per spread option type › S7 all Put matches main, all Call gives the same Premium and Inbuilt, and the payoff at 0% is 0.00% in both: Error: put premium 51.75176200051564  expect(received).toBe(expected) // Object.is equality 

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
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":204,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":140,"cls":0.002051819977936921,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1106,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1073,"longestTaskMs":45,"tasksOver50Ms":0,"tasks":1142}
