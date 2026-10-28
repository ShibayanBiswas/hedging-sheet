# 04 · Input Files

The desk uploads one file: the monthly vol surface. Upload it from the header shortcut, Upload Volatility Surface, or from Market Data. A popup reports the result, and the next Run Simulation prices on it. Download Sample on Market Data gives the exact layout; `npm run build:samples` rebuilds it.

The hosted app accepts files up to 4.5 MB.

## Vol Surface sheet

| Row or column | Content |
|---|---|
| Header row | Expiry, then one Strike Change percent per column, such as 55, 60 … 150 |
| One row per expiry | The expiry date, then a volatility in percent points per column, such as 13.39 |

The Deep ₹500 strike takes the 55 percent column. Expiry rows already passed on the India calendar are dropped.

## Surface Parameters sheet

Key and value rows:

| Key | Example | Used for |
|---|---|---|
| Reference Nifty Price | 23,995.95 | 100 percent anchor of the surface for Nifty |
| Reference Sensex Price | 76,835.78 | 100 percent anchor for Sensex |
| Bid or Offer | Bid | Pricer Bid or Offer row, the discount yield cap and the dividend factor |
| Rate Cap While Buying Forward | 6.80% | Discount yield cap, see [02 Calculation Logic](02-calculation-logic.md#discount-yield-cap) |
| Dividend Bid Offer Multiplier | 1 | Dividend factor |

Below them, a Pricing Params table with one row per date: Date, Volatility Bump, Forward Sell Rate, and optionally Incremental Margin, Full Margin and Margin Cost.

## Rate Curve sheet, optional

| Tenor In Years | Rate In Percent | Linked To Premium Growth Rate |
|---|---|---|
| 0 | 6.5 | Yes |
| 1 | 6.5 | Yes |
| … | … | … |

Tenors are counted from the valuation date. Linked points follow the Premium Growth Rate input. Without this sheet the default curve is used: tenors 0, 1, 2, 3, 5, 7 and 10 years, all linked.

## Dividends sheet, optional

| Date | Implied Dividend |
|---|---|

Points are Sensex index points; for Nifty they are scaled by the ratio of the two reference prices.

## Editing without a file

Market Data also lets the desk edit the surface grid, Bid or Offer, the rate caps and the rate curve tenors, and save them to the desk database.
