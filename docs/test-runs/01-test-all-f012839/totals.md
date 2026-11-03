# Totals · 01-test-all-f012839

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/all-2026-11-02_23-43-35`
- **HEAD When Saved:** 83953bf
- **Note:** npm run test:all, 2 workers, port 3000. Unused Code failed on a file this round had just added (e2e/visual/full-page.css), since removed.

## junit-vitest.xml

```
<testsuites name="vitest tests" tests="757" failures="0" errors="0" time="138.1472161">
```

Vitest skipped (0):

Vitest failed (0):

## junit-e2e.xml

```
<testsuites id="" name="" tests="317" failures="0" skipped="7" errors="0" time="1279.495695">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-02T18:19:04.082Z","duration":1279495.695,"expected":310,"skipped":7,"unexpected":0,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 277 | 276 | 0 | 0 | 1 | 0 |
| chromium-writes | 40 | 34 | 0 | 0 | 6 | 0 |

## Failed (0)


## Flaky (0)


## Skipped By The Test (7)

### The 360 px check is part of the full width run. (1)

- [chromium] responsive/r01-r07-pages.spec.ts › 360 px › R7 every heading takes at most two lines

### Rule and number checks run once, on desktop Chromium. (6)

- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [chromium-writes] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks

## Did Not Run (0)


## Measured Annotations (12)

- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":212,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":92,"cls":0.002049596188392168,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1131,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1111,"longestTaskMs":38,"tasksOver50Ms":0,"tasks":933}
