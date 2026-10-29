# Sign Off: Round 10

## Release

| Item | Value |
|---|---|
| Release commit | `b076df3`, the merge of [pull request 1](https://github.com/ShibayanBiswas/hedging-sheet/pull/1): `c1da017`, `a8b962a` and `3956954` |
| Production | [hedging-sheet.vercel.app](https://hedging-sheet.vercel.app), deployment `hedging-sheet-gdk5f5qgi`, redeployed without the build cache ("Skipping build cache" in the build log) |
| Preview | `hedging-sheet-9fbu8bvjs`, on the `hedging_sheet_preview` database |
| Caches | The `surface`, `history`, `history:nifty` and `history:sensex` tags expired on production, then the Vercel CDN and data cache purged |
| Environment | `MONGODB_URI`, `MONGODB_DB` and `DESK_WRITE_KEY` set for Production and Preview; `NEXT_PUBLIC_E2E` set nowhere; `VERCEL_FORCE_NO_BUILD_CACHE` added for the one redeploy and removed |

## Tests

| Suite | Result |
|---|---|
| Vitest: unit, golden, API, component, export and copy | 299 passed in 25 files, 94.97% line coverage |
| Golden G0 | 4,497 saved workbook values match, cell by cell |
| Golden G1 to G6 | 41 checks: independent Black prices, put-call parity, the payoff at 30 levels, the solver and finite values |
| Invariants | 4 properties, 200 random products each |
| Workbook mapping | 5,821 of 5,821 formula cells mapped |
| Playwright on CI | 476 passed across Chromium, Firefox, WebKit and Pixel 7, in 4 shards |
| Playwright locally on Chromium | 206 passed against the production build |
| Visual | 24 Linux baselines, compared in CI |
| Lighthouse | Budgets passed in CI |
| `test:prod` on the preview | 28 passed |
| `test:prod` on production | 28 passed, Run only, nothing saved |
| `verify:db` on production | Read only: validators strict, unique `monthKey` indexes, no invalid documents, orphans or junk |
| `verify:db` on the preview | The empty database got its indexes and validators, then the built in reference data |

## Before And After

Measured on production with `scripts/measure-layout.ts`, Run only, at 1440 and 390 px. Before: the morning of 29-Oct-2026. After: the release above.

| Finding | Before | After |
|---|---|---|
| F7 numbers above 3 decimals | Pricer 397, Vega Hedge 497, Margin 47, Summary 2 | 0 on every tab |
| F8 Deep column | The strike 500 with its own volatility | "Deep", equal to the 55% column |
| F9 pinned columns | About one sticky cell per row on 5 tabs | 0 |
| F10 header height | 46 px, two lines | 45 px, one line; Market Data's two row header is 90 px |
| F11 Pricer grid | A 702 px box, the page scrolled and the header was lost | A box of at most min(70vh, 40rem) with a sticky header |
| F12 footer right gap | 551 to 580 px at 1440, 56 to 58 px at 390 | 24 px at 1440, 16 px at 390 |
| F13 gap under Inputs | 136 to 260 px | 24 px at 1440 and 390 |
| F14 hedge expiry role | "Option Expiry" | "Observation And Hedge Option Expiry", following the chosen expiry |
| F15 tinted backgrounds | 18 to 127 per tab | 0 |

## Bug Log

25 entries in [13 Bug Log](13-bug-log.md): F1 to F15 from the live audit and BL-01 to BL-10 from the crawls, golden tests and invariants. Each has a fix and a regression test. Two deviations from the workbook are kept on purpose: the rate curve brackets, and the expiry rule in place of typed dates.

## Carry Over C1 To C20

| # | Requirement | Verified By | Status |
|---|---|---|---|
| C1 | Tab bar, market strip, footer, command palette | Visual baselines, `buttons.spec.ts` opens the palette | Verified |
| C2 | Run gate and no persistence | `stale-result.spec.ts`, S8 reload, `database.test.ts` a run writes nothing | Verified |
| C3 | Two modes, full width switch, switching clears results | B18, `stale-result.spec.ts` | Verified |
| C4 | Required field popup focuses the first field; fetch buttons in Blank | B1, B12, production smoke | Verified |
| C5 | Capitalisation including Excel and the Atlas | `verify:copy`, `capitalisation.spec.ts`, B17 | Verified |
| C6 | B1 to B22 and D1 to D7 | Local Chromium and CI | Verified |
| C7 | axe and performance budgets | `test:a11y`, `perf.spec.ts`, Lighthouse | Verified |
| C8 | Size tokens, 12 viewports, R1 to R11 | `e2e/responsive`, `design-tokens.test.ts` | Verified |
| C9 | Zod and `$jsonSchema`, upserts, unique indexes, preview database, write secret | `verify:db`, `database.test.ts`, `contracts.test.ts`. No TTL index: every collection holds one reference document per month, so nothing expires | Verified |
| C10 | Upload, surface and parameters routes have auth and a rate limit | `contracts.test.ts` 401 and 429 on every write | Verified |
| C11 | Spacing, page ends within 24 px of the footer, compact cells | `layout.spec.ts` | Verified |
| C12 | Expiry warning inline, Market And Rates as four pairs | B5.3, B14 | Verified |
| C13 | Market Data toolbar, heat legend, edit validation, history from the valuation date | `market-data.spec.ts` | Verified |
| C14 | No icon on Compute From History, no unit on Sigmas, Days or Times | `market-data.spec.ts` | Verified |
| C15 | Full width rows, Strike Level editable both ways | S1 to S4 | Verified |
| C16 | Coupon exceeded blocks Run | S6 | Verified |
| C17 | Call Inbuilt within 0.25% of Put | G3: equal to 1e-9 | Verified |
| C18 | Neutral buttons with every state, on white | S12, `layout.spec.ts`, axe | Verified |
| C19 | Footer shows the live spot and Fetched At | D6, production smoke | Verified |
| C20 | Tables over cards, "-" for missing | `numbers.spec.ts`, B14 | Verified |

## Final Checklist

| # | User Point | Where | Done |
|---|---|---|---|
| 1 | Every workbook mapping tested end to end, any product can be hedged | [11 Workbook Mapping](11-workbook-mapping.md), golden tests | ☑ |
| 2 | Default and Blank pipeline reviewed | [12 Pipeline](12-pipeline.md), `e2e/pipeline`, the stage spy test | ☑ |
| 3 | Every number, tab, table, button, route and flow tested; bug log fixed | Crawls, `contracts.test.ts`, [13 Bug Log](13-bug-log.md) | ☑ |
| 4 | Logic Atlas at Primary SP Dashboard level, no primitives | X4, copy tests | ☑ |
| 5 | The 30.5 days text removed | X1, copy tests | ☑ |
| 6 | Inputs paragraph and workbook references removed | X2, X3, `no-reference.test.ts` | ☑ |
| 7 | Test results and artefacts cleaned and ignored | `.gitignore`, Linux only baselines | ☑ |
| 8 | At most 3 decimals, Excel included | `numbers.spec.ts`, Excel number formats test | ☑ |
| 9 | Deep equals the 55% value, no 500 | `market-data.spec.ts`, `inputs.test.ts` | ☑ |
| 10 | Everything follows the underlying and every input | `underlying.spec.ts`, `stale-result.spec.ts` | ☑ |
| 11 | Observation And Hedge Option Expiry | `expiry-role.test.ts` | ☑ |
| 12 | Pricer scrolls with a sticky header | `layout.spec.ts` | ☑ |
| 13 | All backgrounds plain white | `layout.spec.ts`, production measure | ☑ |
| 14 | Single line cells, Total Margin In Crore | `layout.spec.ts`, export test | ☑ |
| 15 | Footer fills the width | `layout.spec.ts` at 4 widths | ☑ |
| 16 | No space below Run Simulation | `layout.spec.ts` before and after Run | ☑ |
| 17 | Per strike Option Type and Buy Or Sell | `strike-matrix.spec.ts`, `structure.test.ts`, `call.test.ts` | ☑ |
| 18 | Complete suite, preview and production verified, sign off | This document | ☑ |
| 19 | No fixed columns, header sticky only | `layout.spec.ts` | ☑ |
| 20 | C1 to C20 verified | The table above | ☑ |
| 21 | Unused code removed; README, docs and scripts updated | Dead styles and the theme files removed, `lib/workbook` renamed, README and docs 01, 02, 06, 07, 08, 10 to 14 | ☑ |

## Notes

- **G2.** The product has n + 4 strikes for n spreads, so "8 strikes, 3 spreads" cannot both hold. G2 runs both 3 spreads with 7 strikes and 8 strikes with 4 spreads.
- **G4.** A product with no protection needed the protection rule relaxed from above 0% to at least 0%.
- **Preview access.** The preview is behind Vercel Authentication. `vercel curl` generated a deployment protection bypass token for the project; Playwright sends it from `VERCEL_AUTOMATION_BYPASS_SECRET` when set. It can be revoked under Deployment Protection in the project settings.
- **Packages.** Every dependency is in use; none was removed.
