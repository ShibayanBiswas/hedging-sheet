# 03 · Pricer Logic

The Pricer tab shows the option book that replicates the payoff. The row by row formulas are in [02 Calculation Logic](02-calculation-logic.md#pricing-one-option); this page covers how the book is laid out and how the desk works with it.

## Layout

- **Headline.** Start level, Actual Inbuilt, Premium, Maturity Payout, Achieved Coupon, Delta in Contracts and Internal Rate of Return, as one table row.
- **Pot Computation.** The Pricer top block, B5 to V5, one row each, in sheet order: Start Level, Coupon, Option Expiry, Mobilisation, Actual Inbuilt, Product Cost, Inbuilt, Transaction Cost, Net Mobilisation With NBFC, Premium, NBFC Rate, Premium Growth Rate, Tenor, Maturity Payout, Achieved Coupon, Delta, Vega, Rho, Gamma, Internal Rate of Return and Margin.
- **Payout Construction.** The coupon, the payout from each spread, the decay, the protection level and the loss at the protection point.
- **Leg Grid.** One column per live leg. The header has two levels: the strike as "137% · 1,05,901" over the real expiry date, such as "28-Mar-2030". Rows follow Pricer column A, from Underlying to Rho in Rupees.

## Legs

- Live legs only: every strike at every observation expiry, 36 with the defaults. The sheet's unused slots are not shown.
- The sheet keeps the book in two identical halves. The grid shows one column per leg; book totals count each leg twice, and contracts are divided by twice the live expiry count so the totals are right.
- Units: the slope change at each strike, shown in the Spread row. Buy where the slope rises, Sell where it falls.

## No placeholders

Every cell is computed. Upper and Lower Maturity always resolve, because the rate curve is anchored at the valuation date and runs a year past the longest expiry. Incremental Margin is 0 on Bid, as row 38 says, and a number on Offer. A dash appears only where a value cannot apply, with a tooltip giving the reason.

## Volatility overrides

Every Volatility cell is editable. Typing a value overrides that strike at that expiry, in both halves of the book. The cell gets a gold ring and an Overridden badge, and the run is marked stale. Clearing the cell or pressing Reset returns it to the surface. Run the simulation again to price on the overrides.

## Bid or Offer

Bid or Offer is a surface parameter, set on Market Data or in the file's Surface Parameters sheet, Bid by default. It sets the discount yield cap, the dividend factor, and whether incremental margin applies.
