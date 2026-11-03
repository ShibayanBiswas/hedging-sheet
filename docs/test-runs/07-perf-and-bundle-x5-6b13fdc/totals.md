# Totals · 07-perf-and-bundle-x5-6b13fdc

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/perf-repeat-2026-11-03_07-42-46`
- **HEAD When Saved:** 6b13fdc
- **Note:** E2E_PROD=1 E2E_PORT=3007 npx playwright test e2e/perf.spec.ts e2e/bundle.spec.ts --project=chromium --repeat-each=5

## junit-e2e.xml

```
<testsuites id="" name="" tests="60" failures="0" skipped="0" errors="0" time="163.787229">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T02:12:50.478Z","duration":163787.229,"expected":60,"skipped":0,"unexpected":0,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 60 | 60 | 0 | 0 | 0 | 0 |

## Failed (0)


## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (60)

- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":400,"cls":0.00041109265823259603,"longTaskMs":38}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":164,"cls":0.001484586797852902,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1204,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1202,"longestTaskMs":46,"tasksOver50Ms":0,"tasks":1170}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":300,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":108,"cls":0.002049596188392168,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1154,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1216,"longestTaskMs":66,"tasksOver50Ms":2,"tasks":1089}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":212,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":124,"cls":0.002051819977936921,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1052,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1097,"longestTaskMs":44,"tasksOver50Ms":0,"tasks":937}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":204,"cls":0.00006924082647462277,"longTaskMs":36}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":116,"cls":0.0014868105873976553,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1437,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1102,"longestTaskMs":45,"tasksOver50Ms":0,"tasks":1152}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":240,"cls":0.00006924082647462277,"longTaskMs":74}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":108,"cls":0.002049596188392168,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1081,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1064,"longestTaskMs":42,"tasksOver50Ms":0,"tasks":920}
