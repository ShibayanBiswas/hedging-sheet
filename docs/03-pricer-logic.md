# 03 · Pricer Logic

The Pricer tab shows the option book that replicates the payoff. The row by row formulas are in [02 Calculation Logic](02-calculation-logic.md#pricing-one-option); this page covers how the book is laid out and how the desk works with it.

## Layout

- **Headline.** Start level, Actual Inbuilt, Premium, Maturity Payout, Achieved Coupon, Delta in Contracts and Internal Rate of Return, as one table row.
- **Pot Computation.** Mobilisation, Inbuilt, transaction cost, the NBFC amount, premium, margin, payout and the achieved coupon.
- **Payout Construction.** The coupon, the payout from each spread, the decay, the protection level and the loss at the protection point.
- **Leg Grid.** One column per live leg, grouped by strike, for both halves of the book. Rows run from Strike Percent to Rho in Rupees, including Upper and Lower Maturity, Forward Growth, Discount Yield, Dividends, Volatility, Bid or Offer and the Incremental and Full margin rows.

## Legs

- Strikes: every strike in the strike list, highest first.
- Expiries: every observation expiry.
- Halves: the sheet keeps two identical halves of the grid, so every strike and expiry appears twice. Contracts are divided by two times the live expiry count so the book total is unchanged.
- Units: the slope change at each strike. Buy where the slope rises, Sell where it falls.

## Volatility overrides

Every Volatility cell in the Leg Grid is editable. Typing a value overrides that strike at that expiry, in both halves of the book, marks the cell with a gold ring and an Overridden badge, and marks the run stale. Clearing the cell or pressing Reset returns every leg to the surface. Run the simulation again to price on the overrides.

## Bid or Offer

Bid or Offer is a surface parameter, set on Market Data or in the upload's Surface Parameters sheet, Bid by default. It sets the discount yield cap, the dividend factor, and whether the incremental margin applies: a Bid leg carries no incremental margin.

## Spread

The spread between the Incremental and Full margin adjusted prices is kept in the grid, as in the sheet.
