# Input Parameters Guide

Every field on the Inputs tab: what it means, its default, the rule it must pass, how Blank Inputs and Default Values differ, and where the engine reads it. Defaults live in `lib/engine/defaults.ts` (`DEFAULT_TERMS`, `defaultInputs`); the rules in `lib/validation/inputRules.ts`; the values that follow other inputs in `lib/inputs/derive.ts` (`deriveInputs`). Workbook cells refer to the reference workbooks (`fixtures/reference/reference-workbook.xlsm`, the August 2026 Sensex approval, and `fixtures/reference/nifty-rollover-workbook.xlsm`, the 17-Jul-2026 Nifty rollover). The UI never shows sheet names.

Inputs are never stored. Results appear only after Run Simulation. Every number shows at most 3 decimals, a missing value shows "-", and dates show as 05-Nov-2026.

## Modes

| Mode | Start state |
|---|---|
| Default Values | Sensex, today's India date or the last close, the live Yahoo close, the 365 day calculated daily volatility and every desk term below. |
| Blank Inputs | Every field empty: numbers blank, dates and choices unset. Steps unlock in order: Observation Expiries once Underlying and Valuation Date are in, Strikes And Spreads once every expiry is in, the rest once every strike is in (`unlockedSteps`). |

Switching mode asks first, then clears the inputs and the last run, and every correction note. A value that breaks a rule is corrected, not refused: see [Corrections](#corrections-what-a-bad-entry-becomes).

## 1 · Underlying And Market

| Field | Meaning | Default | Rule | Blank Inputs | Used in |
|---|---|---|---|---|---|
| Underlying | Nifty or Sensex | Sensex | Required | Empty until picked. Picking one moves every expiry to that index's last expiry weekday (Nifty last Tuesday, Sensex last Thursday) | Index labels, expiry weekday, hedge strike rule, the surface anchor (`referencePriceForUnderlying`) |
| Valuation Date | The trade date | Today in India, or the last close date | Required, a real date, not in the future | Empty; typed as 05-Nov-2026, 2026-11-05 or 05-11-2026, always shown as 05-Nov-2026 | Summary C2; every day count, the forward grid month (`forwardMarket`), default expiries |
| Spot | The index close | The live Yahoo close of the chosen index | Above 0, at most 1,000,000 | Empty; type it or press Fetch. Shown grouped, such as 23,960.60 | Summary C3 and D3 (one spot: the derived spot equals it), Pricer B2 and B27, Day1 Vega Hedge C2 |
| Fetch | Fills the spot with the latest Yahoo close of the chosen underlying | Default Values refreshes with the circular button instead | Needs the underlying first | Fills Spot, then Hedge Strike, Start Level and Fetched At | `/api/market/levels` |
| Hedge Strike | Strike of the Day 1 vega hedge | Auto: Nifty `ceil((spot + 150) / 100) × 100`; Sensex `ceil(spot × 1.006 / 100) × 100`. Nifty 23,960.60 gives 24,200 | Above 0, a multiple of 100 | Fills itself once Underlying and Spot are in; typing one turns Auto off (tag Edited), the Auto toggle turns it back on (tag Calculated) | `autoHedgeStrike`; Summary H23, Day1 Vega Hedge C3 |
| Start Level | The 100% level of every strike | Calculated | Read only | Shows as soon as there is a spot: the spot arriving fills the Start Level Uplift with 0.6% when it is empty | `startLevel`: Pricer B5 = ROUNDUP(spot × (1 + uplift), −2). The workbooks define it for Sensex; the same rule serves Nifty, so Nifty 24,264.86 gives 24,500 as the Nifty workbook does |
| Fetched At | When the spot on the page was fetched, India time, such as 12:16 am IST | Calculated | Read only | Shows after Fetch, and goes back to "-" once the spot is typed instead | `spotFetchedAt` in the desk provider |

## 2 · Observation Expiries

| Field | Meaning | Default | Rule | Blank Inputs | Used in |
|---|---|---|---|---|---|
| Number Of Expiry Dates | Observation dates of the product | 6 | 1 to 10 | Empty until picked | `expiryCount` |
| Expiry 1 to n | Final expiries | The last expiry weekday of the months 41, 44, 47, 50, 53 and 56 after the valuation date, the Summary H3 to M3 helpers | After the valuation date, strictly rising; each snaps to its month's last expiry weekday | Empty; Quarterly From First Expiry or Monthly From First Expiry fills the rest from the first, three months or one month apart | `defaultExpiryDates`, `snapExpiry`, `validateSchedule`; Summary C12 to I12 |
| Hedge Option Expiry | Expiry of the Day 1 vega hedge | The median expiry | One of the expiries | Median until picked | `medianExpiryIndex`; Summary D15, Day1 Vega Hedge C4 |

## 3 · Strikes And Spreads

| Field | Meaning | Default | Rule | Blank Inputs | Used in |
|---|---|---|---|---|---|
| Number Of Spreads | Upside spreads; strikes are spreads plus 4 | 2 (6 strikes) | 1 to 6 | Empty until picked | `setSpreadCount`, `deriveTerms` |
| Level % | Each strike as a % of the Start Level | 137, 127, 125, 85, 84, 70. The Nifty workbook case is 137, 136, 125, 85, 84, 70; the app keeps its own product defaults | Above 0, at most 500, strictly falling | Empty | Pricer row 17; Summary G23 to G28 |
| Level In Points | The rupee strike | Calculated | Typing a level sets the Level % to 4 decimals | Shows once the Start Level and the Level % are in, tagged Calculated | `rupeeStrike`: Pricer B19 = ROUND(B5 × B17%, 0) |
| Option Type | Put or Call per strike | Put | Required | Unset | Pricer row 25; a call strike carries a futures leg |
| Buy Or Sell | Side per strike | Follows the payoff (`derivedSides`) | Must match the payoff | Unset; a wrong side shows an inline error | Pricer row 48 |
| Units | Units per strike, negative where the book sells | Calculated | Read only | Shows once every Level % and the Start Level are in, tagged Calculated. A Coupon, Decay or Decay Reduction Below Floor not entered yet reads as the Default Values term until it is entered (`tableUnits`) | `strikeUnits`: Pricer row 47 |
| Spread Participation Rate | Participation of each spread | 1 for lower spreads; the top spread is derived | Above 0, at most 100 | Lower spreads empty; the top is derived and tagged Calculated, Reset To Calculated brings it back | Summary K10, L10 = (D10 − (H10 − G10) × K10) ÷ (J10 − I10) |
| Spreads Pays | What each spread pays | Calculated | The total must equal the Coupon | Calculated | Pricer C13 and C14 |

## 4 · Rates

| Field | Meaning | Default | Rule | Used in |
|---|---|---|---|---|
| NBFC Rate | Funding rate | 8% | 0% to 100% | Summary C4, Pricer NBFC amount |
| Premium Growth Rate | Rate the premium grows at; linked curve points follow it | 6.5% (workbooks: the Pricing Params forward sell rate plus 1%, 7.6% in the Nifty case) | 0% to 100% | Summary C5, the rate curve's linked points, the selling forward cap |
| Margin Growth Rate | Growth of the margin cash | 6.579% | 0% to 100% | Summary C6, Summary Q10 |

## 5 · Product Terms

| Field | Meaning | Default | Rule | Used in |
|---|---|---|---|---|
| Coupon | Maximum upside | 102.5% | Above 0%, at most 1000% | Summary D10 |
| Decay | Loss multiple below protection | 1.6 | Above 0, at most 10 | Summary N10 |
| Decay Reduction Below Floor | Units removed below the floor | 1 | 0 to 10, at most the Decay | Pricer row 47 floor leg |
| Protection | From the protection strike | 15% | 0% to below 100% | Summary M10 |
| Decay Floor Level | From the floor strike | 70% | Read only | Pricer AP17 |
| Tenor In Days | Product life | 1,940 | 1 to 3,650, whole days | Summary O10, IRR |
| Start Level Uplift | Uplift on the spot for the Start Level | 0.6% | 0% to 10% | Pricer B5. Blank Inputs fill it with 0.6% when the spot arrives and it is empty |
| Notional In Crore | Product size | 100 | Above 0 | Summary C15, Pricer E5, MTM ladder |

## 6 · Volatility

| Field | Meaning | Default | Rule | Used in |
|---|---|---|---|---|
| Daily Volatility | Daily volatility of the index | Calculated from 365 days of Yahoo closes; 0.9% when history fails | Above 0%, at most 10% | Summary I25; annual = daily × √365 (`annualVolFromDaily`), Summary I26, Day1 Vega Hedge F2 and F3 |
| History Window | Days of history for the calculation | 365 | A window the desk picks | `/api/market/daily-vol` |
| Leg and hedge volatility overrides | Typed on the Pricer and Day 1 Vega Hedge tabs | The surface volatility plus the bump | Above 0 | `interpolateVolPercent`, Pricer row 32 |

## 7 · Margin And Desk Terms

| Field | Meaning | Default | Rule | Used in |
|---|---|---|---|---|
| Transaction Cost | Product cost | 2.25% | 0% to 20% | Summary C18, Pricer B8 |
| Issuance Cost | Product cost | 0.13% | 0% to 20% | Summary D18, Pricer B9 |
| Margin Cost | Product cost | 0% | 0% to 20% | Summary E18, Pricer B10 |
| Exposure Margin | On the hedge's notional | 5% | 0% to 100% | Day1 Vega Hedge M6 |
| Futures Margin | On the residual futures | 20% | 0% to 100% | MTM & Margin req H2 |
| Exchange Forward And Discount Rates | The exchange price of the hedge | 3.48% each | 0% to 100% | Day1 Vega Hedge I2 and I3 |
| Stressed Forward And Discount Rates | The stressed price of the hedge | 3.48% each | 0% to 100% | Day1 Vega Hedge L2 and L3 |
| Shock Sigmas, Shock Days, Volatility Multiplier | The stress move | 6, 2 and 1.25 | Sigmas 0 to 20, days 1 to 30, multiplier 0 to 10 | Day1 Vega Hedge stressed price |

## Corrections: What A Bad Entry Becomes

A value that breaks a rule is corrected when it is committed, on leaving the field or Enter, to the nearest valid value, or to its Default Values value where nothing is nearer. A note under the field says what it became, such as "Lowered To The Decay, 1.60", and stays until that field is edited again. Only the field being committed changes: a rule across fields corrects the one just typed, never another the desk typed. No popup opens and Run Simulation is never refused for a value it can correct. It works the same in Default Values and Blank Inputs and in both books. The rules live in `lib/validation/corrections.ts`.

Run Simulation first corrects whatever is still broken across fields, such as a Buy Or Sell the payoff no longer gives once Product Terms are in, on the field each rule names (`correctForRun`), notes it, then runs. Blank Inputs stay blank: an empty field is never filled.

Not corrected, and still refused:

| Case | What happens |
|---|---|
| An empty required field in Blank Inputs | Run Simulation lists it in the Missing Or Invalid Inputs popup |
| Text that is no number, such as "abc", "1e999" or "NaN" | The field goes back to its last value with a "… Reverted" popup |
| Text that is no date, such as 30-Feb-2026 | The date goes back to its last value with a "… Reverted" popup |
| Underlying, the Number Of Expiry Dates, Spreads or Legs, Option Type, a leg's Buy Or Sell | Picked from a list, so nothing can break; Run lists any left unpicked |

### Every Number Against Its Own Range

The ranges are the rules in each section above (`numberFieldRules`). In order:

| Rule | Corrected to | Note |
|---|---|---|
| Below zero, on a field that only makes sense positive: Spot, Hedge Strike, Coupon, Decay, Tenor In Days, Notional In Crore, Daily and Annual Volatility, Shock Sigmas, Shock Days, Volatility Multiplier, a strike, a participation, a leg's Level % and Quantity | Its absolute value, a sign typo | Made Positive, 76,835.78 |
| A decimal in a whole number field: Tenor In Days, Shock Days | Rounded to the nearest whole number | Rounded To A Whole Number, 1,940 |
| A Hedge Strike off its 100 steps | The nearest multiple of 100 | Rounded To The Nearest 100, 77,400 |
| Above the field's maximum | The maximum | Lowered To The Maximum, 100.000% |
| Below 0% on a field where 0% is allowed: the rates, costs, margins, Start Level Uplift and Decay Reduction Below Floor | 0, its minimum | Raised To The Minimum, 0.000% |
| Zero, or below the minimum after the steps above, on a positive-only field | The Default Values value: Coupon 102.500%, Decay 1.60, Tenor 1,940, Notional 100.00, Daily Volatility 0.900%, Shock Sigmas 6, Shock Days 2, Volatility Multiplier 1.25, a participation 1.00, a leg's Level 100.000% and Quantity 1.00 | Set To The Default, 102.500% |
| A Spot of zero | The last close of the underlying, when it has arrived | Set To The Last Close, 76,835.78 |
| A Hedge Strike of zero | The auto hedge strike from the Spot | Set To The Auto Hedge Strike, 77,300 |
| A zero with nothing to fall back on, such as a Spot before any close | The field keeps what it had | Kept, It Must Be Above Zero, 76,835.78 |

### Rules Across Fields

| Field committed | Rule | Corrected to | Note |
|---|---|---|---|
| Valuation Date | Not after today | Today | Moved To Today, 28-Oct-2026 |
| Valuation Date | Before Expiry 1 | The day before Expiry 1 | Moved Before Expiry 1, 27-Mar-2030 |
| Expiry n | On its month's last expiry weekday, Thursday for Sensex and Tuesday for Nifty | That day | Moved To The Last Thursday, 25-Apr-2030 |
| Expiry n | After the Valuation Date and after Expiry n − 1 | The first expiry after it | Moved After Expiry 1, 25-Apr-2030; Moved After The Valuation Date, 29-Oct-2026 |
| Expiry n | Before Expiry n + 1 | The last expiry before it | Moved Before Expiry 3, 29-Aug-2030 |
| Expiry n | On or before the maturity, Valuation Date plus Tenor In Days | The last expiry on or before it | Moved Before The Maturity, 29-Jan-2032 |
| Expiry n | No expiry month left between its neighbours | It keeps what it had | Kept, No Expiry Month Between Expiry 1 And Expiry 3 |
| Tenor In Days | Long enough to reach the last expiry | The days from the Valuation Date to it | Raised To Reach Expiry 6, 1,737 |
| Strike n (Product Payoff) | Strictly below Strike n − 1 and above Strike n + 1 | One point inside the neighbour it crossed, or the middle of a gap narrower than a point | Lowered Below Strike 1, 136.000%; Raised Above Strike 3, 126.000% |
| Strike n | No room between its neighbours | It keeps what it had | Kept, No Room Between Strike 1 And Strike 3, 127.000% |
| Strike n | Zero | Its role's Default Values level when that fits: target 137, protection 85, outflow 84, floor 70; else as above | Set To The Default, 70.000% |
| Protection strike, Strike n + 2 | At most 100%, so Protection is at least 0% | 100% | Lowered To Zero Protection, 100.000% |
| Target Rise | Strike 1 above Strike 2 | As Strike 1 | Raised Above Strike 2, 28.000% |
| Protection | 0% to below 100%; the protection strike below the lowest spread level and the outflow strike above the floor | The nearest Protection that keeps every strike in order, one point inside | Lowered To Keep The Strikes In Order, 28.000%; Raised To The Minimum, 0.000% |
| Decay Floor Level | Below the outflow strike and above zero | As the floor strike | Lowered Below Strike 5, 83.000% |
| Lower spread Participation Rate | Leaves the Calculated top spread a share of the Coupon | The most that does, to 2 decimals | Lowered To Leave Room For The Top Spread, 51.24 |
| Lower spread Participation Rate, with the top spread typed | The spreads pay the Coupon exactly | The value that does | Set To Reach The Coupon Exactly, 1.00 |
| Top spread Participation Rate | The spreads pay the Coupon exactly | Back to Calculated | Back To Calculated, 10.05 |
| Coupon | Above what the lower spreads pay, so the Calculated top spread keeps a share | The smallest Coupon above it, in 0.001% steps | Raised Above What The Lower Spreads Pay, 2.001% |
| Coupon, with the top spread typed | What the spreads pay | That | Set To What The Spreads Pay, 82.000% |
| Decay Reduction Below Floor | At most the Decay | The Decay | Lowered To The Decay, 1.60 |
| Decay | At least the Decay Reduction Below Floor | The Decay Reduction Below Floor | Raised To The Decay Reduction Below Floor, 1.00 |
| Buy Or Sell, once every strike and term is in | The side the payoff needs | That side | Set To Sell, The Payoff Needs It |

**Why strikes are clamped and not re-sorted.** The Product Payoff reads its strikes by position: Strike 1 is the target, then the spread levels, then protection, outflow and floor. Sorting a typed strike into place would hand it another row's role, so the payoff would change in a way the desk did not type. Clamping keeps the row's role and moves the level the least. One point is the step the desk's own levels use, 85 and 84 for protection and outflow.

**At Run Simulation.** Whatever is still broken is corrected on the field the rule names: a strike out of order on the lower strike of the pair, a Coupon the Calculated top spread cannot reach on the Coupon, one a typed top spread misses on the top spread (back to Calculated), a Buy Or Sell on its strike, an expiry past the maturity on the expiry. A Custom Option Book has no order between its legs and none of the product's rules: only each leg's own range applies.

## Where Each Value Flows

`components/inputs/input-sections.tsx` edits `DeskInputs` through `setInputs`, which runs `deriveInputs`. Run Simulation validates with `validateDeskInputs`, refreshes the market (`/api/dataset`) and prices in a Web Worker with `computeHedgingSheet` on `forwardMarket(market, valuationDate)`. The goal seek on the Inbuilt is `brentSolve`. The tests are `tests/unit/blank-autofill.test.ts`, `tests/golden/g0-workbook.test.ts` and `tests/golden/g1-nifty-rollover.test.ts`.
