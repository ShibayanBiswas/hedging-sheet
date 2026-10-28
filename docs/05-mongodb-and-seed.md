# 05 · MongoDB and Seed

## What is stored

Only market data. Inputs are never stored: there are no saved input sets and no product records.

| Collection | Content |
|---|---|
| Vol surfaces | One document per month, keyed by `monthKey`. The latest month on or before today is active. |
| Pricing params | Surface parameters per month, keyed by `monthKey`: Bid or Offer, the rate caps, the dividend factor, the rate curve tenors and the implied dividends. The latest month on or before today is active. |
| Upload logs | File name, type, month and time of every upload and desk edit. |

Collection names are in `COLLECTIONS` in `lib/db/mongo.ts`. Saving Surface Parameters writes this month's parameters document. It also writes the Pricing Params scalars into the forward grid of this month's surface document.

## Fallback

When the database is unavailable the app runs from the built in seed: `lib/data/vol-surface-seed.json` and `lib/data/pricing-params-seed.json`. Older parameters documents with a dated rate curve are read through `normalizePricingParams`, which swaps in the default tenor curve and Bid.

A month without an upload carries the latest grid forward, with that month's Nifty and Sensex closes on the first session as the anchors.

## Connection

Set either `MONGODB_URI`, or `MONGODB_HOST` with `MONGODB_USER` and `MONGODB_PASSWORD`, plus `MONGODB_DB`, in `.env.local`. `.env.local` is git-ignored; `.env.example` holds placeholders only. Never paste a connection string into chat, docs, tests or commits. Scripts print the database name and counts, never the URI.

## Scripts

| Script | What it does |
|---|---|
| `npm run seed:mongo` | Writes the built in seed surface and surface parameters to the database for the current month. |
| `npm run verify:mongo` | Prints the database name, collection counts and sizes, and cluster storage. |
| `npm run bake:vol-surface -- "<file.xlsx>" [YYYY-MM]` | Rebuilds the built in seed from a surface file in the upload layout. |

Playwright runs against the scratch database `hedging_sheet_e2e`, so uploads and parameter saves in tests never touch the live desk data.
