# 02 · Calculation Logic

Every number in the app comes from the pure TypeScript engine in `lib/engine`. This page maps each sheet formula to the function that implements it. The same cell reference sits as a comment above the code, for example `// Pricer!B21`. Cell references are for developers only and never appear in the UI.

Run `npm run verify:calculations` to price the default product and check the invariants listed at the end.

## Units and day count

- Days are whole calendar days between two dates; time in years is days ÷ 365.
- Crore is 1e7 rupees and lakh is 1e5.
- % inputs are stored as fractions: 102.5% is `1.025`. Strikes are stored as % points: `137` means 137% of the start level.

## Live defaults

Nothing is pinned to a saved day. On load the app fills:

| Input | Source | Code |
|---|---|---|
| Spot | Last completed session close for the underlying | `lib/market-data.ts` `fetchLiveMarketLevels`, `/api/market/levels` |
| Valuation Date | Today on the India calendar | `istTodayYmd` in `lib/engine/dates.ts` |
| Daily Volatility | Standard deviation of daily log returns over the History Window, 365 days by default | `/api/market/daily-vol` |
| Vol surface and surface parameters | Latest month in the desk database, else the built in seed | `lib/data/load.ts` |
| Product terms | `DEFAULT_TERMS` | `lib/engine/defaults.ts` |

The default terms are a target of 37%, a coupon of 102.5%, strikes of 137, 127, 125, 85, 84 and 70, decay 1.6, floor units 1, tenor 1,940 days and expiry months 41, 44, 47, 50, 53 and 56.

## Strikes and derived terms

The strikes are the primary inputs. With `n` spreads there are `n + 4` strikes, highest first.

| Strike position | Role | Code |
|---|---|---|
| 1 | Target: the top of the top spread | `deriveTerms` target = strike 1 ÷ 100 − 1 |
| 1 to n + 1 | Spread levels. Spread `j` (bottom first) runs from strike `n + 1 − j` to strike `n − j` | `deriveTerms` spreads |
| n + 2 | Protection strike. Protection = 1 − strike ÷ 100 | `deriveTerms` protection |
| n + 3 | Outflow strike, one step below protection | `deriveTerms` outflowWidth |
| n + 4 | Decay floor | `deriveTerms` floorLevel |

With the defaults, Spread 1 runs from Strike 3 at 125 to Strike 2 at 127 and Spread 2 from Strike 2 at 127 to Strike 1 at 137.

- **Participation.** Every spread but the top takes its typed participation, 1 by default. The top spread is derived from the coupon: `Summary L10 = (D10 − (H10 − G10) × K10) ÷ (J10 − I10)`, that is the coupon left over after the lower spreads, divided by the top spread width. With the defaults that is (1.025 − 0.02) ÷ 0.10 = 10.05. Any participation can be overridden; Reset To Derived returns it to null, which means derived.
- **Spreads come from strikes.** A spread's Buy Level and Sell Level are the strikes it runs between, shown read-only, so the strikes and spreads never disagree. Adjacent spreads share a strike, so they can neither overlap nor leave a gap. The Number Of Spreads, 1 to 6, sets the strikes to n + 4.
- **Strike Level.** Each strike also shows its rupee level, `rupeeStrike(start, %)`. Typing a level sets the % to level ÷ start × 100, rounded to 4 decimals (`percentFromLevel`); the % stays the source, so a new spot or underlying moves every level and keeps every %.
- **Coupon exceeded.** When the top participation is typed and the spreads pay more than the Coupon, `coupon-exceeded` shows under the field and Run stays off until it is lowered or reset to derived.
- **Start level.** `Pricer!B5 = ROUNDUP(spot × (1 + uplift), −2)`. The uplift defaults to 0.6%. `startLevel` in `structure.ts`.
- **Hedge strike.** Auto from spot: Sensex `ceil(spot × 1.006 ÷ 100) × 100`, Nifty `ceil((spot + 150) ÷ 100) × 100`, with float noise rounded off first so an exact multiple stays put. `autoHedgeStrike` in `defaults.ts`. A typed hedge strike must be a positive multiple of 100. The workbook's H23, 76,800, is typed by hand, so the golden case feeds it directly.
- **Rupee strike.** `Pricer!B19 = ROUND(B5 × B17 ÷ 100, 0)`. `rupeeStrike`.

## Expiry schedule

`lib/engine/schedule.ts`.

- The weekday is fixed by the underlying: Sensex Thursday and Nifty Tuesday (NSE circular FAOP 68747 and BSE notice 20250623-59). `EXPIRY_WEEKDAY`.
- `lastThursday(year, month)` and `lastWeekdayOfMonth` in `lib/dates.ts`; `snapExpiry` moves a typed date to its month's expiry day.
- Default Values fill the expiries from helper months 41, 44, 47, 50, 53 and 56: each is the expiry day of the month that valuation date + ROUND(month × 30.5) days falls in, as the Summary Sheet's G3 to M3 helpers do. `expiryForMonth`, `defaultExpiryDates`. For 04-Aug-2026 that gives the workbook's C12 to H12 exactly.
- Expiries are typed dates, each moved to the last expiry weekday of its month: the last Thursday for Sensex, as every expiry the workbook typed is, and the last Tuesday for Nifty. There is no holiday adjustment, because the workbook has none. They must rise strictly and none may fall after maturity. The count runs from 1 to 10.
- The hedge Option Expiry defaults to the middle expiry, the lower one for an even count. `medianExpiryIndex`.
- Maturity = valuation date + tenor days. `maturityDate`.

## Leg replication

`buildStrikes` in `structure.ts`.

The client receives the coupon plus a book of options `V(s) = Σ uᵢ · (kᵢ − s)⁺` for puts, where `s` is the level as a fraction of the start level. Units at each strike are the change in slope of the payoff across that strike, slope above minus slope below, built from the rounded rupee strikes:

| Segment | Slope of V |
|---|---|
| Above Strike 1 | 0 |
| Inside spread j | `Pricer C13, C14`: payout of the spread × start level ÷ rupee width |
| Between the protection strike and the lowest spread | 0 |
| Between the outflow and protection strikes | `Pricer Z47 = −E14 × B5 ÷ (Z19 − AH19) − E12`, with E14 = protection × decay |
| Between the floor and the outflow strike | decay |
| Below the floor | decay − floor units |

With the defaults the units are −10.05, +9.05, +1, −25.6, +24 and +1.

**Option Type and Buy Or Sell.** Each strike takes its own Option Type, Put by default, and its own Buy Or Sell. The units above fix the side: Sell where they are negative, Buy where positive. `derivedSides` gives it, and a strike set to the other side blocks Run with the inline error `strike-side`. The Day 1 Vega Hedge is always a put.

- **Put strike.** `units` puts at the rupee strike. The spreads also pay the cash `participation × (s − b)` at maturity; `upsideCash` sums it, and the goal seek targets payout ÷ notional − 1 − cash.
- **Call strike.** `units` calls plus a short futures leg worth `contracts × discount × (forward − strike)`, the parity gap. Call plus futures leg is the put, so the strike's payoff, Premium and Greeks equal the put strike's, and every total equals the all Put book. The Pricer shows the call's own price and the leg's Futures Adjustment; Summary adds the Futures Adjustment For Call Strikes row in crore.
- **Equivalence.** `tests/call.test.ts` and `tests/golden/products.test.ts` check that all Call and mixed books equal the all Put book to 1e-9, and that every call leg holds parity against an independent Black formula.

**Payoff and book agree.** `payoffBookGap` evaluates the book and the payoff at every strike, half a point either side, and every 1% from −89% to 20 points past the target, skipping only the one point outflow band where the book spreads the protection drop. The largest gap is about 5e-15 for one, two and three spreads.

## Contracts

- `Pricer B55 = B47 × E5 ÷ B5 ÷ (2 × COUNTIF(B25:I25, "P"))`: units × notional ÷ start level ÷ (2 × live expiries). The sheet keeps two identical halves of the leg grid, `HALVES = 2`.
- `Pricer B48 = IF(B55 < 0, "Sell", "Buy")`.
- Rows 56 to 62: option value, delta, gamma, theta, vega and rho in rupees and contracts are contracts times the per-option figure.

## Pricing one option

`priceOption` in `hedging-sheet.ts` and `lib/engine/black-scholes.ts`.

The leg grid shows these rows in Pricer column A order. The strike % and rupee strike head each column as "137% · 1,05,901", with the real expiry date beneath.

| Pricer row | Field | Formula | Code |
|---|---|---|---|
| 18 | Underlying | the underlying | `inputs.underlying` |
| 19 | Strike | ROUND(B5 × B17 ÷ 100, 0) | `rupeeStrike` |
| 20 | Maturity | the expiry date | `expiryDates` |
| 21 | Upper Maturity | last curve date on or before maturity | `readRateCurve` |
| 22 | Lower Maturity | next curve date | `readRateCurve` |
| 23, 24 | Upper and Lower Forward | curve rates at rows 21 and 22 | `readRateCurve` |
| 25 | Option Type | the strike's Option Type | `StrikeSlot.optionType` |
| 26 | Valuation Date | the valuation date | `inputs.valuationDate` |
| 27 | Spot Price | spot, plus the stress bump in the Mark to Market loop | `priceBook(spotBump)` |
| 28 | Forward Growth | `'Pricing Params'!H69`: the Forward Sell Rate of the valuation month row | `forwardSellRateForMonth` |
| 29 | Discount Yield | MIN(cap, FORECAST(maturity, B23:B24, B21:B22)) | `pricerDiscountYield` |
| 30 | Dividends | SUMIF(dividends dated before maturity) ÷ spot × 365 ÷ days × `'Pricing Params'!M2` factor | `dividendYield`, `dividendMultiplier` |
| 31 | Forward | EXP(B28 × days ÷ 365) × B27 | `priceOption` |
| 32 | Volatility | bilinear lookup on the surface, or the per leg override | `interpolateVolPercent` |
| 33 | Volatility Bump | `'Pricing Params'` row on or before the expiry | `lookupVolBump` |
| 34 | Bid or Offer | surface parameter, Bid by default | `params.bidOffer` |
| 35 | Price in Rupees | Black on the forward, discounted | `bsGreeks` |
| 36 | Price as % | B35 ÷ B27 | `priceOption` |
| 38 to 41 | Incremental Margin, Cost, Cost in Rupees, Adjusted Price | B38 = IF(B34 = "B", 0, VLOOKUP(Inc. Margin)); B40 = B38 × B27 × B39 × T; B41 = B35 + B40 | `hedging-sheet.ts` |
| 43 to 46 | Full Margin, Cost, Cost in Rupees, Adjusted Price | B45 = B43 × B27 × B44 × T; B46 = B35 + B45 | `hedging-sheet.ts` |
| 47 | Spread | units: the slope change at the strike | `buildStrikes` |
| 48 | Action | IF(B55 < 0, "Sell", "Buy") | `hedging-sheet.ts` |
| 49 to 53 | Delta, Gamma, Theta, Vega, Rho | bump and reprice | `bsGreeks` |
| 55 to 62 | Contracts, Option Value, Delta, Gamma, Theta, Vega and Rho in rupees or contracts | contracts times the per option figure | `hedging-sheet.ts` |

Only live legs are shown: strikes by expiries, 36 with the defaults. The sheet's unused slots are dropped. Book totals count every leg twice, for the sheet's two identical halves.

### Which Pricing Params values the Pricer reads

| Value | Pricer row | Lookup |
|---|---|---|
| Volatility Bump | 33 | Row on or before the maturity |
| Incremental Margin | 38 | Row on or before the maturity, Offer only |
| Margin Cost | 39 and 44 | Row on or before the maturity |
| Full Margin | 43 | Row on or before the maturity |
| Forward Sell Rate | 28 | H69, the valuation month row |
| Dividend Bid or Offer Factor | 30 | M2 |
| Rate Cap While Buying Forward | 29 | N2, typed, 6.80% by default |
| Rate Cap While Selling Forward | 29 | O2 = MarketData D34 ÷ 100, the last curve point |

Rows dated before the valuation month are never looked up by a live expiry, so the app keeps only the forward grid. Implied dividends dated before the valuation date are dropped too; see below.

**H69 in the saved sheet.** Row 69 is the 29-Oct-2026 row, at 5.50%. The saved sheet had a valuation date of 04-Aug-2026 but still read row 69; its own August row is 4.45%. The app reads the valuation month row, which is row 69 itself for an October valuation. The frozen regression pins 5.50% explicitly.

**Dividends.** The sheet's SUMIF adds every implied dividend dated before maturity, including history before the valuation date. The app keeps the formula but passes only future dividends, as instructed. The frozen regression keeps the full saved list, so it still ties out.

### Black price

For forward growth g, discount r, vol σ, time T, spot S and strike K: F = S·e^{gT}, d1 = (ln(F/K) + σ²T/2) ÷ (σ√T), d2 = d1 − σ√T. Put = (K·N(−d2) − F·N(−d1))·e^{−rT}; Call = (F·N(d1) − K·N(d2))·e^{−rT}. N matches Excel `NORMDIST` to 1e-15.

### Greeks by bump and reprice

| Greek | Definition |
|---|---|
| Delta | price at S + 0.5 minus price at S − 0.5 |
| Gamma | price at S + 1 plus price at S − 1 minus twice the price at S |
| Theta | price with one day less minus price today |
| Vega | price at σ + 1% minus price at σ |
| Rho | price with g and r both up 1% minus price today |

### Volatility

`lib/engine/vol-surface.ts`. The strike axis is Deep ₹500, then each Strike Change column times the reference price of the underlying. The lookup is FORECAST across the two bracketing strike columns of the bracketing expiry row, then linear in days to the next row: bilinear within the grid. Beyond the last row the last row is held flat, and the run shows the "Expiries Beyond The Surface" warning. The volatility bump is added after dividing by 100.

Any leg's volatility can be overridden on the Pricer by typing over the Volatility cell. The override is keyed by strike and expiry (`legKey`), applies to both halves of the book, badged Overridden, and cleared by Reset.

### Rate curve

`lib/engine/rates.ts`. The curve is a list of tenors in years, set in the surface parameters. `anchoredCurve` dates each tenor from the valuation date and adds the last rate again one year after the longest maturity, so Lower Maturity always resolves. Points marked Linked To Premium Growth Rate follow the Premium Growth Rate input. The default is tenors 0, 1, 2, 3, 5, 7 and 10 years, all linked.

### Discount yield cap

`Pricer B29 = MIN(cap, FORECAST(...))`. The cap depends on the option type and the side:

| Option Type | Bid | Offer |
|---|---|---|
| Put | selling forward cap, `'Pricing Params'!O2` = the last curve rate | buying forward cap, `'Pricing Params'!N2` |
| Call | buying forward cap, N2 | selling forward cap, O2 |

### Dividend factor

`Pricer B30` multiplies the dividend yield by `'Pricing Params'!M2` for a Put on Offer and a Call on Bid, and by 1 otherwise.

## Pots, payout and the Inbuilt

| Cell | Meaning | Formula |
|---|---|---|
| Pricer E5 | Mobilisation | notional × 1e7 |
| Pricer G5, I5 | Transaction cost rate and amount | SUM(transaction, issuance, margin cost); I5 = G5 × E5 |
| Pricer V5 | Margin | E5 × Summary Q10 |
| Pricer J5 | Amount with the NBFC | E5 − H5 − I5 − V5 |
| Pricer K5 | Premium | − sum of option values |
| Pricer O5 | Maturity payout | J5(1 + L5)^(N5/365) + K5(1 + M5)^(N5/365) + V5(1 + margin growth)^(N5/365) |
| Pricer P5 | Achieved coupon | O5 ÷ E5 − 1 |
| Pricer U5 | Internal rate of return | (1 + P5)^(365/N5) − 1 |
| Pricer F5 | Actual Inbuilt | H5 ÷ E5 |

**Macro2, goal seek.** The sheet's macro sets P5 to the coupon C5 by changing H5. The engine solves the same equation with Brent's method and a bisection fallback to 1e-10, on every Run Simulation.

**Margin loop.** Summary Q10 = MTM K16 ÷ −notional: the 0% row of the stress grid. The engine iterates margin and Inbuilt until the margin moves less than 1e-9, at most 50 passes. The margin does not depend on the Inbuilt in this product, so it settles on the first pass.

## Day 1 Vega Hedge

| Cell | Meaning | Code |
|---|---|---|
| K26 | Quantity = Summary H15 × 1e7 ÷ J36: book vega over the vega of one hedge option at 0% | `hedging-sheet.ts` |
| D26 | Level = spot × (1 + move) | |
| D62 | Stressed level = spot × (1 + move) × (1 − sigmas × daily vol × √days) | |
| N26 | Fair volatility from the surface at the hedge strike and expiry, or the override | `hedgeVolOverride` |
| O26 | Fair growth: on Bid, a Put takes MAX(P26 − R26, forward sell) and a Call MIN(forward sell − 0.5%, P26 − R26) | `hedgeGrowth` |
| P26 | Discount: FORECAST on the curve, no cap | `readRateCurve` |
| R26 | Dividends at the shocked spot | `dividendYield` |
| N44, O44, P44 | Exchange block: annual vol, exchange forward and discount rates | |
| N62, O62, P62 | Stressed block: annual vol × multiplier, stressed forward and discount rates | |
| L8, M8, N8 | Initial margin = (stressed − exchange) × qty ÷ 1e7 + (fair − day 1 fair) × qty ÷ 1e7; exposure = rate × level × qty ÷ 1e7; total = L8 + M8 | |

Annual volatility = daily × √365 (`Summary I26`). Both are editable and stay in sync.

## Mark to Market and Margin Requirement

**Macro MTM.** For each move from −50 to +20% the macro sets the Pricer spot bump `J7`, reads the book delta `K7 = SUM(row 58) ÷ 1e5`, and moves on. The engine does the same in `computeHedgingSheet`: it sets `spotBump`, reprices the book, reads the delta, and resets `spotBump` to 0 in a `finally` block. The diagnostic `spotBumpAfterStress` is 0 after every run.

| Cell | Meaning |
|---|---|
| C6 | Level = start × (1 + move) |
| E6 | Product requirement in lakh = book delta at the bumped spot |
| F6, G6 | Hedge option delta in lakh; residual futures = E6 + F6 |
| H6 | Futures margin = −G6 × futures margin rate × level × 1e5 ÷ 1e7 |
| P6, I6 | Step mark to market = G7 × (C6 − C7) × 1e5 ÷ 1e7, cumulated outward from 0 at row 16 |
| J6 | Option margin = Day 1 N8 |
| K6 | Total requirement = SUM(H6:J6) |

## Product Description

### Greek Details

| Row | Label | Formula |
|---|---|---|
| H31 | Delta | Summary F15: book delta in contracts times spot over mobilisation |
| H32 | Total Delta Required | Summary E15: book delta in contracts |
| H33 | Options Quantity Required For Vega Hedge | Summary K23 × 1e5: the sold quantity, negative |
| H34 | Options Premium Received in Crore | Summary M23 |
| H35 | Options Delta | H33 × Summary M24, the hedge option delta |
| H36 | Residual Futures To Be Done | H32 − H35 |
| H37 | Weighted Average Volatility | Summary G15 |
| H38 | Vega in Crore | Summary H15 |
| H39 | Weighted Average Forward | Summary I15 |
| H40 | Rho in Crore | Summary J15 |
| H44 | Leverage | the Decay, also used in the title in C27 |
| Below H44 | Target Level | the target rise, Strike 1 less 100% |

### Payoff

For performance p, coupon C, protection P, decay D, floor performance f and floor units u (`clientReturn`):

- p ≥ −P: MIN(C, Σ participation × MIN(MAX(p − buy, 0), sell − buy)).
- −90% ≤ p < −P: MAX(−100%, MAX(f·D, p·D) + MIN(0, (p − f)·(D − u))).
- p < −90%: p.
- Pre-tax internal rate of return `L32 = RATE(D41 ÷ 365, 0, −1, 1 + K32)`.

Payoff levels are every strike, the point just below protection, zero, and every 5% between.

## Regression and live tie-outs

`tests/regression.test.ts` keeps one frozen fixture with hand-checked numbers. It does not read the saved sheet file. Because the expiry rule now gives different dates, the fixture passes explicit dates: 31-Jan-2030, 25-Apr-2030, 25-Jul-2030, 31-Oct-2030, 30-Jan-2031 and 24-Apr-2031. It also pins Forward Growth at 5.50%. The saved sheet's spot is 76,799; 76,835.78 is the surface's 100% anchor. Both give a start level of 77,300 and a hedge strike of 76,800.

| Value | Tie-out |
|---|---|
| Actual Inbuilt | 7.9499% |
| Option Premium | ₹50.67 Cr |
| Maturity Payout | ₹202.50 Cr |
| Margin | ₹32.31 Cr |
| Options Quantity Required For Vega Hedge | −12,809.67 |
| Total Delta Required | 16,880 |
| Options Premium Received | ₹4.55 Cr |
| Options Delta | 2,512 |
| Residual Futures To Be Done | 14,368 |
| Weighted Average Volatility | 7.81% |
| Vega | ₹0.54 Cr |
| Weighted Average Forward | 5.50% |
| Rho | ₹−7.09 Cr |

### Why the live run differs at spot 73,598.67

On 28-Oct-2026 the live close was 73,598.67. Round 1 gave a hedge quantity of 12,320.29 and an Inbuilt of 8.86%. The test reproduces both exactly, using Round 1's last-Thursday expiries (28-Mar-2030 to 26-Jun-2031), the October surface anchor of 71,909.70 and the full dividend list. Against the saved sheet at 76,799, everything moves:

- **Spot.** 73,598.67 against 76,799 lowers the start level to 74,100 and every rupee strike with it.
- **Surface anchor.** October's anchor of 71,909.70 replaces 76,835.78, so each Strike Change column maps to a different rupee strike and every volatility read moves.
- **Option Expiry.** The median expiry moves from 25-Jul-2030 to 26-Sep-2030 under Round 1, and to 03-Oct-2030 under the nearest-Thursday rule. The hedge vega changes with it.
- **Valuation date.** 28-Oct-2026 against 04-Aug-2026 moves the start of every leg by 85 days, and the Forward Growth row with it.

With the expiry rule and future dividends that the app now uses, the same inputs give a quantity of 12,863.31 and an Inbuilt of 8.648%. The test re-derives the chain by hand: book vega, quantity = −book vega ÷ hedge vega, premium = quantity × fair price, options delta = sold quantity × hedge delta, and residual futures = total delta − options delta. Greek Details shows the sold quantity as negative, as the sheet does.

## Invariants checked on every build

`tests/engine.test.ts` and `npm run verify:calculations`:

| Invariant | Value with the defaults |
|---|---|
| Achieved coupon equals the coupon | gap 0 |
| Option book equals the payoff at every kink | about 5e-15 |
| Spot bump after the stress grid | 0 |
| Upper and Lower Maturity resolve for every leg and hedge row | all 36 legs |
| Every input edge case blocks with a code and a fix | 10 cases |
| Sensex expiries on Thursday, Nifty on Tuesday, within 3 days of the raw date | all |
