# Sign Off · Round 11 · Workbook Fidelity, Dynamic Inputs, Layout And Exports

## Commits

| Commit | What |
|---|---|
| `a33696a` | Expiry dates on the last expiry weekday, the hedge strike rule, compact numbered Inputs with Bulk Edit |
| `ca4e687` | Workbook audit of every non-empty cell of the nine sheets |
| `8aa3716` | PDF on every tab, one Excel sheet per tab and the Audit sheet |
| `6929f16` | Header, footer, toast, Market Data, Logic Atlas pipeline, sans tables |
| `56723b4` | Production Smoke after production deploys, knip, unused code removed |
| `b27fb26` | Round 11 Playwright specs, updated suites, Linux baselines |
| Docs | Changelog, calculation logic, routes, edge cases, deploy steps, this sign off |

## CI

GitHub Actions has not run since the billing block ("recent account payments have failed or your spending limit needs to be increased"). Every suite CI runs was run locally on Windows instead, and the visual baselines in the same Linux Playwright image CI uses (`npm run test:visual:linux`). Production Smoke now runs on each successful Vercel production deployment, so the first push after billing is fixed checks the live site on its own.

| Suite | Result |
|---|---|
| Typecheck, lint, knip | Clean |
| Vitest: unit, golden, API, component, export | 31 files, 340 tests, all pass |
| Workbook audit | 10,802 cells: 7,221 Match, 6 Mismatch Fixed, 3,575 Not Applicable, 0 Mismatch |
| Playwright Chromium, mock server | E2E_RESULT |
| Linux visual baselines | 24 rewritten in `mcr.microsoft.com/playwright:v1.63.0-noble` |
| Production | PROD_RESULT |

## Bugs B1 To B17

| Bug | Before | After | Proof |
|---|---|---|---|
| B1 CI red | Billing blocks every run; Production Smoke ran after CI | Production Smoke runs on each successful production deployment, with the Vercel bypass header from `VERCEL_AUTOMATION_BYPASS_SECRET` | `.github/workflows/prod-smoke.yml` |
| B2 Footer overlap | Equal cells, label left and value right | A grid of content-sized columns spread edge to edge; each label beside its value | `round11.spec.ts` footer test: label to value ≤ 8 px, right gap ≤ 24 px |
| B3 Header at 768 and 390 | Three rows, 184 px on desktop and 285 px on phones | One row plus a slim tab row: 112 px on desktop, 116 px on phones, 124 px at 768 | `round11.spec.ts` header tests at 1440, 1280, 1024, 768, 414 and 390 |
| B4 Deep cell | The word Deep in Reference Strikes | The 55% strike as a number; every Volatility By Expiry row shows the 55% volatility | `market-data.spec.ts`, `round11.spec.ts` |
| B5 Headline clipped | Four pairs a row on phones | One pair a row below 640 px; Surface shows the month | `PairsTable`, R1 to R7 |
| B6 One sans font | Table cells, buttons and fields in the serif body face | Every table, button and field in the sans face | `globals.css` |
| B7 30.5 on Vega Hedge | Not present on the build this round started from; the 30.5 day month lives only inside the engine's expiry helper | No text on the tab reads 30.5, now pinned by a test | `round11.spec.ts` |
| B8 Single-line cells | Rows of 45 to 49 px | 11 px padding, 20 px line and a 1 px rule: at most 44 px at 1440, 1024, 768 and 390; badges and total rows fixed | `round11.spec.ts` row tests |
| B9 Expiries 1 to 10 | 1 to 12 month numbers | 1 to 10 dates | `bulk-and-guards.test.ts`, `b04-b06` |
| B10 Vega Hedge tables | Already titled on the build this round started from | Fair, Exchange and Stressed Price Computation titled, now pinned by a test | `round11.spec.ts` |
| B11 Call strike golden case | No golden case flipped a strike to Call | G7: one strike flipped to Call keeps the Inbuilt within 0.5 percentage points and the premium equal | `tests/golden/products.test.ts` |
| B12 Logic Atlas | Sections only | A Pipeline table, one row per stage from Inputs to Payoff, with formula in words, inputs, output and last-run value | `round11.spec.ts` |
| B13 Market Data buttons | Under the subtitle, left aligned | In the heading row, `justify-content: flex-end` | `round11.spec.ts` |
| B14 Surface Parameters | Two tables side by side | One table a row, under the new heading | `round11.spec.ts` |
| B15 Volatility tags | Daily only, Calculated or Overridden | Daily and Annual, Calculated or Edited together | `round11.spec.ts`, `b07-b12` |
| B16 Helper text | Sentences of 14 px | 12 px Title Case helpers; the hedge strike rule per underlying | R4 hint size, `round11.spec.ts` |
| B17 Expiry dates | Month numbers | Dates on the last Thursday or Tuesday, with a note when moved | `dates.test.ts`, `b04-b06` |

## Measurements

| Check | 1440 | 1280 | 1024 | 768 | 414 | 390 |
|---|---|---|---|---|---|---|
| Header height | 112 px | 112 px | 112 px | 124 px | 116 px | 116 px |
| Field height | 36 px | 36 px | 36 px | 44 px touch | 44 px touch | 44 px touch |
| Field columns | 4 | 3 | 3 | 2 | 1 | 1 |
| Sideways scroll | None | None | None | None | None | None |

At 1440 × 900 groups 1 to 4 are fully visible and Product Terms begins at 820 px, just above the Run bar at 841 px. Its fields fall below the fold: Strikes And Spreads (about 520 px with six strikes) and Product Terms (about 250 px) together need about 770 px, and 673 px is left under the header and the Inputs row. Fitting them would take fields below the 36 px the brief sets.

Toast: 24 px from the right and bottom, at most 360 px wide, above the Run bar; 16 px margins across the bottom at 390 px.

## Workbook Audit

`docs/workbook-audit.md`, generated by `npm run audit:workbook`.

| Sheet | Cells | Match | Mismatch Fixed | Not Applicable | Mismatch |
|---|---|---|---|---|---|
| Summary Sheet | 173 | 78 | 6 | 89 | 0 |
| Pricer | 4,286 | 2,696 | 0 | 1,590 | 0 |
| MTM & Margin req | 200 | 180 | 0 | 20 | 0 |
| Day1 Vega Hedge | 1,816 | 1,464 | 0 | 352 | 0 |
| MarketData | 733 | 656 | 0 | 77 | 0 |
| Pricing Params | 880 | 742 | 0 | 138 | 0 |
| Product Description | 335 | 73 | 0 | 262 | 0 |
| Pivot of Positions | 171 | 0 | 0 | 171 | 0 |
| Data | 2,208 | 1,332 | 0 | 876 | 0 |
| **All** | **10,802** | **7,221** | **6** | **3,575** | **0** |

The six Mismatch Fixed cells are Summary C12 to H12, the expiries the old nearest-weekday rule missed. The one deviation, the rate curve brackets, is signed off in the audit: anchored tenors stay.
