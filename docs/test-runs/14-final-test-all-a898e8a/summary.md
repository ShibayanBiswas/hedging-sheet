# Test Run · All

- **Started:** 2026-11-03 16:10:17 IST
- **Tests From Commit:** a898e8a
- **Server:** production build on port 3007 with a seeded in-memory Mongo, gone when the run ends
- **Result:** 1 of 9 steps failed

| Step | Result | Seconds | Report |
|---|---|---|---|
| Type Check | Pass | 175 | - |
| Lint | Pass | 2299 | - |
| Unused Code | Pass | 116 | - |
| Copy Rules | Pass | 200 | - |
| Workbook Mapping | Pass | 62 | - |
| Workbook Audit | Pass | 269 | - |
| Production Build With The Test Hook | Pass | 218 | - |
| Unit, Golden, Property, Edge And Integration With Coverage | Pass | 840 | [Open](coverage/index.html) |
| Playwright On Chromium | Fail | 1565 | [Open](playwright-html/index.html) |

JUnit files and traces for failed tests are in this folder.
