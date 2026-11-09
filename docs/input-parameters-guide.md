# Input Parameters Guide

Every field on the Inputs tab: what it means, its default, the rule it must pass, how Blank Inputs and Default Values differ, and where the engine reads it. Defaults live in `lib/engine/defaults.ts` (`DEFAULT_TERMS`, `defaultInputs`); the rules in `lib/validation/inputRules.ts`; the values that follow other inputs in `lib/inputs/derive.ts` (`deriveInputs`). Workbook cells refer to the reference workbooks (`fixtures/reference/reference-workbook.xlsm`, the August 2026 Sensex approval, and `fixtures/reference/nifty-rollover-workbook.xlsm`, the 17-Jul-2026 Nifty rollover). The UI never shows sheet names.

Inputs are never stored. Results appear only after Run Simulation. Every number shows at most 3 decimals, a missing value shows "-", and dates show as 05-Nov-2026.

## Modes

| Mode | Start state |
|---|---|
| Default Values | Sensex, today's India date or the last close, the live Yahoo close, the 365 day calculated daily volatility and every desk term below. |
| Blank Inputs | Every field empty: numbers blank, dates and choices unset. Steps unlock in order: Observation Expiries once Underlying and Valuation Date are in, Strikes And Spreads once every expiry is in, the rest once every strike is in (`unlockedSteps`). |

Switching mode asks first, then clears the inputs and the last run. An edit that breaks a field's range is reverted with a popup naming the allowed range (`checkFieldEdit`).

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

## Where Each Value Flows

`components/inputs/input-sections.tsx` edits `DeskInputs` through `setInputs`, which runs `deriveInputs`. Run Simulation validates with `validateDeskInputs`, refreshes the market (`/api/dataset`) and prices in a Web Worker with `computeHedgingSheet` on `forwardMarket(market, valuationDate)`. The goal seek on the Inbuilt is `brentSolve`. The tests are `tests/unit/blank-autofill.test.ts`, `tests/golden/g0-workbook.test.ts` and `tests/golden/g1-nifty-rollover.test.ts`.
