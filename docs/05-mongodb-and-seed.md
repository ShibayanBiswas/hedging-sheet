# 05 · MongoDB and Seed

## What is stored

Only market data. Inputs are never stored: there are no saved input sets and no product records.

| Collection | Content |
|---|---|
| Vol surfaces | One document per month, keyed by `monthKey`. The latest month on or before today is active. |
| Pricing params | The surface parameters: Bid or Offer, rate caps, the rate curve tenors and the implied dividends. One active document. |
| Upload logs | File name, type and time of every upload and desk edit. |

Collection names are in `COLLECTIONS` in `lib/db/mongo.ts`.

## Fallback

When the database is unavailable the app runs from the built in seed in `lib/data`: `vol-surface-seed.json` and `pricing-params-seed.json`. Older pricing params documents with a dated rate curve are read through `normalizePricingParams`, which swaps in the default tenor curve and Bid.

A month without an upload carries the latest grid forward, with that month's Nifty and Sensex closes on the first session as the anchors.

## Connection

Set either `MONGODB_URI`, or `MONGODB_HOST` with `MONGODB_USER` and `MONGODB_PASSWORD`, plus `MONGODB_DB`, in `.env.local`. `.env.local` is git-ignored; `.env.example` holds placeholders only. Never paste a connection string into chat, docs, tests or commits. Scripts print the database name and counts, never the URI.

## Scripts

| Script | What it does |
|---|---|
| `npm run seed:mongo` | Writes the built in seed surface and surface parameters to the database. |
| `npm run test:mongo` | Prints the database name, collection counts and sizes, and cluster storage. |
| `npm run bake:vol -- "<file.xlsx>" [YYYY-MM]` | Rebuilds the built in seed from a surface file in the upload layout. |

Playwright runs against the scratch database `hedging_sheet_e2e`, so uploads in tests never touch the live desk surface.
