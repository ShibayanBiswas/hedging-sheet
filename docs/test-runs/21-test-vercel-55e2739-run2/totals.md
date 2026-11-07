# Totals · 21-test-vercel-55e2739-run2

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/vercel-2026-11-07_21-04-31`
- **HEAD When Saved:** 55e2739
- **Deployment:** https://hedging-sheet.vercel.app, `dpl_4gTZKZmZhEZ3ccvncKWTHAF4WHbj`, commit `55e2739`
- **Note:** The same two steps as [run 20](../20-test-vercel-55e2739-run1/totals.md), 21:04 to 21:23 IST on Saturday 07-Nov-2026, market closed, laptop saturated by other sessions. Thirty `curl` requests for the region trial note ran at 21:07 to 21:08; nothing else of mine ran during it.

## No JUnit Or JSON Report For This Run

WMI was still not answering. As in run 20, every test finished, then `e2e/global-teardown.ts` waited on `powershell Get-CimInstance Win32_Process`, so Playwright never wrote `results.json`, `junit-e2e.xml` or the HTML report. The totals below are counted from the list reporter's `playwright.log`: 97 lines, each test once.

## Totals From playwright.log

```
Running 97 tests using 2 workers
```

| Project | Total | Passed | Failed |
|---|---|---|---|
| prod | 5 | 5 | 0 |
| prod-live | 27 | 27 | 0 |
| prod-firefox | 6 | 6 | 0 |
| prod-webkit | 6 | 6 | 0 |
| prod-responsive | 53 | 52 | 1 |
| **All** | **97** | **96** | **1** |

No test was skipped, and none was flaky: the laptop runs with no retries.

## Failed (1)

- [prod-responsive] responsive/r01-r07-pages.spec.ts › wide 2560x1440 › R1 to R7 on every page in blank mode after a run (59.9 s): `expect(page).toHaveURL(/\/$/)`, 20 s, received `https://hedging-sheet.vercel.app/summary`.

## What The Failure Shows

- Blank Inputs was filled and run, and Summary Sheet showed its results (Actual Inbuilt 2.81%, Premium ₹45.32 Crore). The test then clicked the Inputs tab, the first of its eight tabs.
- The click sent the client navigation request `GET /?_rsc=83_U1OaXZoe1m4m1`. The trace records **no response to it** in the 24 s before the test closed. Every other request in the test answered: the last 13 in 2 to 930 ms. The page stayed responsive, and the URL check polled 40 times.
- So one request to production, or its response, was lost or hung. Run 20 ran the same test in 40.7 s and passed, and `/` answered all 10 TTFB samples at 21:07 in 348 to 619 ms. For the rerun, see [Rerun](#rerun).
- Run 20's Firefox failure did not repeat: all six Firefox crawls passed here.

## Pages And APIs Answer (scripts/e2e-local.ts)

All 16 checks passed, the same as in run 20: every page 200, Levels from Yahoo with the market `holiday_or_weekend`, Nifty 25,030.35 and Sensex 81,028.02, Dataset surface "November 2026 Volatility Surface from shared", Bid, surface parameters from the database for 2026-11, daily volatility 0.009225 and the sample file 200.

## Rerun

The failing test, rerun alone at 21:39 to 21:40 IST: **passed** in 36.3 s. See [21 rerun](../21-test-vercel-55e2739-run2-rerun/totals.md). The failure did not reproduce, and the test had also passed in run 20.
