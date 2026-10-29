# Bug Log

Every defect found by the live audit of 29-Oct-2026 and by the crawls, golden tests and invariants of this round. Each fix has a regression test; the test fails on the old code.

| ID | Page | Steps | Expected | Actual | Fix | Regression Test |
|---|---|---|---|---|---|---|
| F1 | Inputs | Open Inputs, read the Strikes card | No subtitle | "Strikes as a % of the start level, highest first. Units are the change in slope…" | Subtitle removed | `tests/copy/no-reference.test.ts` removed text, `e2e/strikes.spec.ts` S13 |
| F2 | Inputs | Read each strike row | Strike, Level %, Level In Points, Option Type, Buy Or Sell, Remove | Role labels such as "Protection Outflow Step" and "Units -10.05 Sell" chips | Strike rows rebuilt; roles and unit chips removed | `tests/copy/no-reference.test.ts`, `e2e/strike-matrix.spec.ts` |
| F3 | Inputs | Read the spreads section | "Spreads", with Buy Level, Sell Level and Participation | "Spreads And Option Type", with the option type on the spread | Option type moved to each strike | `tests/structure.test.ts`, `tests/copy/no-reference.test.ts` |
| F4 | Inputs, Logic Atlas | Search for "30.5" | Absent | The month rule text with 30.5 days | Removed | `tests/copy/no-reference.test.ts` |
| F5 | Logic Atlas | Open the Atlas | No primitives table, no "sheet" or "Macro" | Computation Primitives with 9 rows | Atlas rewritten | `tests/copy/no-reference.test.ts` |
| F6 | Summary, Product, Pricer, Atlas | Crawl the copy | No wording about the spreadsheet the app replaced | "sheet", "Source Sheet And Row", "Workbook Seed" and code identifiers | Copy reworded, `lib/workbook` renamed `lib/excel`, a copy rule added | `tests/copy/no-reference.test.ts`, `e2e/copy-rules.spec.ts` |
| F7 | Pricer, Vega Hedge, Margin, Summary | Run, read every number | At most 3 decimals | 397, 497, 47 and 2 numbers with more | Formats capped at 3 decimals in the page and in Excel | `e2e/numbers.spec.ts`, `tests/export/export.test.ts` number formats |
| F8 | Market Data | Read the Deep column | "Deep", the 55% volatility | The strike 500 and its own volatility | Deep equals the 55% column; uploads normalised with a message | `tests/unit/inputs.test.ts` Deep, `e2e/market-data.spec.ts` |
| F9 | Every table | Scroll a table sideways | No pinned column | The first column pinned | Sticky columns removed | `e2e/layout.spec.ts` |
| F10 | Every table | Read the headers | One line | Headers on 2 lines, 46 px | Every th and td on one line; "Total Margin In Crore" with a tooltip | `e2e/layout.spec.ts` |
| F11 | Pricer | Scroll the Pricer grid at 900 px tall | The grid scrolls in its own box, header kept | A 702 px box; the page scrolled and the header was lost | Long tables capped at min(70vh, 40rem), header sticky | `e2e/layout.spec.ts` long tables |
| F12 | Footer | Measure the footer's right edge | At most 24 px blank | 580 px at 1440, 58 px at 390 | Footer grid fills the width | `e2e/layout.spec.ts` at 1440, 1024, 768 and 390 |
| F13 | Inputs | Measure the gap above the footer | At most 24 px | 136 px | Spacer removed | `e2e/layout.spec.ts` before and after Run |
| F14 | Summary, Excel | Read the expiry roles | The hedge expiry is also observed | "Option Expiry" alone | "Observation And Hedge Option Expiry", following the chosen Option Expiry | `tests/unit/expiry-role.test.ts` |
| F15 | Every page | Read every background | Plain white | 18 to 127 tinted elements per page | White surfaces, neutral control fills | `e2e/layout.spec.ts` backgrounds |
| BL-01 | Inputs | Set the protection strike to 100% for a product with no protection | Prices | "The protection strike must sit below 100%" | Protection of 0 allowed | `tests/golden/products.test.ts` G4 |
| BL-02 | Every output | Decay 1.12, Decay Reduction Below Floor 0, floor 67%, then Run | A warning that the payoff stops at a 100% loss while the option book keeps losing | No warning; the book lost 100.0001% where the payoff paid -100% | Warning `loss-cap`, shown as a popup after Run | `tests/golden/invariants.test.ts`, `tests/copy/no-reference.test.ts` |
| BL-03 | Logic Atlas | Run, change the underlying, open the Atlas | No values until Run | The old run's values | The Atlas reads only a current run | `e2e/pipeline/stale-result.spec.ts` |
| BL-04 | Header | Run, change an input, press Download Excel | Disabled until Run | Downloaded the old run | Disabled while the inputs differ | `e2e/pipeline/stale-result.spec.ts` |
| BL-05 | API | `GET /api/market/daily-vol?underlying=Bitcoin` | 400 | 200 with the Sensex history | Unknown underlyings refused | `tests/api/contracts.test.ts` |
| BL-06 | Inputs, Footer, Market Data | Read the component sources | Underlying names from one place | "Nifty" and "Sensex" typed in 5 components | `lib/underlyings.ts` | `e2e/pipeline/no-hardcoded-underlying.spec.ts` |
| BL-07 | Product | Open the payoff at 390 px | Each level on one line | "37.00% Target" on 3 lines | The badges no longer wrap | `e2e/layout.spec.ts` single line |
| BL-08 | Every page | axe colour contrast | At least 4.5 to 1 | Gold text 3.25 to 1, the Ctrl K hint 4.43 to 1 | Darker gold and hint text | `e2e/a11y.spec.ts` |
| BL-09 | Market Data | axe, keyboard | A scrolling table can take focus | The headline table scrolled with no focus | The pairs table frame takes focus | `e2e/a11y.spec.ts` |
| BL-10 | Logic Atlas | Read the page outline | One level 1 heading, as every other page has | The title "Logic Atlas" was a level 2 heading, so the page had none | The title is the level 1 heading | `e2e/buttons.spec.ts` waits for each page's level 1 heading |

## Deviations Kept On Purpose

| Workbook | App | Why |
|---|---|---|
| Rate curve brackets carry fixed 2025 dates: Pricer rows 21 to 24, Day1 Vega Hedge columns AE to AH | Each tenor is anchored at the trade date | A curve fixed to 2025 goes stale; the discount yield it feeds is the Premium Rate in both, and every price matches |
| Typed expiry dates | The expiry rule | G0 passes the typed dates so the two can be compared |
