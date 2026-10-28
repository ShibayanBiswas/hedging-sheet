# 07 · Testing and Debug

## Commands

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript in strict mode |
| `npm run lint` | ESLint with the Next config |
| `npm run test` | Vitest: engine invariants, inputs, upload round trip, Excel |
| `npm run test:e2e` | Playwright on port 3006 against the scratch database |
| `npm run verify:calculations` | Prices the defaults and prints every invariant as PASS or FAIL |
| `npm run test:edge-cases` | Runs every edge case and prints the popup message and fix |
| `npm run test:upload-schema` | Builds the sample and parses it as an upload |
| `npm run verify:exports` | Builds the Excel file, reopens it and lists the sheets |

Run Playwright against a deployed app with `BASE_URL=https://hedging-sheet.vercel.app npm run test:e2e`. The upload test is skipped there so the live surface is never replaced.

## What the tests pin down

- `tests/engine.test.ts`: derived terms from the strikes, the start level, the payoff cap, payoff against book at every kink for one, two and three spreads, the Inbuilt solve, the spot bump reset, Upper and Lower Maturity, Option Type, Bid or Offer, volatility overrides, the expiry weekday rule, the median expiry and every edge case code.
- `tests/inputs.test.ts`: the normal distribution, list resizing, the input schema and the upload round trip.
- `tests/export.test.ts`: the five sheets in order, values that match the engine, resolved Lower Maturity dates and the file name.
- `e2e/smoke.spec.ts`: the run gate, the run flow, the stale banner, Nifty labels and weekday, the strike popup, spreads and participation reset, a Pricer override, the upload, the Excel download, dark theme and mobile scrolling.

## Debug Drawer

Logic Atlas has a Debug Drawer with the last run's diagnostics: margin loop passes and residual, solver iterations, the achieved coupon gap, the spot bump after the stress grid, and the largest gap between the payoff and the option book.
