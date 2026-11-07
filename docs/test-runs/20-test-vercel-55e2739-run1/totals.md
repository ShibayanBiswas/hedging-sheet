# Totals · 20-test-vercel-55e2739-run1

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/vercel-2026-11-07_18-59-29`
- **HEAD When Saved:** 55e2739
- **Deployment:** https://hedging-sheet.vercel.app, `dpl_4gTZKZmZhEZ3ccvncKWTHAF4WHbj`, commit `55e2739`, Ready since 05-Nov-2026 13:53 IST
- **Note:** The two steps of `npm run test:vercel`, run by hand with the environment `scripts/test-run.ts` sets (`BASE_URL`, `REPORT_DIR`, `E2E_FULL_WIDTHS=1`, no bypass secret) plus `--output` under the session scratchpad, which `test-run.ts` cannot pass on. Saturday 07-Nov-2026, 18:59 to 19:21 IST, market closed. The laptop was heavily loaded by other sessions' work: Cygwin's load average read about 130 at 20:34, and WMI stopped answering.

## No JUnit Or JSON Report For This Run

Every test finished by 19:21. Playwright then ran `e2e/global-teardown.ts`, which lists processes with `powershell Get-CimInstance Win32_Process`. WMI had stopped answering on this laptop, so that PowerShell call (process 24052, a child of this run's Playwright process 82448) never returned. Playwright writes `results.json`, `junit-e2e.xml` and the HTML report only after the teardown, so none was written. Stopping process 24052 by its id was refused by the permission check, so the run was left waiting. The totals below are counted from the list reporter's output, `playwright.log`, which prints one line for each test as it ends: 97 lines, each test once.

## Totals From playwright.log

```
Running 97 tests using 2 workers
```

| Project | Total | Passed | Failed |
|---|---|---|---|
| prod | 5 | 5 | 0 |
| prod-live | 27 | 27 | 0 |
| prod-firefox | 6 | 5 | 1 |
| prod-webkit | 6 | 6 | 0 |
| prod-responsive | 53 | 53 | 0 |
| **All** | **97** | **96** | **1** |

No test was skipped, and none was flaky: the laptop runs with no retries.

## Failed (1)

- [prod-firefox] crawl.spec.ts › Crawl · 1440 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll (47.1 s): `expect(locator).not.toHaveValue("")` on `input-spot`, 30 s, received "".

## What The Failure Shows

- The trace has `/api/market/levels` answering 200 in 327 ms, 1.4 s after the page loaded. At 3.1 s the poll found the close in the page's state: the spot input carried `data-value="81028.02"` and its placeholder had changed from "Fetching The Close".
- After 3.1 s the trace has **no poll and no screencast frame until 46.3 s**: Firefox drew nothing for 43 s, and the 30 s wait ran out inside that gap. The screenshot taken at the failure shows Sensex Spot 81,028.02, Hedge Strike 81,600 and Start Level 81,600.
- This is the browser stalling on a saturated laptop, the same signature as the 225 s stall in run 18. It is not an app result. The other five Firefox crawls passed, and so did Chromium and WebKit at every width.

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
PASS  Levels market status  (holiday_or_weekend)
PASS  Levels Nifty and Sensex  (25030.35 and 81028.02)
PASS  Dataset surface  (November 2026 Volatility Surface from shared)
PASS  Dataset Bid or Offer  (B)
PASS  Surface parameters  (database for 2026-11)
PASS  Daily volatility  (0.00922517094567753)
PASS  Sample file  (200)
All checks passed
```

## Rerun

The failing test, rerun alone at 21:24 IST: **passed** in 29.2 s. See [21 rerun](../21-test-vercel-55e2739-run2-rerun/totals.md). It had also passed in run 21.
