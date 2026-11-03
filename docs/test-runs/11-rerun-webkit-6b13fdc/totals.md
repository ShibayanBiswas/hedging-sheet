# Totals · 11-rerun-webkit-6b13fdc

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/rerun-webkit-2026-11-03_08-22-45`
- **HEAD When Saved:** a898e8a
- **Note:** Rerun of the full run's failures on webkit at 6b13fdc, 08:22 to 09:15 IST. CPU was at 100% from other apps; the laptop was in standby 08:02 to 08:18.

## junit-e2e.xml

```
<testsuites id="" name="" tests="15" failures="0" skipped="0" errors="5" time="776.7837320000001">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T02:52:50.507Z","duration":776783.7320000001,"expected":10,"skipped":0,"unexpected":5,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| webkit | 15 | 10 | 5 | 0 | 0 | 0 |

## Failed (5)

- [webkit] edge-cases.spec.ts › Edge · Run › Losing The Network Mid Run Prices On The Loaded Surface And Says So: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from the Workstation changes tab inside the frame, and the run survives with no reload: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from any other origin, or with any other path, does nothing: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › the Workstation cannot send the frame to a path outside the app's routes: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › framed at 768 by 1024 the footer ends inside the frame, nothing clipped: Test timeout of 90000ms exceeded.

## Flaky (0)


## Skipped By The Test (0)

## Did Not Run (0)


## Measured Annotations (0)

