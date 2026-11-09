# 10 · Edge Cases

The engine refuses to price any of these, with the message and a How To Fix line; the code is the `code` field of the validation issue, and `npm run verify:edge-cases` prints every one. On the Inputs tab the rules marked Corrected never reach it: a value that breaks one is corrected as it is committed, or by Run Simulation, with a note under its field and no popup ([Input Parameters Guide](input-parameters-guide.md#corrections-what-a-bad-entry-becomes)). The others block the run with a popup.

| Code | When | Fix shown |
|---|---|---|
| `strike-order` | A strike is not below the one before it. This also keeps every Sell Level above its Buy Level and the Decay Floor below the outflow strike. Corrected | Lower that strike or raise the one before it |
| `strike-positive` | A strike is zero, negative or blank. Corrected, except a blank one | Enter it as a % of the start level |
| `participation` | A participation is zero or less, including a derived top participation. Corrected | Enter a positive rate, or lower the other spreads |
| `coupon-unreachable` | The spreads cannot pay the Coupon. Corrected | Reset the top participation to derived, raise a participation or lower the Coupon |
| `coupon-exceeded` | A typed top participation makes the spreads pay more than the Coupon. Corrected: the top spread goes back to Calculated | Reset the top participation to derived, or lower it |
| `strike-side` | A strike's Buy Or Sell does not match the side its units need. Corrected; until Run it shows under the strike, with no popup | Set the strike to the side named in the error |
| `protection` | The protection strike is above 100%; 0% protection, the strike at 100%, is a product with no protection. Corrected | Set Protection from 0% up to below 100% |
| `floor-units` | Decay Reduction Below Floor exceeds the Decay. Corrected | Keep it at or below the Decay |
| `spread-count` | Fewer than 1 or more than 6 spreads | Use the Number Of Spreads stepper |
| `goal-seek` | No Inbuilt pays the Coupon, or the one that does lies outside -100% to 100% of the notional. The popup is titled Could Not Solve | Lower the Coupon or check the growth rates |
| `expiry-count` | Fewer than 1 or more than 10 expiries | Pick the Number Of Expiry Dates from 1 to 10 |
| `expiry-blank` | An expiry date is blank | Type a date; it moves to the last expiry weekday of its month |
| `expiry-order` | An expiry does not fall after the one before. Corrected | Pick a later month |
| `expiry-maturity` | An expiry falls after maturity. Corrected | Lower the month or lengthen the tenor |
| `tenor` | Tenor in Days is zero or less | Enter the tenor in calendar days |
| `spot-positive`, `coupon-positive`, `decay-positive`, `notionalCr-positive`, `dailyVol-positive`, `hedgeStrike-positive` | A required number is zero or blank | Field specific |

Warnings do not block the run:

| Code | When |
|---|---|
| `expiry-surface` | An expiry falls before the first or after the last surface row; it reads that row. Shown as a popup after the run. |
| `loss-cap` | The decayed loss reaches 100% before a 90% fall. The payoff stops at a 100% loss there while the option book keeps losing, so the two part below that level. Shown as a popup after the run. |

Market Data also validates as you type:

| Where | Rule |
|---|---|
| Surface cell | A number above 0 and at most 200 % points; otherwise a Wrong Input popup and a red outline |
| Surface Parameters | Rates between 0% and 100%; rate curve tenors at or above zero and strictly rising |

## Decisions

- **Expiries past the surface warn, not block.** The built in surface ends on 24-Apr-2031. With today's valuation date the default month 56 falls after it, so blocking would stop the default product from running.
- **No strike count against expiry count check.** It is not a pricing constraint and is not in the requested popup list.
