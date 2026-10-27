# Hedging Sheet

A desk web app that replaces the workbook `Hedging Sheet 5y Accelerator_Aug26_Approval_.xlsm`. It replicates an accelerator payoff with a put book, prices every leg on the vol surface, solves the Inbuilt, sizes the Day 1 vega hedge, stress-tests margin, and exports the five working sheets to Excel.

With the default inputs every number matches the saved workbook: Actual Inbuilt 7.95%, Option Premium ₹50.67 crore, Maturity Payout ₹202.5 crore, margin 32.31%, hedge quantity 12,809.67.

## Run it

```powershell
npm install
copy .env.example .env.local   # then fill in MONGODB_URI
npm run dev                    # http://localhost:3005
```

The app runs from the built-in seeds when the database is unavailable.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3005 |
| `npm run build` | Production build |
| `npm run test` | Engine parity, input, upload and Excel tests |
| `npm run test:e2e` | Playwright smoke tests on a scratch database |
| `npm run lint` and `npm run typecheck` | Static checks |
| `npm run extract:workbook` | Rebuild the seeds and parity fixtures from the `.xlsm` |
| `npm run build:samples` | Rebuild the vol surface sample download |
| `npm run sync:seed` | Seed the workbook surface and parameters into MongoDB |
| `npm run verify:mongo` | Print collection counts and sizes, never the connection string |

## Docs

- [01 Layout Plan](docs/01-layout-plan.md)
- [02 Engine Specification](docs/02-engine-spec.md)
- [08 Issue Fixes](docs/08-issue-fixes.md)
- [09 Deploy on Vercel](docs/09-vercel-deploy.md)

## Layout

- `lib/engine`: pure TypeScript engine, one function per workbook block.
- `lib/tables.ts`: every table defined once and rendered both on screen and in Excel.
- `lib/data`: seeds and `workbook-parity.json`, extracted from the saved workbook.
- `app`: pages and API routes. `components`: UI.
- `tests` and `e2e`: vitest and Playwright.
