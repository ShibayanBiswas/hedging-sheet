# 07 · Testing and Debug

## Layers

| Layer | Where | What it covers |
|---|---|---|
| Unit | `tests/unit` | Engine, acceptance, frozen regression, inputs, validation, title case, Yahoo mocks |
| Component | `tests/component` | React Testing Library in jsdom: fields, the desk dialog, both input modes and the grouped validation popup |
| API | `tests/api` | Route handlers against an in-memory Mongo seeded from `tests/fixtures`, with Yahoo answered by MSW |
| Export | `tests/export` | The Excel file: five title-case sheets, header rows, values that match the engine, no pivots |
| End to end | `e2e/*.spec.ts` | Playwright on Chromium, Firefox, WebKit and Pixel 7, in mock mode |
| Accessibility | `e2e/a11y.spec.ts` | axe on every page after a run, Blank Inputs with errors, the popup and the dark theme; no serious or critical violations |
| Visual | `e2e/visual` | `toHaveScreenshot` per page with clocks, fetch times and spots masked; animation smoke for the mode pill, the run steps and the reveal |
| Performance | `e2e/perf.spec.ts`, `lighthouserc.json` | LCP under 2.5 s, CLS under 0.1, TBT under 300 ms on Inputs and Pricer; a run under 3 s with mocks |
| Production | `e2e/prod-smoke.spec.ts` | Read only against `BASE_URL`; nothing is uploaded or saved |

## Commands

| Command | What it runs |
|---|---|
| `npm test` | Every Vitest suite |
| `npm run test:unit`, `test:component`, `test:api`, `test:export` | One Vitest layer |
| `npm run test:coverage` | Vitest with v8 coverage: 90% lines on `lib/engine`, 80% overall; report in `test-results/coverage` |
| `npm run e2e` | Every Playwright project in mock mode |
| `npm run e2e:default`, `e2e:blank` | The Default Values or Blank Inputs spec |
| `npm run e2e:a11y` | axe checks |
| `npm run e2e:visual`, `e2e:visual:update` | Visual baselines on Chromium, and rewriting them |
| `npm run e2e:perf` | Web vitals and the run time on Chromium |
| `npm run e2e:prod` | The read-only production project; needs `BASE_URL` |
| `npm run lhci` | Lighthouse budgets against the mock server |
| `npm run test:all` | Typecheck, lint, coverage and every Playwright project, everything except production |
| `npm run report` | Opens the last Playwright HTML report |
| `npm run verify` | Every verify script, in order |
| `npm run verify:mongo` | Database name, collection counts and sizes |
| `npm run e2e:local` | Every page and API on a running server; set `BASE_URL` for production |

## Mock mode

`TEST_MODE=mock` makes the app deterministic:

- `lib/test/mocks/yahoo.ts` answers every Yahoo chart request: Sensex 76,835.78, Nifty 23,500.00 and a seeded one-year history of weekday closes ending on the session before the frozen day.
- On the server, `deskNow()` returns `TEST_NOW`, 28-Oct-2026 10:00 IST, a Wednesday in the cash session.
- `scripts/e2e-server.ts` starts an in-memory Mongo, seeds it from `tests/fixtures/surface.json` and `pricing-params.json`, then runs `next dev`, or `next start` with `E2E_PROD=1`. The live database is never touched.
- Playwright freezes the browser clock at the same instant with `page.clock.setFixedTime`; Vitest uses `vi.setSystemTime`.

## Fixtures

| File | Use |
|---|---|
| `default-inputs.json` | The Default Values state at the mock close |
| `blank-valid-fill.json` | Values typed into Blank Inputs, by test id, that price the desk product |
| `invalid-cases.json` | One broken rule per case, as a patch for unit tests and a fill for browser tests |
| `surface.json`, `pricing-params.json` | The seeded October 2026 surface and Pricing Params |
| `regression-expected.json` | Frozen engine outputs with explicit dates; rebuild with `npx tsx scripts/build-regression-fixture.ts` only when a change is intended |

## Page objects

`e2e/pages` holds InputsPage (`setMode`, `fill`, `clear`, `run`, `expectValidationDialog`), the output pages (Summary, Pricer, Product, Vega Hedge, Margin), MarketDataPage, LogicAtlasPage, DeskDialog, NavBar and Footer. `e2e/fixtures.ts` wires them in and freezes the clock.

## Reports

- Playwright: HTML in `playwright-report`, JUnit in `test-results/junit-e2e.xml`, with trace, video and screenshot kept on failure.
- Vitest: JUnit in `test-results/vitest-junit.xml` on CI, coverage in `test-results/coverage`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: typecheck, lint, Vitest with coverage and the build, then Playwright in mock mode across 4 shards, visual baselines, Lighthouse, and artifact upload. Visual baselines are stored per platform under `e2e/visual/__screenshots__/<project>/<platform>`. Until Linux baselines are committed, the visual job writes them and uploads them as an artifact instead of failing.

`.github/workflows/prod-smoke.yml` runs the read-only production project after every successful Vercel deployment and nightly.

## Debug Drawer

Logic Atlas has a Debug Drawer with the last run's live values:

- the diagnostics: goal-seek iterations and residual, margin loop passes, the spot bump after the stress grid, and the largest gap between the payoff and the book;
- the inputs;
- every goal-seek step;
- per-leg forward growth, forward, discount yield, volatility and maturities;
- the rate curve points used.
