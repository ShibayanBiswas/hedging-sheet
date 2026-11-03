# Test Run · All

- **Started:** 2026-11-02 23:43:35 IST
- **Tests From Commit:** f012839
- **Server:** production build on port 3000 with a seeded in-memory Mongo, gone when the run ends
- **Result:** 1 of 9 steps failed

| Step | Result | Seconds | Report |
|---|---|---|---|
| Type Check | Pass | 7 | - |
| Lint | Pass | 29 | - |
| Unused Code | Fail | 9 | - |
| Copy Rules | Pass | 12 | - |
| Workbook Mapping | Pass | 4 | - |
| Workbook Audit | Pass | 5 | - |
| Production Build With The Test Hook | Pass | 16 | - |
| Unit, Golden, Property, Edge And Integration With Coverage | Pass | 214 | [Open](coverage/index.html) |
| Playwright On Chromium | Pass | 1287 | [Open](playwright-html/index.html) |

JUnit files and traces for failed tests are in this folder.
