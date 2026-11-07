# Totals · 18-test-vercel-819e9a1-run1

> **Superseded by `55e2739`.** This run tested production on 04-Nov-2026, when it served `819e9a1`. Production moved to `55e2739` on 05-Nov-2026 at 13:53 IST, and runs 20 onwards test that. This file is kept as history only; no current claim rests on it.

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/vercel-2026-11-04_08-45-29`
- **HEAD When Saved:** 819e9a1
- **Note:** The two steps of npm run test:vercel against https://hedging-sheet.vercel.app (deployment dpl_2qoT5jLa7qRgafvM7mNyRb2EYtNw, commit 819e9a1), with the environment test-run.ts sets (BASE_URL, REPORT_DIR, E2E_FULL_WIDTHS=1, no bypass secret) and --output under the session scratchpad, which test-run.ts cannot pass on. 14:15 to 14:40 IST, CPU at 98 to 100% from other apps with about 820 processes. The report folder is named in UTC because Git Bash's date ignored TZ=Asia/Kolkata. The preview upload for the region trial ran from about 14:20 to 14:22, during the Firefox 1440 test. Windows logged Modern Standby entry (506) at 14:37:27, during the last WebKit and responsive tests.

## junit-e2e.xml

```
<testsuites id="" name="" tests="97" failures="1" skipped="0" errors="1" time="1480.8463909999998">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-04T08:46:11.819Z","duration":1480846.3909999998,"expected":95,"skipped":0,"unexpected":2,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| prod | 5 | 5 | 0 | 0 | 0 | 0 |
| prod-live | 27 | 27 | 0 | 0 | 0 | 0 |
| prod-firefox | 6 | 4 | 2 | 0 | 0 | 0 |
| prod-webkit | 6 | 6 | 0 | 0 | 0 | 0 |
| prod-responsive | 53 | 53 | 0 | 0 | 0 | 0 |

## Failed (2)

- [prod-firefox] crawl.spec.ts › Crawl · 1440 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Test timeout of 240000ms exceeded.
- [prod-firefox] crawl.spec.ts › Crawl · 1280 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Error: expect(page).toHaveURL(expected) failed Expected pattern: /\/margin$/ Received string: "https://hedging-sheet.vercel.app/vega-hedge" Timeout: 20000ms Call log: - Expect "toHaveURL" with timeout 20000ms

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

- **Firefox, Crawl at 1440 px, 14:19:20 to 14:23:29 IST.** The trace shows Run reaching /summary in 6.0 s and the first popup closed by 19.3 s. The popup helper's next `locator.waitFor` has a 4 s limit, and it returned its timeout after 228.7 s, so the browser or the test worker was frozen for about 225 s. The 240 s test limit fell inside that wait; the tab clicks that followed ran during teardown and stopped at Pricer, with the URL still `/summary`. The freeze overlapped the upload of the region trial preview from this laptop, at about 14:20 to 14:22, with the CPU at 98 to 100%. Not an app result.
- **Firefox, Crawl at 1280 px, 14:24:15 to 14:25:43 IST.** The Mark To Market tab was clicked and the screenshot shows Mark To Market And Margin Requirement with its numbers, but `page.url()` still read `/vega-hedge` after 20 s. This is the signature the sign-off lists as flaky for Firefox at 1440 px: the content changed and the URL Playwright reads did not.
- Every other test passed, Firefox at 1024, 768, 414 and 390 px included.
