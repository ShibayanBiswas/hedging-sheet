# Totals · 16-final-perf-x5-a898e8a

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/final-perf-x5-2026-11-03_17-54-37`
- **HEAD When Saved:** a898e8a
- **Note:** E2E_PROD=1 E2E_PORT=3007 npx playwright test e2e/perf.spec.ts --project=chromium --repeat-each=5, CPU at 99 to 100% from other apps

## junit-e2e.xml

```
<testsuites id="" name="" tests="20" failures="2" skipped="0" errors="0" time="255.50463">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T12:29:00.795Z","duration":255504.63,"expected":18,"skipped":0,"unexpected":2,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 20 | 18 | 2 | 0 | 0 | 0 |

## Failed (2)

- [chromium] perf.spec.ts › performance budgets › Inputs meets LCP, CLS and TBT budgets: Error: expect(received).toBeLessThan(expected)  Expected: < 2000 Received:   3876
- [chromium] perf.spec.ts › performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: Error: expect(received).toBeLessThan(expected)  Expected: < 1500 Received:   2183

## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (20)

- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":1364,"cls":0.00034185183175797326,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":168,"cls":0.002049596188392168,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1361,"longestTaskMs":81}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1475,"longestTaskMs":61,"tasksOver50Ms":2,"tasks":1168}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":3876,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":156,"cls":0.002051819977936921,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1154,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":783,"longestTaskMs":69,"tasksOver50Ms":4,"tasks":849}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":584,"cls":0.00006924082647462277,"longTaskMs":33}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":136,"cls":0.001484586797852902,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1379,"longestTaskMs":62}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":2183,"longestTaskMs":77,"tasksOver50Ms":2,"tasks":1638}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":288,"cls":0.00006924082647462277,"longTaskMs":1}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":264,"cls":0.001484586797852902,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1313,"longestTaskMs":77}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1311,"longestTaskMs":125,"tasksOver50Ms":2,"tasks":1037}
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":456,"cls":0.00006924082647462277,"longTaskMs":18}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":296,"cls":0.001484586797852902,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1213,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":1425,"longestTaskMs":95,"tasksOver50Ms":4,"tasks":997}
