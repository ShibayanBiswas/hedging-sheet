# 02 · Engine Specification

The engine in `lib/engine` is pure TypeScript with no React or browser dependency. Each function below maps to cells of the saved workbook. The cell references are for developers only; they never appear in the UI.

## Units and day count

- Time in years is `days / 365`, where days are whole calendar days between two dates. Excel date serials are used for parity, so time interpolation uses the same day counts.
- Crore is 1e7 rupees and lakh is 1e5.

## Start level and strikes

- Start level is the spot times one plus the uplift, rounded up to the next 100. The workbook uses 0.6 percent. With spot 76,799 this gives 77,300.
- Each strike in rupees is `ROUND(startLevel × strikePercent / 100, 0)`.

## Expiry schedule

- An expiry month number `n` counts calendar months from the valuation month. The expiry is the last chosen weekday of that month.
- Defaults are 41, 44, 47, 50, 53 and 56 from August 2026, which give 31-Jan-2030, 25-Apr-2030, 25-Jul-2030, 31-Oct-2030, 30-Jan-2031 and 24-Apr-2031, all last Thursdays.
- The hedge expiry defaults to the median expiry; for an even count, the lower middle one.

## Vol surface lookup

The workbook formula is `FORECAST` across the two bracketing strike columns of the bracketing expiry row, then linear in calendar days between that row and the next.

- Strike axis: Deep 500, then moneyness times the reference spot, which is 76,835.78 for Sensex in the workbook.
- Within the grid this is bilinear interpolation. Beyond the last expiry the engine holds the last row flat; the workbook only hits the last row exactly.
- The vol bump for the expiry is added after dividing by 100.

## Rate curve and discount yield

- Upper Maturity is the last curve date on or before the option maturity. Lower Maturity is the next curve date, or blank.
- Upper and Lower Forward are the curve rates at those dates. When Lower Maturity is blank both equal the upper rate.
- The interpolated rate is a straight line through the two points. The workbook curve ends on 30-Dec-2025, so every 2030 and 2031 expiry reads the last point, which is linked to the Premium Growth Rate of 6.5 percent.
- Pricer discount yield for a bought put is the smaller of the rate cap while selling forward and the interpolated rate. The cap also equals the Premium Growth Rate.

## Forward growth

- Pricer: the Forward Sell Rate of the Pricing Params row on or before the expiry. All rows are 5.5 percent in the workbook.
- Day 1 Vega Hedge, fair price: the larger of the discount yield minus the dividend yield and the Forward Sell Rate. Dividend yield is the sum of implied dividends dated before the expiry, divided by the shocked spot, times 365 over the days to expiry.

## Black-Scholes price

For forward growth g, discount r, vol σ, time T, spot S and strike K:

- F = S·e^{gT}
- d1 = (ln(F/K) + σ²T/2) / (σ√T), d2 = d1 − σ√T
- Put = (K·N(−d2) − F·N(−d1))·e^{−rT}; Call = (F·N(d1) − K·N(d2))·e^{−rT}
- N is the standard normal distribution, matched to Excel `NORMDIST` with a high precision implementation.

## Greeks by bump and reprice

| Greek | Workbook definition |
|---|---|
| Delta | price at S + 0.5 minus price at S − 0.5 |
| Gamma | price at S + 1 plus price at S − 1 minus twice the price at S |
| Theta | price with one day less minus price today |
| Vega | price at σ + 1 percent minus price at σ |
| Rho | price with both g and r up 1 percent minus price today |

## Leg replication

The client payoff is piecewise linear in the underlying level s, measured as a fraction of the start level. The put book value is `V(s) = Σ uᵢ·(kᵢ − s)⁺`, and the client receives the maximum coupon plus V.

Units at each strike are the change in slope of V across that strike: slope just above minus slope just below. Slopes in the workbook are built from rounded rupee strikes:

| Segment | Slope of V |
|---|---|
| Above the top strike | 0 |
| Inside spread j | payout of spread j × start level ÷ rupee width of spread j |
| Between the protection strike and the lowest spread buy level | 0 |
| Between protection minus the outflow width and protection | protection × decay × start level ÷ rupee width, plus decay |
| Between the floor and protection minus the outflow width | decay |
| Below the floor | decay minus the floor units |

With the defaults the units are −10.05, +9.05, +1, −25.6, +24 and +1 at 137, 127, 125, 85, 84 and 70.

## Contracts and book totals

- The workbook keeps two identical halves of the leg grid. Contracts per leg column are `units × notional ÷ startLevel ÷ (2 × number of live expiries)`.
- Option Value is minus contracts times price. The premium is the sum over every column of both halves.
- Delta, Gamma, Theta, Vega and Rho in the book are contracts times the per-option Greek, summed the same way.

## Pots and payout

- Mobilisation E = notional in rupees. Transaction cost I = E × the sum of transaction, issuance and margin cost rates.
- NBFC amount J = E − Inbuilt − I − Margin.
- Maturity payout O = J·(1 + NBFC rate)^{T/365} + Premium·(1 + premium rate)^{T/365} + Margin·(1 + margin growth rate)^{T/365}.
- Achieved coupon is O ÷ E − 1, and the internal rate of return is (1 + coupon)^{365/T} − 1.

## Inbuilt solver and the margin loop

- The Inbuilt is solved so that the achieved coupon equals the target coupon, with Brent's method, a bisection fallback and a 1e-10 tolerance. This replaces the workbook goal seek macro.
- The margin is the 0 percent row of the Mark to Market grid as a fraction of notional. It is fixed-point iterated with the solver until the change is below 1e-9 or 50 passes. In this product the margin does not depend on the Inbuilt, so the loop settles after one pass. The count is shown in the Logic Atlas debug drawer.

## Day 1 Vega Hedge

- Hedge quantity is book vega in rupees, with the sign flipped, divided by the vega of one hedge put at the 0 percent move.
- Three pricing blocks for each move from −50 to +20 percent in 5 percent steps: fair price from the surface; exchange price at the flat annual vol and the exchange rates; stressed price at the spot shocked down by six daily sigmas over two days and 1.25 times the annual vol.
- Initial margin = (stressed − exchange)·quantity ÷ 1e7 + (fair − day 1 fair)·quantity ÷ 1e7. Exposure margin = exposure rate × shocked spot × quantity ÷ 1e7.

## Mark to Market and Margin Requirement

- Product requirement at each move is book delta in lakh, repriced directly at the shocked spot. This replaces the workbook MTM macro, so no shocked spot is ever left behind.
- Residual futures = product requirement + hedge option delta in lakh.
- Futures margin = −residual × futures margin rate × level × 1e5 ÷ 1e7.
- Step mark to market is built outward from 0 at the 0 percent row, using the residual of the row nearer to 0 percent.
- Total requirement = futures margin + cumulative mark to market + option margin.

## Product Description payoff

For performance p, coupon C, protection P, decay D, floor performance f and floor units u:

- p ≥ −P: the upside, `MIN(C, Σ spread payoffs)`.
- −90 percent ≤ p < −P: `MAX(−100%, MAX(f·D, p·D) + MIN(0, (p − f)·(D − u)))`.
- p < −90 percent: p.
- Pre-tax internal rate of return is (1 + payoff)^{365/T} − 1.
