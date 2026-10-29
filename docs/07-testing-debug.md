# 07 · Testing and Debug

## Layers

| Layer | Where | What it covers |
|---|---|---|
| Unit | `tests/unit` | Engine, acceptance, frozen regression, inputs and validation, the Blank suite rules, title case, copy rules, market status, Yahoo mocks |
| Component | `tests/component` | React Testing Library in jsdom: fields, the desk dialog, both input modes and the grouped validation popup |
| API | `tests/api` | Route handlers against an in-memory Mongo replica set with the production validators and indexes, seeded from `tests/fixtures`, with Yahoo answered by MSW. `database.test.ts` proves that invalid documents are rejected, repeated saves and uploads leave one document per month, a run writes nothing, writes need the Desk Key and are rate and size limited, previews and tests never use the production database name, and the health check shows no secrets |
| Export | `tests/export` | The Excel file: five title-case sheets, header rows, values that match the engine, no pivots |
| Blank Inputs suite | `e2e/blank` | B1 to B22: empty state, each required field, invalid values in every number field, strikes, expiries, the weekday rule, spreads, Option Type, coupon and solver, protection and floor, volatility, fetch buttons, the full fill against the frozen regression, every output table, payoff, fixed grids, Excel, mode switching, keyboard, 390 px width, both themes and axe |
| Default parity suite | `e2e/default` | D1 to D7: prefilled fields, regression numbers at the mock spot, the table checks, Excel, the run gate, the footer and the surface parameter editor; plus the market data flows |
| Copy and capitalisation | `e2e/copy-rules.spec.ts`, `e2e/capitalisation.spec.ts` | Spelled out words, no brackets, no "/", the % sign, "-" for not applicable, full-width tables and capitals on every word, on every page in both modes |
| Accessibility | `e2e/a11y.spec.ts`, B21 and B22 | axe on every page, in both modes and themes, before and after a run and with a popup open; no serious or critical violations |
| Responsive | `e2e/responsive`, `tests/unit/design-tokens.test.ts` | R1 to R11 on 12 viewports from 320 by 568 to 2560 by 1440: no page-level sideways scroll, no overflow or overlap, font sizes on the type scale and none below 12 px, icon sizes, 44 px touch targets, short wording and headings within two lines at 360 px, screenshots per page, viewport and theme, the sticky run bar, footer and pinned first column, 200% zoom and reduced motion, and Excel column widths, row heights and fonts. The unit test keeps raw font sizes, off-scale spacing, raw icon sizes and `vh` out of the source |
| Market Data | `e2e/market-data.spec.ts` | At 1440, 1024 and 390 px in both themes: no sideways scroll, the sticky grid header and column, alignment, units, the real Deep strike, toolbar heights, copy, history from the valuation date, inline edit validation, uploads refused before any request, writes refused without the Desk Key, both downloads, reduced motion and dark input contrast. Read-only, so it also runs in the `prod` project |
| Visual | `e2e/visual`, B21 | `toHaveScreenshot` per page and per theme with clocks and spots masked; animation smoke for the mode pill, the run steps and the reveal |
| Performance | `e2e/perf.spec.ts`, `lighthouserc.json` | LCP under 2.5 s, CLS under 0.1, TBT under 300 ms on Inputs and Pricer; a run under 3 s with mocks |
| Production | `e2e/prod-smoke.spec.ts` | Read only against `BASE_URL`; nothing is uploaded or saved |

Rule and number checks that do not depend on the browser engine run once, on desktop Chromium. Firefox, WebKit and Pixel 7 run the flows, the keyboard, layout and accessibility checks.

## How to run each

| Command | What it runs |
|---|---|
| `npm test` | Every Vitest suite |
| `npm run test:unit`, `test:component`, `test:api`, `test:export` | One Vitest layer |
| `npm run test:coverage` | Vitest with v8 coverage: 90% lines on `lib/engine`, 80% overall; report in `test-results/coverage` |
| `npm run e2e` | Every Playwright project in mock mode |
| `npm run e2e:blank`, `e2e:default` | The Blank Inputs suite or the Default parity suite |
| `npm run e2e:copy` | The copy rules and capitalisation crawls |
| `npm run e2e:a11y` | The axe checks |
| `npm run e2e:visual`, `e2e:visual:update` | Visual baselines on Chromium, and rewriting them |
| `npm run e2e:perf` | Web vitals and the run time on Chromium |
| `npm run e2e:responsive`, `e2e:responsive:update` | The responsive audit on Chromium, and rewriting its screenshot baselines |
| `npm run e2e:prod` | The read-only production project; needs `BASE_URL` |
| `npm run e2e:prod:responsive` | The responsive audit R1 to R7, R9, R10 and R11 against `BASE_URL`, read-only, with the real clock; the screenshots stay local |
| `npm run lhci` | Lighthouse budgets against the mock server |
| `npm run test:all` | Typecheck, lint, coverage and every Playwright project: everything except production |
| `npm run report` | Opens the last Playwright HTML report |
| `npm run fixtures:build` | Rebuilds the generated fixtures; review the diff before committing |
| `npm run e2e:local` | Every page and API on a running server; set `BASE_URL` for production |

Run one test by name with `npx playwright test -g "B13.2"`, or one project with `--project=webkit`. Set `E2E_PROD=1` after `npm run build` to test the production build, which is what CI does and is much faster than the dev server.

## Mock mode

`TEST_MODE=mock` makes the app deterministic:

- `lib/test/mocks/yahoo.ts` answers every Yahoo chart request: Sensex 76,835.78, Nifty 23,500.00 and a seeded one-year history of weekday closes ending on the session before the frozen day.
- On the server, `deskNow()` returns `TEST_NOW`, 28-Oct-2026 10:00 IST, a Wednesday in the cash session.
- `scripts/e2e-server.ts` starts an in-memory Mongo replica set with the production validators and indexes, sets the test Desk Key, seeds it from `tests/fixtures/surface.json` and `pricing-params.json`, then runs `next dev`, or `next start` with `E2E_PROD=1`. The live database is never touched.
- Playwright freezes the browser clock at the same instant with `page.clock.setFixedTime`; Vitest uses `vi.setSystemTime`.
- Tests that upload a surface or save surface parameters put the fixtures back afterwards with `e2e/support/market.ts`, so later specs price against the same market.

## Fixtures

| File | Use |
|---|---|
| `default-inputs.json` | The Default Values state at the mock close |
| `blank-valid-fill.json` | Values typed into Blank Inputs, by test id, with an explicit valuation date |
| `invalid-cases.json` | One broken rule per case, as a patch for unit tests and a fill for browser tests |
| `surface.json`, `pricing-params.json` | The seeded October 2026 surface and Pricing Params |
| `regression-expected.json` | Frozen engine outputs: the workbook tie-out with explicit dates, and `mock`, the headline numbers, Greek Details and Mark To Market cells for Default Values and for the Blank fill |
| `table-schema.json` | Every output table per tab: header rows, row labels, cell count and the cells that show "-" |

`tests/helpers/mock-market.ts` builds the market exactly as the dataset route and the client do, so the generated numbers are the ones the page shows. Each table cell carries `data-cell="Row::Column"` and `data-value` with the raw number, so tests compare to 1e-6 rather than to rounded text. Regenerate with `npm run fixtures:build` only when a change is intended, and review the diff.

## Page Object Models

`e2e/pages` holds InputsPage (`goto`, `setMode`, `fill`, `fillAll`, `clear`, `run`, `expectValidationDialog`), the output pages (Summary, Pricer, Product, Vega Hedge, Margin, each with `open`, `table`, `expectGate`, `expectResults`), MarketDataPage, LogicAtlasPage, DeskDialog (`expectTitle`, `close`, `dismissAll`, `action`), NavBar and Footer. `e2e/fixtures.ts` wires them in and freezes the clock. `e2e/support` has the shared table, copy, Excel and market helpers.

## Updating snapshots

Baselines live under `e2e/visual/__screenshots__/<project>/<platform>`. After an intended visual change, run `npm run e2e:visual:update` and `npm run e2e:responsive:update` on Windows and commit the new files. CI on Linux compares against the `linux` set; when it has fewer files than the `win32` set, the visual job writes the missing Linux baselines and uploads them as the `visual-baselines-linux` artifact instead of failing. Download that artifact, copy the images into `e2e/visual/__screenshots__/chromium/linux` and commit them.

## Reading traces

A failed test keeps its trace, video and screenshot in `test-results/playwright/<test>`. Open the trace with `npx playwright show-trace test-results/playwright/<test>/trace.zip` to step through every action with the DOM, network and console. `npm run report` opens the HTML report with the same attachments. In CI, download the `playwright-shard-N` artifact and open `playwright-report/index.html`.

## Reports

- Playwright: HTML in `playwright-report`, JUnit in `test-results/junit-e2e.xml`, with trace, video and screenshot kept on failure.
- Vitest: JUnit in `test-results/vitest-junit.xml` on CI, coverage in `test-results/coverage`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. Typecheck, lint, Vitest with coverage, and the build.
2. Playwright in mock mode against the production build, across 4 shards and all four projects. The responsive audit runs in the Chromium project of these shards.
3. Visual baselines, including the responsive screenshots.
4. Lighthouse budgets.
5. Artifact upload for each job.

`.github/workflows/prod-smoke.yml` runs the read-only production project after CI succeeds on `main`, nightly, and on demand, and uploads the `prod-smoke-report` artifact.

## Debug Drawer

Logic Atlas has a Debug Drawer with the last run's live values:

- the diagnostics: goal-seek iterations and residual, margin loop passes, the spot bump after the stress grid, and the largest gap between the payoff and the book;
- the inputs;
- every goal-seek step;
- per-leg forward growth, forward, discount yield, volatility and maturities;
- the rate curve points used.
