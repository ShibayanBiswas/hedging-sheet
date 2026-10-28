# Hedging Sheet

A desk web app for the five year accelerator hedge. It replicates the accelerator payoff with an option book, prices every leg on the vol surface, solves the Inbuilt, sizes the Day 1 vega hedge, stress-tests margin, and exports the five output sheets to Excel.

Spot, the valuation date and daily volatility load live. Set the inputs, press **Run Simulation**, and the output tabs fill in.

Production: [hedging-sheet.vercel.app](https://hedging-sheet.vercel.app)

## Quick start

```powershell
npm install
copy .env.example .env.local   # then fill in the variables below
npm run dev                    # http://localhost:3005
```

The app runs from the built in seed when the database is unavailable.

## Environment

Names only; values live in `.env.local`, which is git-ignored, and in the Vercel project settings.

| Name | Purpose |
|---|---|
| `MONGODB_URI` | Desk database connection, or use the three below |
| `MONGODB_HOST`, `MONGODB_USER`, `MONGODB_PASSWORD` | Desk database connection in parts |
| `MONGODB_DB` | Database name |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3005 |
| `npm run build` and `npm start` | Production build, and serving it on port 3005 |
| `npm run lint` and `npm run typecheck` | Static checks |
| `npm test` | Every Vitest layer: unit, component, API and export |
| `npm run test:unit`, `test:component`, `test:api`, `test:export` | One Vitest layer |
| `npm run test:coverage` | Vitest with coverage: 90% lines on the engine, 80% overall |
| `npm run e2e` | Playwright on Chromium, Firefox, WebKit and Pixel 7 in mock mode, against an in-memory database |
| `npm run e2e:blank` and `e2e:default` | The Blank Inputs suite B1 to B22 and the Default parity suite D1 to D7 |
| `npm run e2e:copy` | Copy rules and capitalisation on every page in both modes |
| `npm run e2e:a11y` | axe accessibility checks |
| `npm run e2e:visual` and `e2e:visual:update` | Screenshot baselines, and rewriting them |
| `npm run e2e:perf` and `npm run lhci` | Web vitals and Lighthouse budgets |
| `npm run e2e:prod` | Read-only Playwright checks against `BASE_URL` |
| `npm run e2e:server` | The mock-mode server the Playwright suite starts |
| `npm run test:all` | Typecheck, lint, coverage and every Playwright project, except production |
| `npm run report` | Opens the last Playwright HTML report |
| `npm run fixtures:build` | Rebuilds the generated test fixtures |
| `npm run e2e:local` | Every page and API on a running server; set `BASE_URL` for production |
| `npm run verify` | All verify scripts below |
| `npm run verify:calculations` | Engine invariants on the defaults |
| `npm run verify:pricer` | Every leg against the closed form, parity and analytic delta |
| `npm run verify:exports` | Five sheets, no pivots, Pricer header |
| `npm run verify:vol-upload` | Surface file round trip |
| `npm run verify:edge-cases` | Every popup and its fix |
| `npm run verify:mongo` | Collection counts and sizes, never the connection string |
| `npm run seed:mongo` | Write the built in seed to the database |
| `npm run bake:vol-surface -- "<file.xlsx>" [YYYY-MM]` | Rebuild the built in seed from a surface file |
| `npm run build:samples` | Rebuild the sample surface file |

## Testing

The tests run without the internet or the desk database. In mock mode, Yahoo answers from a fixed history (Sensex 76,835.78, Nifty 23,500.00), Mongo is an in-memory server seeded from `tests/fixtures`, and the clock is frozen at 28-Oct-2026 10:00 IST.

```powershell
npm run test:all            # typecheck, lint, Vitest with coverage, every Playwright project
npm run build
$env:E2E_PROD = "1"; npm run e2e:blank   # one suite against the production build
npm run report              # the last Playwright HTML report
```

- **Vitest** covers the engine, validation, copy rules, components, API routes and the Excel file.
- **Playwright** covers both input modes end to end.
  - The Blank Inputs suite checks every required field, every number field and every output table against `tests/fixtures/table-schema.json`.
  - It also checks every headline number against `tests/fixtures/regression-expected.json` to 1e-6, and the Excel file.
  - It covers keyboard use, 390 px width, both themes and axe.
- **CI** runs it all on every push.
- **Production smoke:** a read-only run against production after CI succeeds on `main`, and nightly.

See [07 Testing and Debug](docs/07-testing-debug.md) for mock mode, fixtures, page objects, snapshots and traces.

## Architecture

- `lib/engine`: pure TypeScript engine, one function per sheet block, with the sheet cell in a comment above each formula.
- `lib/tables.ts`: every table defined once and rendered both on screen and in Excel.
- `lib/data` and `lib/db`: built in seeds, MongoDB load and save per month.
- `lib/workbook`: the Excel export, the surface file and the upload parser.
- `app` and `components`: pages, API routes and UI.
- `tests` and `e2e`: Vitest and Playwright.

## Deploy

Pushing to `main` deploys to Vercel production. See [09 Deploy on Vercel](docs/09-vercel-deploy.md).

## Docs

See [docs/README.md](docs/README.md).
