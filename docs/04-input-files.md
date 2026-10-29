# 04 · Input Files

The desk uploads one file: the monthly vol surface. Use Upload Surface on Market Data or the header shortcut; a popup reports the result, and the next Run Simulation prices on it. Download Surface writes the active surface in the same layout, so the desk can edit it offline and upload it back. The sample file on Market Data has the same layout; `npm run build:samples` rebuilds it.

The forward Pricing Params grid, the Rate Curve and the Dividends sheets drive pricing and round trip through the file, but Market Data no longer shows them as tables.

The hosted app accepts files up to 4.5 MB. `npm run verify:vol-upload` builds the file from the built in seed, parses it back and checks every value.

## Vol Surface sheet

| Row or column | Content |
|---|---|
| Header row | Strike Change, Deep, then one Strike Change % per column, such as 55% to 150% |
| Strike rows | Nifty Strikes and Sensex Strikes: the reference price times the Strike Change, as formulas |
| One row per expiry | The expiry date, then a volatility in % points per column, such as 13.39 |

The Deep ₹500 strike takes the Deep column. On Market Data, expiry rows before the valuation date are hidden because no live leg reads them; they stay in the file.

## Surface Parameters sheet

Parameter and Value rows:

| Parameter | Example | Used For |
|---|---|---|
| Month | October 2026 | Label only |
| Reference Nifty Price | 23,995.95 | 100% anchor of the surface for Nifty |
| Reference Sensex Price | 76,835.78 | 100% anchor for Sensex |
| Bid or Offer | Bid | Pricer row 34 |
| Volatility Bump | 0.00% | Pricer row 33 |
| Forward Sell Rate | 5.50% | Pricer row 28 |
| Dividend Bid or Offer Factor | 1.00 | Pricer row 30 |
| Rate Cap While Buying Forward | 6.80% | Pricer row 29 |
| Rate Cap While Selling Forward | 6.50% | Shown for reference; read from the last rate curve point |

Below them, the forward Pricing Params grid: Date, Volatility Bump, Incremental Margin, Full Margin, Margin Cost and Forward Sell Rate, from the valuation month on.

## Rate Curve sheet, optional

| Tenor In Years | Rate % | Linked To Premium Growth Rate |
|---|---|---|
| 0 | 6.5 | Yes |
| 1 | 6.5 | Yes |

Tenors are counted from the valuation date. Linked points follow the Premium Growth Rate input. Without this sheet the default curve is used: tenors 0, 1, 2, 3, 5, 7 and 10 years, all linked.

## Dividends sheet, optional

| Date | Implied Dividend In Index Points |
|---|---|

Future dates only. Points are Sensex index points; Nifty scales them by the ratio of the two reference prices.

## Editing without a file

Market Data edits the surface cell by cell, with validation: each value must be above 0 and at most 200 % points. The Surface Parameters editor saves Bid or Offer, the Pricing Params scalars, the dividend factor, the buying cap and the rate curve tenors to this month in the desk database.
