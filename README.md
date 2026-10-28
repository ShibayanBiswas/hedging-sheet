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
| `npm run build` | Production build |
| `npm run lint` and `npm run typecheck` | Static checks |
| `npm test` | Acceptance, regression, engine, input, upload and Excel tests |
| `npm run test:e2e` | Playwright on a scratch database |
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
