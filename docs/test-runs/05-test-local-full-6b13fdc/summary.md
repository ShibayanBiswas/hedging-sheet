# Test Run · Local

- **Started:** 2026-11-03 03:37:53 IST
- **Tests From Commit:** 6b13fdc
- **Server:** production build on port 3007 with a seeded in-memory Mongo, gone when the run ends
- **Result:** 1 of 5 steps failed

| Step | Result | Seconds | Report |
|---|---|---|---|
| Production Build With The Test Hook | Pass | 21 | - |
| Unit, Golden, Property, Edge And Integration With Coverage | Pass | 156 | [Open](coverage/index.html) |
| Playwright On Chromium, Firefox, WebKit And Mobile | Fail | 13553 | [Open](playwright-html/index.html) |
| Lighthouse Desktop | Pass | 499 | [Open](lighthouse) |
| Lighthouse Mobile | Pass | 303 | [Open](lighthouse-mobile) |

JUnit files and traces for failed tests are in this folder.
