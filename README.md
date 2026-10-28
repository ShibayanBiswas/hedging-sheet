# Hedging Sheet

A desk web app for the five year accelerator hedge. It replicates the accelerator payoff with an option book, prices every leg on the vol surface, solves the Inbuilt, sizes the Day 1 vega hedge, stress-tests margin, and exports the five working sheets to Excel.

Spot, the valuation date and daily volatility load live. Set the inputs, press **Run Simulation**, and the output tabs fill in.

Production: [hedging-sheet.vercel.app](https://hedging-sheet.vercel.app)

## Run it

```powershell
npm install
copy .env.example .env.local   # then fill in the MongoDB variables
npm run dev                    # http://localhost:3005
```

The app runs from the built in seed when the database is unavailable.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3005 |
| `npm run build` | Production build |
| `npm run test` | Engine invariants, inputs, upload and Excel tests |
| `npm run test:e2e` | Playwright smoke tests on a scratch database |
| `npm run lint` and `npm run typecheck` | Static checks |
| `npm run verify:calculations` | Price the defaults and check every invariant |
| `npm run verify:exports` | Build and reopen the Excel file |
| `npm run test:edge-cases` | Print every edge case popup and fix |
| `npm run test:upload-schema` | Parse the sample as an upload |
| `npm run build:samples` | Rebuild the vol surface sample download |
| `npm run bake:vol -- "<file.xlsx>" [YYYY-MM]` | Rebuild the built in seed from a surface file |
| `npm run seed:mongo` | Write the built in seed to MongoDB |
| `npm run test:mongo` | Print collection counts and sizes, never the connection string |

## Docs

See [docs/README.md](docs/README.md).

## Layout

- `lib/engine`: pure TypeScript engine, one function per sheet block.
- `lib/tables.ts`: every table defined once and rendered both on screen and in Excel.
- `lib/data`: built in seeds and the MongoDB load and save.
- `app`: pages and API routes. `components`: UI.
- `tests` and `e2e`: Vitest and Playwright.
