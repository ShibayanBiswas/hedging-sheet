# Totals · 21-test-vercel-55e2739-run2-rerun

- **Report Folders (Gitignored, Deleted By clean:dev):** `reports/vercel-rerun-2026-11-07_21-24-04` and `reports/vercel-rerun-2026-11-07_21-39-40`
- **HEAD When Saved:** 55e2739
- **Note:** The one failure of each 55e2739 run, rerun alone against https://hedging-sheet.vercel.app with `BASE_URL`, `REPORT_DIR`, `E2E_FULL_WIDTHS=1` and `--output` under the session scratchpad. Saturday 07-Nov-2026, laptop still loaded (Cygwin load average about 73). As in runs 20 and 21, WMI was not answering, so each rerun finished its test and then waited in `e2e/global-teardown.ts`. The results are read from the list reporter's `playwright.log`. The `results.json` and `junit-e2e.xml` in the second folder are left over from a `--list` of the same filter, and show it as skipped; they are not this result.

| Rerun Of | Command Filter | Time | Result |
|---|---|---|---|
| [Run 20](../20-test-vercel-55e2739-run1/totals.md): [prod-firefox] crawl.spec.ts › Crawl · 1440 px | `--project=prod-responsive --project=prod-firefox -g "wide 2560x1440 › R1 to R7 on every page in blank mode\|Crawl · 1440 px"`; the first half matched nothing, because Playwright joins title parts with spaces, so only the crawl ran | 21:24 IST | **Passed**, 29.2 s |
| [Run 21](../21-test-vercel-55e2739-run2/totals.md): [prod-responsive] responsive/r01-r07-pages.spec.ts › wide 2560x1440 › R1 to R7 on every page in blank mode after a run | `--project=prod-responsive -g "wide 2560x1440 R1 to R7 on every page in blank mode"` | 21:39 to 21:40 IST | **Passed**, 36.3 s |

```
Running 1 test using 1 worker
  ok 1 [prod-firefox] › e2e\crawl.spec.ts:11:7 › Crawl · 1440 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll (29.2s)
```

```
Running 1 test using 1 worker
  ok 1 [prod-responsive] › e2e\responsive\r01-r07-pages.spec.ts:13:11 › wide 2560x1440 › R1 to R7 on every page in blank mode after a run (36.3s)
```

Neither failure reproduced. Each had also passed in the other full run: the Firefox crawl at 1440 px in run 21, and the 2560 px blank mode check in run 20.
