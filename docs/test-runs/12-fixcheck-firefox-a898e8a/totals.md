# Totals · 12-fixcheck-firefox-a898e8a

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/fixcheck-firefox-2026-11-03_10-14-48`
- **HEAD When Saved:** a898e8a
- **Note:** After the hover fix and the test fixes, a898e8a, 10:07 to 10:54 IST. The laptop was in standby 09:57 to 10:29 and CPU was at 100% from other apps.

## junit-e2e.xml

```
<testsuites id="" name="" tests="31" failures="1" skipped="0" errors="0" time="818.0982369999999">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T05:10:52.219Z","duration":818098.237,"expected":30,"skipped":0,"unexpected":1,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| firefox | 31 | 30 | 1 | 0 | 0 | 0 |

## Failed (1)

- [firefox] crawl.spec.ts › Crawl · 1440 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Error: expect(page).toHaveURL(expected) failed  Expected pattern: /\/$/ Received string:  "http://localhost:3007/summary"

## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (0)

