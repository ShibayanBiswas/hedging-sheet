# Totals · 19-test-vercel-819e9a1-run2

> **Superseded by `55e2739`.** This run tested production on 04-Nov-2026, when it served `819e9a1`. Production moved to `55e2739` on 05-Nov-2026 at 13:53 IST, and runs 20 onwards test that. This file is kept as history only; no current claim rests on it.

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/vercel-2026-11-04_14-44-01`
- **HEAD When Saved:** 819e9a1
- **Note:** The same two steps as run 18, 14:44 to 15:02 IST, CPU at 100% from other apps. No other work of mine ran during it except a few curl and nslookup probes and one Playwright Chromium page load, from 14:53 to 14:56, made to find out why pages timed out.

## junit-e2e.xml

```
<testsuites id="" name="" tests="97" failures="0" skipped="0" errors="7" time="1071.251888">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-04T09:14:43.781Z","duration":1071251.888,"expected":90,"skipped":0,"unexpected":7,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| prod | 5 | 5 | 0 | 0 | 0 | 0 |
| prod-live | 27 | 27 | 0 | 0 | 0 | 0 |
| prod-firefox | 6 | 6 | 0 | 0 | 0 | 0 |
| prod-webkit | 6 | 6 | 0 | 0 | 0 | 0 |
| prod-responsive | 53 | 46 | 7 | 0 | 0 | 0 |

## Failed (7)

- [prod-responsive] responsive/r01-r07-pages.spec.ts › small-phone 320x568 › R1 to R7 on every page in default mode after a run: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r01-r07-pages.spec.ts › small-phone 320x568 › R1 to R7 on every page in blank mode after a run: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r01-r07-pages.spec.ts › iphone-se 375x667 › R1 to R7 on every page in default mode after a run: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r01-r07-pages.spec.ts › iphone-15 393x852 › R1 to R7 on every page in blank mode after a run: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r09-layout.spec.ts › small-phone 320x568 › popups are bottom sheets on phones and centred dialogs from 640 px: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r09-layout.spec.ts › iphone-se 375x667 › R9 and layout: mode switch, sticky run bar, field grid, section tabs, footer and table scrolling: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"
- [prod-responsive] responsive/r09-layout.spec.ts › iphone-se 375x667 › popups are bottom sheets on phones and centred dialogs from 640 px: Error: page.goto: net::ERR_TIMED_OUT at https://hedging-sheet.vercel.app/ Call log: - navigating to "https://hedging-sheet.vercel.app/", waiting until "load"

## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (0)

## Pages And APIs Answer (scripts/e2e-local.ts)

```
Checking https://hedging-sheet.vercel.app
PASS  Page /  (200)
PASS  Page /summary  (200)
PASS  Page /pricer  (200)
PASS  Page /product  (200)
PASS  Page /vega-hedge  (200)
PASS  Page /margin  (200)
PASS  Page /market-data  (200)
PASS  Page /logic-atlas  (200)
PASS  Levels source  (yahoo)
PASS  Levels market status  (open)
PASS  Levels Nifty and Sensex  (23810.85 and 76917.85)
PASS  Dataset surface  (November 2026 Volatility Surface from database)
PASS  Dataset Bid or Offer  (B)
PASS  Surface parameters  (database for 2026-10)
PASS  Daily volatility  (0.008982797198713054)
PASS  Sample file  (200)
All checks passed
```

## What The Failures Show

- **All 7 are `page.goto: net::ERR_TIMED_OUT` on the first request of the test, `GET https://hedging-sheet.vercel.app/`,** which the trace shows waiting 30.2 s with no response. They ran one after another on the prod-responsive worker from 14:50:07 to 14:54:29 IST; the tests before and after them passed.
- In the same window, from the same laptop, `curl` reached production at 14:53:01 (200 in 0.52 s) and five more times at about 14:54 (TTFB 0.32 to 0.56 s, both Vercel addresses), and a fresh Playwright Chromium loaded / at 14:56:19 (200 in 7.4 s). Windows logged no network or power event in the window. So the browser on this laptop could not reach the site for about four minutes while the shell could; the cause on the laptop is **not established**. No request reached the app and failed there.
- **Rerun ([19 rerun](../19-test-vercel-819e9a1-run2-rerun/totals.md)):** the three phone viewports, 12 tests including all 7, passed 12 of 12 at 15:03.
- **Run 18's two Firefox crawl failures did not reproduce:** all six Firefox crawls passed here, 1440 px in 42 s and 1280 px in 26 s.
