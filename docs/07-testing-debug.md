# 07 · Testing and Debug

## Commands

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | ESLint with the Next config |
| `npm test` | Vitest: acceptance, regression, engine invariants, inputs and upload, Excel |
| `npm run test:e2e` | Playwright on port 3006 against the scratch database |
| `npm run verify` | Every verify script below, in order |
| `npm run verify:calculations` | Prices the defaults and prints each invariant as PASS or FAIL |
| `npm run verify:pricer` | Every leg against an independent closed form, put-call parity and the analytic delta |
| `npm run verify:exports` | Builds the Excel file, reopens it, checks five sheets, no pivots and the Pricer header |
| `npm run verify:vol-upload` | Round trip of the surface file through the upload parser |
| `npm run verify:edge-cases` | Runs every edge case and prints the popup message and fix |
| `npm run verify:mongo` | Database name, collection counts and sizes |
| `npm run e2e:local` | Every page and API on a running server; set `BASE_URL` for production |

Run Playwright against a deployed app with `BASE_URL=https://hedging-sheet.vercel.app npm run test:e2e`. The upload and parameter save tests skip themselves there, so the live desk data is never changed.

## What the tests pin down

- `tests/acceptance.test.ts`:
  - the Black-Scholes closed form at textbook values and against an independent implementation;
  - put-call parity;
  - Greeks by finite difference against the analytic Greeks;
  - the goal seek residual below 1e-9;
  - every Mark to Market row as the sum of its parts;
  - the expiry rule with hand-checked nearest-weekday cases;
  - the pre-open market status.
- `tests/regression.test.ts`: the frozen fixture with explicit dates and every tie-out value, the live-spot chain at 73,598.67 re-derived by hand, and the sign of the hedge quantity.
- `tests/engine.test.ts`: derived terms, the payoff against the book at every kink for one to three spreads, Option Type, Bid or Offer, overrides, the weekday rule and every edge case code.
- `tests/inputs.test.ts`: the normal distribution, the input schema and the sample file round trip.
- `tests/export.test.ts`: five sheets in order, values that match the engine, resolved dates, no pivots, % strikes over real dates, and no NaN, "percent" or helper columns.
- `e2e/smoke.spec.ts`:
  - the run gate on every tab, the run flow and the stale banner;
  - Nifty labels and weekday;
  - the strike popup, spreads and participation reset, and a Pricer override;
  - surface edit validation, upload and download;
  - surface parameters save and reset;
  - the Excel download with no pivots;
  - the payoff table, chart and footer;
  - a walkthrough of every tab in both themes and at mobile width.

## Debug Drawer

Logic Atlas has a Debug Drawer with the last run's live values:

- the diagnostics: goal-seek iterations and residual, margin loop passes, the spot bump after the stress grid, and the largest gap between the payoff and the book;
- the inputs;
- every goal-seek step;
- per-leg forward growth, forward, discount yield, volatility and maturities;
- the rate curve points used.
