# Test Run · All

- **Started:** 2026-11-03 02:30:19 IST
- **Tests From Commit:** 6b13fdc
- **Server:** production build on port 3007 with a seeded in-memory Mongo, gone when the run ends
- **Result:** 1 of 9 steps failed

| Step | Result | Seconds | Report |
|---|---|---|---|
| Type Check | Pass | 6 | - |
| Lint | Pass | 16 | - |
| Unused Code | Pass | 6 | - |
| Copy Rules | Pass | 8 | - |
| Workbook Mapping | Pass | 3 | - |
| Workbook Audit | Pass | 4 | - |
| Production Build With The Test Hook | Pass | 13 | - |
| Unit, Golden, Property, Edge And Integration With Coverage | Pass | 130 | [Open](coverage/index.html) |
| Playwright On Chromium | Fail | 3841 | [Open](playwright-html/index.html) |

JUnit files and traces for failed tests are in this folder.
