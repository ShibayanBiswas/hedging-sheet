# Test Run · All

- **Started:** 2026-11-03 02:04:51 IST
- **Tests From Commit:** 83953bf
- **Server:** production build on port 3007 with a seeded in-memory Mongo, gone when the run ends
- **Result:** 1 of 9 steps failed

| Step | Result | Seconds | Report |
|---|---|---|---|
| Type Check | Pass | 10 | - |
| Lint | Pass | 23 | - |
| Unused Code | Pass | 10 | - |
| Copy Rules | Pass | 12 | - |
| Workbook Mapping | Pass | 6 | - |
| Workbook Audit | Pass | 5 | - |
| Production Build With The Test Hook | Pass | 17 | - |
| Unit, Golden, Property, Edge And Integration With Coverage | Pass | 150 | [Open](coverage/index.html) |
| Playwright On Chromium | Fail | 1028 | [Open](playwright-html/index.html) |

JUnit files and traces for failed tests are in this folder.
