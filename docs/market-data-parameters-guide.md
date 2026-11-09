# Market Data Parameters Guide

What the Pricer reads from market data, where each value lives, its default, whether the desk can edit it, and where it is used. Code: `lib/data/load.ts`, `lib/db/unwinding-surface.ts`, `lib/engine/vol-surface.ts`, `lib/engine/rates.ts`, `app/api/params/route.ts`, `app/market-data/page.tsx`.

## The Volatility Surface: One Desk Surface, Shared With The Unwinding Calculator

The Hedging Sheet prices on the same volatility surface as the [Unwinding Calculator](https://unwinding-calculator.vercel.app). The Excel workbooks' MarketData grids are never the live surface; they serve only as fixtures for the formula goldens.

**Wiring: shared read, with mirror and write through.**

| Step | What happens |
|---|---|
| Read | `loadActiveSurface` reads `unwinding_calculator.vol_surfaces` on the same Atlas cluster with the Unwinding Calculator's own rule: this month's document when it has a grid, else the latest earlier month with one (`readUnwindingSurface`). The read is cached for five minutes, because the Unwinding Calculator saves without telling this app. |
| Present | A carried month shows under the current month's name with that month's Nifty and Sensex closes on its first session as the anchors; a current month without anchors takes them the same way. This is the Unwinding Calculator's `presentSurfaceForDeskMonth`, so both apps show the same label, anchors and grid. |
| Compose | The grid fields (expiries, moneyness, strikes, volatilities, anchors) come from the Unwinding Calculator. The dated Pricing Params grid (bump, margins, forward sell rates) is this desk's own, from `hedging_sheet.vol_surfaces`. |
| Mirror | When this desk's month document holds a different grid, the shared grid is written into `hedging_sheet.vol_surfaces` for the current month (source `unwinding <month>`), keeping its Pricing Params grid. The desk database always holds what is priced. |
| Write through | Upload Surface and Edit Surface on this desk save the grid here and as the Unwinding Calculator's active surface, in one transaction: other months lose `isActive`, the month keeps its own one point Pricing Params when it has one, and the upload is logged in `upload_logs`, as the Unwinding Calculator's own upload does. One file feeds both desks. |
| Fallback | No shared surface: this desk's own month document. No database: the last save on this server, then the built in surface (`lib/data/vol-surface-seed.json`). |

Only production touches the live surface. The Unwinding database name follows this desk's: `hedging_sheet` reads `unwinding_calculator`; previews read `unwinding_calculator_preview`, development deployments `unwinding_calculator_development` and tests `unwinding_calculator_test`. `UNWINDING_MONGODB_DB` overrides it (`resolveUnwindingDbName`). `/api/health` reports the shared database and month under `database.sharedSurface`.

The Market Data headline shows Source: Shared With The Unwinding Calculator, Desk Database or Built In Surface.

### Surface Layout

| Field | Meaning | Rule |
|---|---|---|
| Deep | A far out of the money strike used only to interpolate | Always ₹500 for Nifty and Sensex; its volatility always equals the 55% column of its row (`normalizeVolSurface`) |
| Moneyness | Strike Change % columns, 55% to 150% | A column's strike is moneyness × the index anchor |
| Reference Nifty Price, Reference Sensex Price | The 100% anchors | Always the Yahoo closes on or before the 1st of the current month, for an uploaded surface as for a carried one; the surface file's own prices stand only when Yahoo returns none |
| Expiries | One row per expiry | Sorted; an expiry beyond the last row reads the last row |
| Volatilities | Percent points, 13.39 means 13.39% | Above 0 and at most 200 |

Interpolation (`interpolateVolPercent`): FORECAST across the two strike columns, then linear in calendar days between the two expiry rows, plus the Volatility Bump.

### Upload, Download, Reload

| Action | Behaviour |
|---|---|
| Upload Surface | Accepts the Unwinding Calculator's Vol Surface Input file (a Vol Surface sheet with Strike Change % columns and a Surface Parameters sheet with Reference Nifty Price, Reference Sensex Price, Volatility Bump and Forward Sell Rate) or a desk workbook's MarketData and Pricing Params. Preview first; Confirm Upload saves. A file with one Surface Parameters point keeps this desk's dated Pricing Params grid and writes that point's bump and forward sell rate from its month onward (`withMonthScalars`). A desk workbook's Implied Dividends are read from the Date column next to them. |
| Edit Surface | Edits volatilities in place; Save Surface writes here and to the Unwinding Calculator. |
| Download Current Surface | The surface and its parameters in the upload layout. |
| Download Sample | `public/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx`. |
| Reload From Desk Database | Reads the shared surface and this desk's parameters again. |

## Surface Parameters

Edit Parameters opens every row; Save posts to `/api/params` and writes the chosen month to `pricing_params` and the Pricing Params scalars to that month's `vol_surfaces` document, in one transaction. Reset reloads from the desk database. Without a database the save applies for this session only and says so.

| Parameter | Default | Editable | Stored In | Used In |
|---|---|---|---|---|
| Month | The current desk month, such as November 2026 | Yes: a month picker. Another month loads its saved values, or for a new month the latest earlier ones it starts from; Save writes that month | `monthKey` of both documents | Which month's parameters and Pricing Params rows are active: the latest month on or before today |
| Bid Or Offer | Bid | Yes | `pricing_params.bidOffer` | Pricer row 34; which rate cap and dividend factor a leg takes |
| Volatility Bump | 0.00% | Yes | `vol_surfaces.pricingParams[].volBump`, from the month's row onward | Added to every interpolated volatility, Pricer row 33 |
| Incremental Margin | 6.03% | Yes | `pricingParams[].incMargin` | Pricer rows 38 to 41 |
| Full Margin | 12.03% | Yes | `pricingParams[].fullMargin` | Pricer rows 43 to 46 |
| Margin Cost | 3.00% | Yes | `pricingParams[].marginCost` | Pricer margin cost rows |
| Forward Sell Rate | The valuation month's row of this desk's Pricing Params grid, which Market Data shows as Forward Sell Rate This Month. Until a month is saved the built in workbook grid applies: 4.45% to September 2026, then 5.50% (5.50% for a November 2026 valuation, read 09-Nov-2026). The Unwinding Calculator's file gives the grid only; its Forward Sell Rate is not read | Yes | `pricingParams[].fwdSellRate`, and `pricing_params.forwardSellRate` | Pricer B28 forward growth, `forwardSellRateForMonth`; the workbooks' Premium Rate is this plus 1% |
| Dividend Bid Or Offer Factor | 1.00 | Yes | `pricing_params.dividendBidOfferMultiplier` | Pricer B30, 'Pricing Params'!M2 |
| Rate Cap While Buying Forward | 6.80% | Yes | `pricing_params.rateCapBuyingForward` | Pricer B29: a put on Offer and a call on Bid, 'Pricing Params'!N2 |
| Rate Cap While Selling Forward | The last rate curve point: the Premium Growth Rate while it is linked, 'Pricing Params'!O2 | Yes: a typed cap is stored; Follow The Rate Curve clears it. Shows "-" only while it follows a Premium Growth Rate not entered yet | `pricing_params.rateCapSellingForward`, optional | Pricer B29: a put on Bid and a call on Offer (`rateCapSellingForward`) |
| Premium Growth Rate Link | All Points Linked | Yes: All Linked or None Linked; a mix shows as Some Points Linked | `pricing_params.rateCurve[].linkedToPremiumRate` | Linked points take the Premium Growth Rate |
| Rate Curve Points | 0, 1, 2, 3, 5, 7 and 10 years at 6.50% | Yes: tenor and rate per point, add and remove | `pricing_params.rateCurve` | Pricer rows 21 to 24 and 29, anchored at the valuation date (`anchoredCurve`, `readRateCurve`) |

A margin missing from a month's row shows the built in row of that month, so every field opens with a value.

## Implied Dividends

`pricing_params.dividends`: dated amounts in index points. Pricer B30 = SUMIF(dates < maturity, amounts) ÷ spot × 365 ÷ days × the dividend factor (`dividendYield`). A live run reads dividends on or after the valuation date (`forwardMarket`).

## Collections

| Database | Collection | Key | Holds |
|---|---|---|---|
| `unwinding_calculator` | `vol_surfaces` | `monthKey`, `isActive` | The shared grid and anchors, plus the Unwinding Calculator's one point Pricing Params |
| `hedging_sheet` | `vol_surfaces` | unique `monthKey` | The mirrored grid plus this desk's dated Pricing Params grid |
| `hedging_sheet` | `pricing_params` | unique `monthKey` | Bid or Offer, the rate caps, the dividend factor, the rate curve and the dividends |

Tests: `tests/edge/shared-surface.test.ts` (shared read, mirror, write through, fallback and the Unwinding sample file), `tests/unit/surface-params.test.ts` (the selling forward cap and month scalars), `tests/golden/g1-nifty-rollover.test.ts` (the formulas on a fixture surface).
