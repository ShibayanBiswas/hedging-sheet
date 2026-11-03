# 07 · Testing and Debug

## Layers

| Layer | Where | What it covers |
|---|---|---|
| Unit | `tests/unit` | Engine, acceptance, frozen regression, inputs and validation, the Blank suite rules, title case, copy rules, market status, Yahoo mocks, the stage hand-offs of the engine, the expiry role |
| Golden | `tests/golden` | G0 compares 4,497 values the reference workbook saves, cell by cell; G1 to G6 price other products against an independent Black formula, put-call parity and the term sheet payoff at 30 levels; fast-check runs 200 random products for each invariant |
| Component | `tests/component` | React Testing Library in jsdom: fields, the desk dialog, both input modes and the grouped validation popup |
| API | `tests/api` | Route handlers against an in-memory Mongo replica set with the production validators and indexes, seeded from `tests/fixtures`, with Yahoo answered by MSW. `contracts.test.ts` covers every route: the happy path with its response checked by Zod, a bad request, and for each write a missing Desk Key and the rate limit. `database.test.ts` proves that invalid documents are rejected, repeated saves leave one document per month, a run writes nothing, bodies are size limited, previews and tests never use the production database name, and the health check shows no secrets |
| Export | `tests/export` | The Excel file: five title-case sheets, header rows, values that match the engine, at most 3 decimals in every number format, no pivots |
| Copy | `tests/copy`, `tests/unit/copy-rules.test.ts` | No copy names the spreadsheet the app replaced: tables, Logic Atlas, the Excel file, validation messages and the text in every page and component. The Used In, Linked To Premium Growth Rate and Rate Used columns and the forward grid, rate curve and dividend tables appear in none of them; `e2e/removed-display.spec.ts` checks every tab at 1440 and 390 px |
| Mapping | `scripts/extract-mapping.ts` | Every formula cell of the reference workbook has a row in `docs/11-workbook-mapping.md` |
| Blank Inputs suite | `e2e/blank` | B1 to B22: empty state, each required field, invalid values in every number field, strikes, expiries, the weekday rule, spreads, Option Type, coupon and solver, protection and floor, volatility, fetch buttons, the full fill against the frozen regression, every output table, payoff, fixed grids, Excel, mode switching, keyboard, 390 px width and axe |
| Structure and Call | `tests/structure.test.ts`, `tests/call.test.ts` | Start level, strikes and units, Strike Level edits, adding and removing strikes, each strike's Buy Or Sell, the book against the payoff for all Put, all Call and mixed, put-call parity on every leg, and each leg's option type in Excel |
| Strikes | `e2e/strikes.spec.ts`, `e2e/strike-matrix.spec.ts` | S1 to S14, and every strike on the wrong side, a mixed Call and Put book against the all Put book, and removing and adding a strike |
| Pipeline | `e2e/pipeline` | No stale result after a mode or underlying switch; everything that depends on the underlying, for Nifty and Sensex; no underlying typed in a page or component |
| Crawls | `e2e/numbers.spec.ts`, `e2e/buttons.spec.ts`, `e2e/layout.spec.ts` | Every cell on every tab against the result from `window.__HS_TEST__`; every button and link with no console error, no failed response and no layout shift above 0.1; white surfaces, single line cells, no pinned column, scroll boxes for long tables and the footer and Inputs gaps at 1440, 1024 and 390 px |
| Default parity suite | `e2e/default` | D1 to D7: prefilled fields, regression numbers at the mock spot, the table checks, Excel, the run gate, the footer and the surface parameter editor; plus the market data flows |
| Copy and capitalisation | `e2e/copy-rules.spec.ts`, `e2e/capitalisation.spec.ts` | Spelled out words, no brackets, no "/", the % sign, "-" for not applicable, no spreadsheet wording and capitals on every word, on every page in both modes |
| Accessibility | `e2e/a11y.spec.ts`, B22 | axe on every page, in both modes, before and after a run and with a popup open; no serious or critical violations |
| Responsive | `e2e/responsive`, `tests/unit/design-tokens.test.ts` | R1 to R11 at 390, 1024 and 1440 px. `E2E_FULL_WIDTHS=1` restores the 12 viewports from 320 by 568 to 2560 by 1440 |
| Final polish layout | `e2e/polish-layout.spec.ts` | Every tab before and after Run at 390, 1024 and 2560 px, or at 360, 390, 414, 768, 1024, 1280, 1440, 1920 and 2560 px with `E2E_FULL_WIDTHS=1`: no overlap or sideways scroll, the action group in order within 16 px of the content edge, content at most 1680 px and centred with the header, tabs and footer in line, single-line cells, a fade on tables that scroll and 44 px targets on phones. Also no hidden start state in the server's HTML, no fade under reduced motion, the clock stopping while hidden and no polling |
| Embed navigation | `tests/unit/embed-navigation.test.ts`, `tests/component/embed-navigation.test.tsx`, `e2e/embed.spec.ts` | Accepted and rejected origins, sources and paths, and in a real frame: the run surviving a tab change with no reload, and the footer fitting at 768 by 1024 |
| Large surface | `e2e/large-surface.spec.ts` | 150 rows: a window of rows in the page, the last row reachable under a sticky header, every row mounted while editing, all 150 in the Excel download; 100 rows or fewer are not virtualised |
| Market Data | `e2e/market-data.spec.ts` | At 1440, 1024 and 390 px: no sideways scroll, the sticky grid header with no pinned column, units, the Deep strike, copy, inline edit validation, uploads refused before any request, writes refused without the Desk Key and both downloads |
| Visual | `e2e/visual` | `toHaveScreenshot` for every tab as a whole page at 390, 768, 1440 and 1920 px in both modes after a run, Blank Inputs as it opens, 13 popups and toasts and the Not Run and Inputs Changed states at 390 and 1440 px: 98 Linux baselines, with clocks and spots masked; animation smoke for the mode pill, the run steps and the reveal |
| Performance | `e2e/perf.spec.ts`, `lighthouserc.json`, `lighthouserc.mobile.json` | LCP under 2 s, CLS under 0.05 and long-task time under 300 ms on Inputs and Pricer; a run of the default book under 1.5 s with no task over 200 ms, by a PerformanceObserver and by a Chrome performance trace; Lighthouse Performance at least 90 on desktop and mobile |
| Production | `e2e/prod-smoke.spec.ts` | Five read-only checks against `BASE_URL`: health, the app loads, Run, one Excel download and a refused write; nothing is uploaded or saved |

Rule and number checks that do not depend on the browser engine run once, on desktop Chromium. Firefox, WebKit and Pixel 7 run the flows, the keyboard, layout and accessibility checks.

## How to run each

| Command | What it runs |
|---|---|
| `npm test` | Every Vitest suite |
| `npm run test:unit` | Vitest without the golden and API layers |
| `npm run test:golden` | G0 to G6 and the invariants |
| `npm run test:api`, `test:component`, `test:export` | One Vitest layer |
| `npm run test:coverage` | Vitest with v8 coverage: 90% lines on `lib/engine`, 80% overall; report in `test-results/coverage` |
| `npm run verify:mapping` | Every workbook formula cell has a mapping row |
| `npm run verify:copy` | The copy rules and the spreadsheet wording check |
| `npm run verify:db` | Read-only database check; `-- --db hedging_sheet_preview --apply` fixes a preview database, never production |
| `npm run test:e2e` | Every Playwright spec on Chromium in mock mode |
| `npm run bundle:report` | After a build: first load JavaScript of every page, gzipped, against the 250 KB limit |
| `npm run analyze` | The Next Turbopack analyzer: which modules make up each page |
| `npm run e2e` | Every Playwright project in mock mode |
| `npm run e2e:blank`, `e2e:default` | The Blank Inputs suite or the Default parity suite |
| `npm run e2e:copy` | The copy rules and capitalisation crawls |
| `npm run test:a11y` | The axe checks |
| `npm run test:visual`, `test:visual:update` | Visual baselines on Chromium, and rewriting them; on Linux only |
| `npm run test:visual:linux` | Rewrites the Linux baselines with Docker from any machine |
| `npm run e2e:perf` | Web vitals and the run time on Chromium |
| `npm run e2e:responsive` | The responsive audit on Chromium |
| `npm run test:prod` | The five read-only production checks; needs `BASE_URL` |
| `npm run test:prod:responsive` | The responsive audit against `BASE_URL`, read-only, with the real clock |
| `npm run lhci` | Lighthouse budgets against the mock server |
| `npm run test:all` | Typecheck, lint, knip, the copy rules, the workbook mapping and audit, then everything `test:local` runs |
| `npm run test:local` | A production build on port 3000, or `E2E_PORT` when another app holds it, with a seeded in-memory Mongo, gone when the run ends: Vitest with coverage and Playwright on Chromium |
| `npm run test:local:full` | The same with Firefox, WebKit, mobile, every width and Lighthouse; CI always runs this |
| `npm run test:vercel -- --url <url>` | Read only against a deployment: every page and API, then the production Playwright projects at every width, the crawl on three browsers. `--smoke` runs only the five checks. Refuses any host but `hedging-sheet.vercel.app`, its previews, and localhost over http. Sends `x-vercel-protection-bypass` from `VERCEL_AUTOMATION_BYPASS_SECRET` in the environment or `.env.local`, never printed, and never to localhost |
| `npm run verify:yahoo` | Live Yahoo with no mock: both closes, the session status and a year of daily volatility |
| `npm run report` | Opens the last Playwright HTML report |
| `npm run fixtures:build` | Rebuilds the generated fixtures; review the diff before committing |
| `npm run fixtures:workbook` | Freezes the reference workbook's saved values for G0 |
| `npm run e2e:local` | Every page and API on a running server; set `BASE_URL` for production |

Run one test by name with `npx playwright test -g "B13.2"`, or one project with `--project=webkit`. Set `E2E_PROD=1` after a build with `NEXT_PUBLIC_E2E=1` to test the production build, which is what CI does and is much faster than the dev server.

## Mock mode

`TEST_MODE=mock` makes the app deterministic:

- `lib/test/mocks/yahoo.ts` answers every Yahoo chart request: Sensex 76,835.78, Nifty 23,500.00 and a seeded one-year history of weekday closes ending on the session before the frozen day.
- On the server, `deskNow()` returns `TEST_NOW`, 28-Oct-2026 10:00 IST, a Wednesday in the cash session.
- `scripts/e2e-server.ts` starts an in-memory Mongo replica set with the production validators and indexes, sets the test Desk Key, seeds it from `tests/fixtures/surface.json` and `pricing-params.json`, then runs `next dev`, or `next start` with `E2E_PROD=1`. It sets `NEXT_PUBLIC_E2E=1`, which exposes the last result as `window.__HS_TEST__`; production builds never set it. The live database is never touched.
- Playwright freezes the browser clock at the same instant with `page.clock.setFixedTime`; Vitest uses `vi.setSystemTime`.
- Tests that upload a surface or save surface parameters put the fixtures back afterwards with `e2e/support/market.ts`, so later specs price against the same market.

## Fixtures

| File | Use |
|---|---|
| `fixtures/reference/reference-workbook.xlsm` | The reference workbook; read only by the mapping script and the fixture extractor |
| `tests/golden/fixtures/workbook-values.json` | Every value the workbook saves on its five output sheets, for G0 |
| `default-inputs.json` | The Default Values state at the mock close |
| `blank-valid-fill.json` | Values typed into Blank Inputs, by test id, with an explicit valuation date |
| `invalid-cases.json` | One broken rule per case, as a patch for unit tests and a fill for browser tests |
| `surface.json`, `pricing-params.json` | The seeded October 2026 surface and Pricing Params |
| `regression-expected.json` | Frozen engine outputs with explicit dates, and `mock`, the headline numbers, Greek Details and Mark To Market cells for Default Values and for the Blank fill |
| `table-schema.json` | Every output table per tab: header rows, row labels, cell count and the cells that show "-" |

`tests/helpers/mock-market.ts` builds the market exactly as the dataset route and the client do, so the generated numbers are the ones the page shows. Each table cell carries `data-cell="Row::Column"` and `data-value` with the raw number, so tests compare to 1e-6 rather than to rounded text. Regenerate with `npm run fixtures:build` only when a change is intended, and review the diff.

## Page Object Models

`e2e/pages` holds InputsPage (`goto`, `setMode`, `fill`, `fillAll`, `clear`, `run`, `expectValidationDialog`), the output pages (Summary, Pricer, Product, Vega Hedge, Margin, each with `open`, `table`, `expectGate`, `expectResults`), MarketDataPage, LogicAtlasPage, DeskDialog (`expectTitle`, `close`, `dismissAll`, `action`), NavBar and Footer. `e2e/fixtures.ts` wires them in and freezes the clock. `e2e/support` has the shared table, copy, Excel, layout and market helpers.

## Updating snapshots

Baselines live under `e2e/visual/__screenshots__/chromium/linux`: 98 files, listed in `docs/test-runs/13-visual-linux.md`. Other systems skip the screenshot comparison, so fonts rendered on Windows or macOS never fail it. A page may differ by at most 0.1% of its pixels. To check the committed baselines from any machine, run `npm run test:visual:linux -- compare`; any difference lands in `test-results/visual-compare` with its diff image. After an intended visual change, and only then, run `npm run test:visual:linux`: it rebuilds the app and rewrites all the baselines with Docker in `mcr.microsoft.com/playwright:v1.63.0-noble`, the image the CI visual job runs in, then commit them. The manual `visual.yml` job only compares; it cannot write baselines.

## Reading traces

A failed test keeps its trace, video and screenshot in `test-results/playwright/<test>`. Open the trace with `npx playwright show-trace test-results/playwright/<test>/trace.zip` to step through every action with the DOM, network and console. `npm run report` opens the HTML report with the same attachments. In CI, download the `playwright-shard-N` artifact and open `playwright-report/index.html`.

## Reports

`test:all`, `test:local` and `test:vercel` each write `reports/<run>-<timestamp>/`, which git ignores:

- `summary.md`: every step with Pass or Fail, its time and a link to its report;
- `coverage/`: the Vitest coverage, with 95% lines and branches enforced on `lib/` in `vitest.config.ts`;
- `junit-vitest.xml` and `junit-e2e.xml`;
- `playwright-html/` and `traces/`, with trace, video and screenshot kept on failure. A run that sends the bypass secret has no trace and no HTML report, because both can hold request headers;
- `lighthouse/`.

`test:vercel` takes the secret and Vercel's bypass cookie out of everything left in its folder after each step, so the folder is safe to upload. `test:prod` alone does not clean: on a machine with the secret set, treat its `test-results` as private.

Plain `npx playwright test` and `npx vitest` keep writing to `playwright-report` and `test-results`.

## CI

A push or pull request to `main` runs one short job. Everything longer is started by hand from the Actions tab, so a push costs minutes rather than hours. A failed manual run keeps its report for 3 days.

| Workflow | When | What |
|---|---|---|
| `ci.yml` | A push or pull request to `main`, unless it only touches `docs/**`, markdown or screenshots; a newer push cancels the run it replaces | Typecheck, lint, Vitest without coverage (unit, golden and property tests, not the API layer) and the build |
| `production-smoke.yml` | After `ci.yml` succeeds on a push to `main`, and on demand. No schedule; a failed or cancelled CI run does not smoke production | `npm run test:vercel -- --smoke`: five Chromium checks against production; opens a GitHub issue when it fails |
| `vercel-preview.yml` | Each successful preview deployment that Vercel reports to GitHub. Vercel posts no such events to this repository today, so it does not run until that changes | `npm run test:vercel` against the preview, with the tests from the default branch |
| `full-checks.yml` | On demand | `npm run test:all` in the Playwright Linux image, with coverage, knip, the workbook audit and every browser, uploading `reports/`; and `npm run verify:yahoo` against live Yahoo |
| `playwright.yml` | On demand | Playwright in mock mode against the production build, on Chromium by default; the form can select every browser or the full width list |
| `visual.yml` | On demand | The Linux visual baselines, in the Playwright image |
| `lighthouse.yml` | On demand | The desktop and mobile Lighthouse budgets |

The bypass secret is in the repository secrets, so a workflow that holds it runs only code from the default branch: it never checks out a deployed commit or a pull request, it has a read-only token with no saved credentials, and the secret is set on the one step that runs the tests, not on `npm ci`. `e2e/support/bypass.ts` and `scripts/bypass-target.ts` attach the header only to requests whose origin is exactly the deployment's, and redirects to another site never carry it.

## Edge cases

Every case in the Round 12 edge case table has a named test: `tests/edge/` for the engine, market data, uploads and the database, and `e2e/edge-cases.spec.ts` for Run, Goal Seek, the hedge strike, volatility edits, expiry counts and downloads. Each is named "Edge · Area · Case". The bugs they found are in [the Round 12 bug log](bug-log-round-12.md).

## Pipeline trace

In development, open any page with `?trace=1` and run: the console shows one collapsed group per stage, from the inputs to the stage timings. Production builds never print it.
