# Bug Log · Round 12

Every bug found while working through the Round 12 edge cases and test runs. Each one is fixed at its root cause. No tolerance was loosened and no baseline was updated to hide a bug.

Local means Vitest on Node, or Playwright on Chromium against the mock server on port 3006 with an in-memory Mongo and the browser clock frozen at 28-Oct-2026 10:00 IST.

## BUG-12-01 · Yahoo Requests Had No Timeout

- **Environment:** Local, Vitest.
- **Steps:** Ask for the market levels while Yahoo accepts the connection but never answers.
- **Expected:** The slow host is dropped after a few seconds and the next host, or the "no level" state, takes over.
- **Actual:** The request waited for the platform's own limit, so Market Data and Run could hang.
- **Root Cause:** `yahooFetch` called `fetch` with no abort signal.
- **Fix Commit:** `1dbfb14`. Every Yahoo request now carries `AbortSignal.timeout(8000)`, and a host that times out falls through to the next host.
- **Regression Test:** `tests/edge/market-edges.test.ts` › Edge · Spot · Yahoo › Yahoo Slow.

## BUG-12-02 · A Goal Seek That Did Not Converge Was Reported As A Result

- **Environment:** Local, Vitest.
- **Steps:** Price a book whose coupon no Inbuilt can reach.
- **Expected:** A "Could Not Solve" popup with the reason, and no result.
- **Actual:** The run went on with a NaN Inbuilt.
- **Root Cause:** The margin loop ignored `converged` from `brentSolve`.
- **Fix Commit:** `1dbfb14`. The engine returns `{ ok: false }` with code `goal-seek`, and the popup is titled "Could Not Solve".
- **Regression Test:** `tests/edge/engine-edges.test.ts` › Edge · Goal Seek › No Solution In Range Shows Could Not Solve With A Reason, And Returns At Once.

## BUG-12-03 · Rates Near 100% Gave An Absurd "Solved" Result

- **Environment:** Local, Vitest.
- **Steps:** Set the Premium Growth Rate to 50% and run.
- **Expected:** Either a real product, or Could Not Solve.
- **Actual:** The run reported success with an Inbuilt of −15,315 times the notional and a margin of 22 million crore. A Margin Growth Rate of 50% gave an Inbuilt of 164%.
- **Root Cause:** The goal seek widens its bracket without limit, so it found a root that is no product.
- **Fix Commit:** `1dbfb14`. An Inbuilt outside −100% to 100% of the notional is Could Not Solve, naming the value.
- **Regression Test:** `tests/edge/engine-edges.test.ts` › Edge · Rates And Terms › A 100% NBFC Rate Prices; A 100% Premium Or Margin Growth Rate Is Could Not Solve, and the property test Any Rate From 0% To 100%.

## BUG-12-04 · Weighted Compounding Rates Were NaN With No NBFC And No Margin Money

- **Environment:** Local, Vitest.
- **Steps:** Price a book whose NBFC and margin pots sum to 0.
- **Expected:** "-" for the three weighted rates on Product Description.
- **Actual:** NaN in `weightedCompRate`, `weightedHalfYearlyRate` and `weightedQuarterlyRate`.
- **Root Cause:** 0 ÷ 0 in Product Description O28.
- **Fix Commit:** `1dbfb14`. The rates are null when there is nothing to weight, which shows as "-".
- **Regression Test:** `tests/edge/engine-edges.test.ts`. Every priced case asserts no NaN and no Infinity anywhere in the result.

## BUG-12-05 · Text Or Blank Volatility Cells In An Upload Were Read As 0%

- **Environment:** Local, Vitest, `/api/uploads/vol-surface`.
- **Steps:** Upload a surface with "n/a" or an empty cell in a strike column.
- **Expected:** The upload is refused, naming the expiry and the strike.
- **Actual:** The cell was saved as 0%, which prices to NaN or nonsense.
- **Root Cause:** `parseVolSurfaceFile` replaced any non-number with 0.
- **Fix Commit:** `1dbfb14`. A cell that is not a number above 0 is refused, for example: The volatility for 25-Feb-2027 at the 70% strike is "n/a"; every volatility must be a number above 0. Nothing is written.
- **Regression Test:** `tests/edge/data-edges.test.ts` › Edge · Surface · Upload.

## BUG-12-06 · Run Clicked Several Times Fast Could Start Overlapping Runs

- **Environment:** Local, Playwright.
- **Steps:** Click Run Simulation five times within one frame.
- **Expected:** One run.
- **Actual:** Found by reading the code: nothing stopped a second click from starting a second run before React re-rendered the button as disabled.
- **Root Cause:** No guard on the run itself, only on the button's rendered state.
- **Fix Commit:** `1dbfb14`. A run-in-progress ref ignores clicks while a run is going.
- **Regression Test:** `e2e/edge-cases.spec.ts` › Edge · Run › Clicking Run Several Times Fast Runs Once.

## BUG-12-07 · Losing The Network Mid Run Priced Silently On The Old Surface

- **Environment:** Local, Playwright.
- **Steps:** Abort `/api/dataset` and run.
- **Expected:** The run completes on the loaded surface and says so.
- **Actual:** No message.
- **Root Cause:** A failed refresh returned the old market with no signal.
- **Fix Commit:** `1dbfb14`. A warning popup titled "Priced On The Loaded Surface" now appears.
- **Regression Test:** `e2e/edge-cases.spec.ts` › Edge · Run › Losing The Network Mid Run Prices On The Loaded Surface And Says So.

## BUG-12-08 · A Typed Hedge Strike Survived A Switch Of Underlying

- **Environment:** Local, Playwright.
- **Steps:** Type a Sensex hedge strike of 90,000, then switch to Nifty.
- **Expected:** The Nifty rule, Spot Plus 150 Rounded Up To The Next 100, so 23,700.
- **Actual:** 90,000 stayed.
- **Root Cause:** The auto flag stayed off after the override.
- **Fix Commit:** `1dbfb14`. A new underlying turns the auto hedge strike back on.
- **Regression Test:** `e2e/edge-cases.spec.ts` › Edge · Hedge Strike › Switching The Underlying After An Override Follows The New Index's Rule.

## BUG-12-09 · Annual Volatility Accepted Any Value, Such As 500%

- **Environment:** Local, Vitest.
- **Steps:** Type 500% into Annual Volatility.
- **Expected:** The value is reverted with the allowed range.
- **Actual:** It was kept, giving a Daily Volatility above its own limit.
- **Root Cause:** Annual had no rule of its own.
- **Fix Commit:** `1dbfb14`. Annual takes the Daily range times the square root of 365, which is above 0% to 191.05%.
- **Regression Test:** `tests/edge/engine-edges.test.ts` › Edge · Volatility.

## BUG-12-15 · Blank Inputs Could Lose A Typed Value After Field Checks Were Debounced

- **Environment:** Local, `npm run test:local` on Chromium, after commit `850d578` debounced the field checks by 150 ms.
- **Steps:** In Blank Inputs, fill the fields one after another quickly, as the Blank suite does.
- **Expected:** Each step unlocks as soon as the one before is complete, and every typed value is kept.
- **Actual:** 31 Chromium tests failed. Expiry boxes showed their dates while each still read "Expiry N Is Required", and the Strikes group stayed locked.
- **Root Cause:** Step locking read the debounced checks. For 150 ms a step stayed locked, and a locked step cannot take focus, so a value typed into it never committed on blur.
- **Fix Commit:** see the commit "Steps Unlock From The Inputs As They Are; Only Field Messages Wait 150 ms". The steps, the Run button and the popups read the checks on the current inputs; only the messages under the fields wait for typing to stop.
- **Regression Test:** `e2e/blank/*`, `e2e/capitalisation.spec.ts` and the blank mode runs of `e2e/responsive/r01-r07-pages.spec.ts`: 113 of 113 pass.

## BUG-12-11 To 14 · Layout Tests That Only Held On Desktop Chromium

- **Environment:** Local, `npm run test:all`, the first run of every project: Firefox, WebKit and the Pixel 7 mobile project.
- **Steps:** Run the Round 11 layout specs and the Atlas column spec on every project.
- **Expected:** The same rules checked on every browser and width.
- **Actual:**
  - Firefox footer gap measured 8.00006 against a limit of 8.
  - Mobile toast measured 380 px against a limit of 360.
  - Mobile Market Data toolbar sat 10 px lower than the desktop heading-row rule allowed.
  - WebKit at 390 px clicked the Logic Atlas tab before hydration and stayed on Inputs.
- **Root Cause:** The tests, not the app.
  - The footer gap needed rounding to 0.01 px.
  - The toast spans the bottom below 640 px by design.
  - The toolbar wraps under the heading text when the row is too narrow.
  - The Atlas spec clicked before the page had hydrated.
- **Fix Commit:** see the commit "Cross Browser Layout Tests Follow The Phone Layout". Each test now states both layouts, or waits for hydration as every other spec does. No limit was raised.
- **Regression Test:** `e2e/round11.spec.ts` footer, toast and Market Data tests, and `e2e/atlas.spec.ts` › Flows lay out 1 a row at 390 px, on all four projects.

## BUG-12-10 · Expiries Before The First Surface Row Were Clamped Silently

- **Environment:** Local, Vitest.
- **Steps:** Price with a surface whose first row falls after Expiry 1.
- **Expected:** The volatility is read from the first row, and the run says so.
- **Actual:** It was clamped with no warning. Expiries after the last row were already flagged.
- **Root Cause:** Only the far end of the surface was checked.
- **Fix Commit:** `1dbfb14`. Both ends now raise the Expiries Beyond The Surface warning.
- **Regression Test:** `tests/edge/engine-edges.test.ts` › Edge · Surface › Tenors Before The First Row Are Clamped To It And Flagged.
