# 10 · Edge Cases

Each case blocks the run and opens a popup with the message and a How To Fix line. The code is the `code` field of the validation issue. `npm run verify:edge-cases` prints every one.

| Code | When | Fix shown |
|---|---|---|
| `strike-order` | A strike is not below the one before it | Lower that strike or raise the one before it |
| `strike-positive` | A strike is zero, negative or blank | Enter it as a % of the start level |
| `spread-order` | A spread's Sell Level is not above its Buy Level | Raise the Sell Level |
| `participation` | A participation is zero or less, including a derived top participation | Enter a positive rate, or lower the other spreads |
| `coupon-unreachable` | The spreads cannot pay the Coupon | Reset the top participation to derived, raise a participation or lower the Coupon |
| `coupon-exceeded` | A typed top participation makes the spreads pay more than the Coupon. Shown under the field, with Run off and no popup | Reset the top participation to derived, or lower it |
| `strike-side` | A strike's Buy Or Sell does not match the side its units need. Shown under the strike, with Run off and no popup | Set the strike to the side named in the error |
| `protection` | The protection strike is above 100%; 0% protection, the strike at 100%, is a product with no protection | Set Protection from 0% up to below 100% |
| `floor-level` | The Decay Floor is not below protection less the outflow step | Lower the Decay Floor Level |
| `floor-units` | Decay Reduction Below Floor exceeds the Decay | Keep it at or below the Decay |
| `spread-count` | Fewer than 1 or more than 4 spreads | Use the Number Of Spreads stepper |
| `expiry-count` | Fewer than 1 or more than 12 expiries | Use the Number Of Expiry Dates stepper |
| `expiry-blank` | An expiry month is blank | Type a whole month number |
| `expiry-order` | Month numbers do not rise strictly | Enter a higher month number |
| `expiry-maturity` | An expiry falls after maturity | Lower the month or lengthen the tenor |
| `tenor` | Tenor in Days is zero or less | Enter the tenor in calendar days |
| `spot-positive`, `coupon-positive`, `decay-positive`, `notionalCr-positive`, `dailyVol-positive`, `hedgeStrike-positive` | A required number is zero or blank | Field specific |

Warnings do not block the run:

| Code | When |
|---|---|
| `expiry-surface` | An expiry falls after the last surface row; it reads the last row. Shown as a popup after the run. |
| `loss-cap` | The decayed loss reaches 100% before a 90% fall. The payoff stops at a 100% loss there while the option book keeps losing, so the two part below that level. Shown as a popup after the run. |

Market Data also validates as you type:

| Where | Rule |
|---|---|
| Surface cell | A number above 0 and at most 200 % points; otherwise a Wrong Input popup and a red outline |
| Surface Parameters | Rates between 0% and 100%; rate curve tenors at or above zero and strictly rising |

## Decisions

- **Expiries past the surface warn, not block.** The built in surface ends on 24-Apr-2031. With today's valuation date the default month 56 falls after it, so blocking would stop the default product from running.
- **No strike count against expiry count check.** It is not a pricing constraint and is not in the requested popup list.
