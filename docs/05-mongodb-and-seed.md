# 05 · MongoDB and Seed

## What is stored

Reference data only. Inputs, run results, sessions, logs and market data are never stored: there are no saved input sets, no product records and no upload logs. The design is in [01 Architecture](01-architecture.md#database).

| Collection | Content | Key |
|---|---|---|
| `vol_surfaces` | One volatility surface per month: expiries, strikes, the volatility grid, the forward grid and the Nifty and Sensex anchors. The latest month on or before today is active. | Unique `monthKey` |
| `pricing_params` | Surface parameters per month: Bid or Offer, the rate caps, the dividend factor, the rate curve tenors and the implied dividends. The latest month on or before today is active. | Unique `monthKey` |

Each document also carries `source`, such as `upload <file name>` or `desk edit`, and `updatedAt`. The shapes are in `lib/db/schemas.ts` and are enforced by the database. Saving Surface Parameters writes this month's parameters and the Pricing Params scalars in this month's surface, in one transaction.

## Fallback

When the database is unavailable the app runs from the built in seed: `lib/data/vol-surface-seed.json` and `lib/data/pricing-params-seed.json`. A save then applies to that server instance only, and the desk is told so.

A month without an upload carries the latest grid forward, with that month's Nifty and Sensex closes on the first session as the anchors.

## Connection

Set either `MONGODB_URI`, or `MONGODB_HOST` with `MONGODB_USER` and `MONGODB_PASSWORD`, plus `MONGODB_DB` and `DESK_WRITE_KEY`, in `.env.local`. `.env.local` is git-ignored; `.env.example` holds placeholders only. Never paste a connection string or the Desk Key into chat, docs, tests or commits. Scripts print the database name and counts, never the URI.

## Scripts

| Script | What it does |
|---|---|
| `npm run db:audit -- --label before` | Read-only inventory: counts, sizes, indexes, a masked sample, schema variations, duplicates, orphans, test documents, empty keys, expired months and collections the code no longer uses. Writes a section of `docs/db-audit-report.md`. |
| `npm run db:cleanup` | Dry run: prints exactly what would be deleted, dropped or tidied. |
| `npm run db:cleanup -- --apply` | Backs every affected collection up to `backups/<date>/` as Extended JSON, checks the backup, then applies. `backups/` is git-ignored. |
| `npm run db:apply-validators` | Applies the `$jsonSchema` validators, strict. |
| `npm run db:ensure-indexes` | Creates the unique `monthKey` indexes and drops any other. |
| `npm run seed:mongo` | Writes the built in seed surface and surface parameters for the current month. |
| `npm run verify:mongo` | Prints the database name, collection counts and sizes, and cluster storage. |
| `npm run bake:vol-surface -- "<file.xlsx>" [YYYY-MM]` | Rebuilds the built in seed from a surface file in the upload layout. |

Every script takes `--db <name>` to work on another database, such as `hedging_sheet_preview`. Every Vercel build runs `scripts/db-deploy-setup.ts` first, which applies the indexes and validators to the database that deployment uses.

Playwright and the API tests run against an in-memory replica set with the same validators and indexes, so tests never touch a live database.
