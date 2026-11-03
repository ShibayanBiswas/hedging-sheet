# Totals · 11-rerun-mobile-6b13fdc

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/rerun-mobile-2026-11-03_08-22-45`
- **HEAD When Saved:** a898e8a
- **Note:** Rerun of the full run's failures on mobile at 6b13fdc, 08:22 to 09:15 IST. CPU was at 100% from other apps; the laptop was in standby 08:02 to 08:18.

## junit-e2e.xml

```
<testsuites id="" name="" tests="15" failures="1" skipped="6" errors="0" time="338.891">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T03:48:50.430Z","duration":338891,"expected":8,"skipped":6,"unexpected":1,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| mobile | 15 | 8 | 1 | 0 | 6 | 0 |

## Failed (1)

- [mobile] large-surface.spec.ts › A surface over 100 rows › renders a window of rows, scrolls to the last one under a sticky header, and every cell stays on one line: Error: expect(locator).toBeVisible() failed  Locator: getByTestId('vol-grid').locator('td[data-kind="date"]').filter({ hasText: /-2039$/ }).last() Expected: visible

## Flaky (0)


## Skipped By The Test (6)

### Rule and number checks run once, on desktop Chromium. (6)

- [mobile] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks

## Did Not Run (0)


## Measured Annotations (0)

