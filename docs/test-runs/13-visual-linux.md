# Visual Baselines · Linux · Docker

All runs used `npm run test:visual:linux` in `mcr.microsoft.com/playwright:v1.63.0-noble` on Docker Desktop 29.9.2. Each run copies the working tree into the container, runs `npm ci` and `NEXT_PUBLIC_E2E=1 npm run build`, then runs `e2e/visual` with `--grep "visual baselines"`, `CI=1` and one worker.

| When (IST) | Commit | Mode | Result | What It Showed |
|---|---|---|---|---|
| 02-Nov 22:30 to 22:38 | 497ddb3 | update | 36 passed, 122 files in the folder (98 new and the 24 old) | First look. Masks painted over popups, the sticky Run bar sat over Strike 3 in whole-page shots, the 390 px Simulation Completed toast was hidden behind a full-height warning popup, and the Inputs Changed state used a coupon that blocked Run. The spec was fixed in f3b297b. |
| 02-Nov 22:41 to 22:52 | f3b297b | update | 36 passed, 98 written | |
| 02-Nov 22:52 to 23:03 | f3b297b | compare | 35 passed, 1 failed | `popup-1440-desk-key`: the page behind the popup sat at a different scroll position, 0.02 of the pixels. Fixed in f012839 by scrolling to the top before the picture. |
| 03-Nov 00:17 to 00:33 | a6b5d45 | update | 36 passed, 98 written | These are the committed baselines (dbfcad3). |
| 03-Nov 00:33 to 01:46 | a6b5d45 | compare | 35 passed, 1 failed | `popup expiries-beyond-surface at 1440` timed out tearing down its context. The laptop was in Modern Standby from 00:43 to 01:42, so this run is not evidence either way. |
| 03-Nov 01:48 to 01:59 | a6b5d45 | compare | **36 passed** | The committed baselines reproduce in the CI image. |
| 03-Nov 11:14 | a898e8a | compare | Did not run | Docker Desktop's engine had stopped, and `docker desktop start` did not bring it back within 240 s. It started at 18:10. |
| 03-Nov 18:10 to 18:32 | a898e8a, after the hover fix | compare | 34 passed, 2 failed, **no pixel difference** | `blank-1920-logic-atlas`: the whole-page picture timed out at 20 s, during standby from 18:10 to 18:34. `toast-excel-saved at 1440`: two toasts were on the page at once, because the spec held the run's toast timer as well as the Excel toast's. Both were spec problems, fixed in 17b6d80 |
| 03-Nov 18:36 to 19:03 | 17b6d80 | compare | 35 passed, 1 failed, **no pixel difference** | `390 Default Values, every tab after a run`: the browser did not launch within 180 s. That test passed in the 18:10 run |

Every one of the 36 visual tests, and so every one of the 98 pictures, has a passing comparison on the build with the hover fix: `390 Default Values` in the 18:10 run, and the other 35 in the 18:36 run. The baselines committed in dbfcad3 therefore stand, and nothing was regenerated after the fix.

## The 98 Files

- Every tab, as a whole page after a run: 8 tabs × 4 widths (390, 768, 1440 and 1920) × 2 modes = 64.
- Blank Inputs as it opens, at each width: 4.
- Popups at 390 and 1440: Switch Mode, Missing Or Invalid Inputs, Valuation Date Reverted, Fetch Failed, Could Not Solve, Expiries Beyond The Surface, Priced On The Loaded Surface, Bulk Edit Expiries, Bulk Edit Strikes, the command palette, Desk Key, the Simulation Completed toast and the Excel saved toast: 13 × 2 = 26.
- Output tab states at 390 and 1440: Not Run, and Inputs Changed · Run Again: 4.

Not pictured: the error toasts ("The PDF Could Not Be Built", "The Excel File Could Not Be Built"), the surface save and upload toasts (they need a write to the test database), the upload preview panel, and the "Loss Reaches 100% Before A 90% Fall" warning (no spec reaches it). They use the same toast and popup components as the pictures above.
