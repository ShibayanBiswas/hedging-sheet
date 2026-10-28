# 10 · Edge Cases

Each case blocks the run and opens a popup with the message and a How To Fix line. The code is the `code` field of the validation issue. `npm run verify:edge-cases` prints every one.

| Code | When | Fix shown |
|---|---|---|
| `strike-order` | A strike is not below the one before it | Lower that strike or raise the one before it |
| `strike-positive` | A strike is zero, negative or blank | Enter it as a % of the start level |
| `spread-order` | A spread's Sell Level is not above its Buy Level | Raise the Sell Level |
| `spread-overlap`, `spread-gap` | A spread does not start where the one below ends | Set its Buy Level to the lower spread's Sell Level |
| `participation` | A participation is zero or less, including a derived top participation | Enter a positive rate, or lower the other spreads |
| `coupon-unreachable` | The spreads cannot pay the Coupon | Reset the top participation to derived, raise a participation or lower the Coupon |
| `protection` | The protection strike is not below 100% | Set Protection between 0% and 100% |
| `floor-level` | The Decay Floor is not below protection less the outflow step | Lower the Decay Floor Level |
| `floor-units` | Floor Units exceed the Decay | Keep Floor Units at or below the Decay |
| `spread-count` | Fewer than 1 or more than 4 spreads | Use the Number Of Spreads stepper |
| `expiry-count` | Fewer than 1 or more than 8 expiries | Use the Number Of Expiry Dates stepper |
| `expiry-blank` | An expiry month is blank | Type a whole month number |
| `expiry-order` | Month numbers do not rise strictly | Enter a higher month number |
| `expiry-maturity` | An expiry falls after maturity | Lower the month or lengthen the tenor |
| `tenor` | Tenor in Days is zero or less | Enter the tenor in calendar days |
| `spot-positive`, `coupon-positive`, `decay-positive`, `notionalCr-positive`, `dailyVol-positive`, `hedgeStrike-positive` | A required number is zero or blank | Field specific |

Warnings do not block the run:

| Code | When |
|---|---|
| `expiry-surface` | An expiry falls after the last surface row; it reads the last row. Shown as a popup after the run. |
| `coupon-capped` | The spreads pay more than the Coupon; the payoff is capped. |

Market Data also validates as you type:

| Where | Rule |
|---|---|
| Surface cell | A number above 0 and at most 200 % points; otherwise a Wrong Input popup and a red outline |
| Surface Parameters | Rates between 0% and 100%; rate curve tenors at or above zero and strictly rising |

## Decisions

- **Expiries past the surface warn, not block.** The built in surface ends on 24-Apr-2031. With today's valuation date the default month 56 falls after it, so blocking would stop the default product from running.
- **No strike count against expiry count check.** It is not a pricing constraint and is not in the requested popup list.
