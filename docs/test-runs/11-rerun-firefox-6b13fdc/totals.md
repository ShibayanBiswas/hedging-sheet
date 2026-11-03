# Totals · 11-rerun-firefox-6b13fdc

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/rerun-firefox-2026-11-03_08-22-45`
- **HEAD When Saved:** a898e8a
- **Note:** Rerun of the full run's failures on firefox at 6b13fdc, 08:22 to 09:15 IST. CPU was at 100% from other apps; the laptop was in standby 08:02 to 08:18.

## junit-e2e.xml

```
<testsuites id="" name="" tests="31" failures="5" skipped="0" errors="5" time="2536.702396">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T03:05:50.676Z","duration":2536702.396,"expected":21,"skipped":0,"unexpected":10,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| firefox | 31 | 21 | 10 | 0 | 0 | 0 |

## Failed (10)

- [firefox] crawl.spec.ts › Crawl · 1440 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Error: expect(page).toHaveURL(expected) failed  Expected pattern: /\/summary$/ Received string:  "http://localhost:3007/"
- [firefox] crawl.spec.ts › Crawl · 1280 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Test timeout of 240000ms exceeded.
- [firefox] final-inputs.spec.ts › Final Inputs at 1280 px › Default Values: full width, no vacant space, single lines, one chip, one number and date style: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1280 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1024 px › Default Values: full width, no vacant space, single lines, one chip, one number and date style: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1024 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 390 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Tearing down "context" exceeded the test timeout of 180000ms.
- [firefox] final-inputs.spec.ts › Final Inputs at 390 px › the Run bar runs edge to edge, sticks to the bottom and leaves no gap below it: Tearing down "context" exceeded the test timeout of 90000ms.
- [firefox] final-inputs.spec.ts › Final Inputs at 1440 px › Rates, Product Terms and Volatility each fit one row, with Underlying And Market: Test timeout of 90000ms exceeded.
- [firefox] final-inputs.spec.ts › Final Inputs at 1440 px › expiries: a card grid of 5 across with the hedge dropdown last, dates as 31-Oct-2030, snapping kept: Test timeout of 90000ms exceeded while setting up "page".

## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (0)

