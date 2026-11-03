# Totals · 12-fixcheck-webkit-a898e8a

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/fixcheck-webkit-2026-11-03_10-14-48`
- **HEAD When Saved:** a898e8a
- **Note:** After the hover fix and the test fixes, a898e8a, 10:07 to 10:54 IST. The laptop was in standby 09:57 to 10:29 and CPU was at 100% from other apps.

## junit-e2e.xml

```
<testsuites id="" name="" tests="15" failures="0" skipped="4" errors="1" time="469.579126">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-03T05:00:43.998Z","duration":469579.126,"expected":10,"skipped":4,"unexpected":1,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| webkit | 15 | 10 | 1 | 0 | 4 | 0 |

## Failed (1)

- [webkit] edge-cases.spec.ts › Edge · Run › Losing The Network Mid Run Prices On The Loaded Surface And Says So: Test timeout of 90000ms exceeded.

## Flaky (0)


## Skipped By The Test (4)

### WebKit blocks an http://localhost frame in an https page as mixed content (4)

- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from the Workstation changes tab inside the frame, and the run survives with no reload
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from any other origin, or with any other path, does nothing
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › the Workstation cannot send the frame to a path outside the app's routes
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › framed at 768 by 1024 the footer ends inside the frame, nothing clipped

## Did Not Run (0)


## Measured Annotations (0)

