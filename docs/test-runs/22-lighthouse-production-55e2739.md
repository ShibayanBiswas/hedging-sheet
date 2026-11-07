# Lighthouse · Production · 55e2739

Lighthouse 12.6.1 through `lhci autorun`, against https://hedging-sheet.vercel.app (deployment `dpl_4gTZKZmZhEZ3ccvncKWTHAF4WHbj`, commit `55e2739`), 3 runs a page on Inputs (`/`) and Pricer (`/pricer`), from the Windows laptop in India. Saturday 07-Nov-2026, market closed.

**Configs:** copies of the repo's `lighthouserc.json` (desktop preset) and `lighthouserc.mobile.json` (Lighthouse's default mobile emulation: simulated slow 4G, 4x CPU slowdown), changed only so that they have no `startServerCommand` and point `collect.url` at the two production URLs. `numberOfRuns` and every assertion are unchanged.

**Laptop load:** other sessions kept this laptop saturated throughout. Cygwin's load average read about 130 at 20:34 IST and 163 at 20:56 IST, and WMI had stopped answering. Lighthouse's own `benchmarkIndex` measures the CPU once at the start of each run and stayed between 2,414 and 2,986, but contention during a run lengthens main-thread tasks, and with them TBT.

## Desktop · 20:36 To 20:47 IST · Exit 0, Every Assertion Passed

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | Best Practices | SEO | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median | CLS Range | FCP ms Median | Server Response ms Median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 3 | 96, 97, 99 | 97 | 3 | 96 | 100 | 100 | 716 | 668 to 716 | 61 | 16 to 69 | 0.000 | 0 to 0 | 520 | 31 |
| /pricer | 3 | 100, 100, 100 | 100 | 0 | 100 | 100 | 100 | 630 | 567 to 683 | 23 | 0 to 42 | 0.017 | 0.017 to 0.018 | 501 | 47 |

Accessibility on `/` is 96 in every run for one audit, `target-size`, as in the local runs in [08](08-lighthouse-6b13fdc.md).

## Mobile · 20:47 To 20:56 IST · Exit 1, Performance Below 0.90 On Both Pages

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | Best Practices | SEO | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median | CLS Range | FCP ms Median | Server Response ms Median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 3 | 80, 86, 79 | 80 | 7 | 100 | 100 | 100 | 2564 | 2441 to 2571 | 665 | 459 to 709 | 0.008 | 0.008 to 0.008 | 1320 | 38 |
| /pricer | 3 | 90, 89, 82 | 89 | 8 | 100 | 100 | 100 | 2390 | 1860 to 2484 | 426 | 328 to 646 | 0.000 | 0 to 0 | 1210 | 25 |

`lhci assert` failed `categories:performance` (minimum 0.90, median) on both URLs. Accessibility and CLS passed. The mobile config asserts no LCP; **the spec's 2 s mobile LCP target is not met**, with medians of 2,564 and 2,390 ms.

## Mobile, Second Set · 21:41 To 21:51 IST · Exit 1 Again

The same config again, once other sessions had eased off a little (Cygwin load average 57 to 78, against about 130 to 160 for the first set).

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | Best Practices | SEO | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median | CLS Range | FCP ms Median | Server Response ms Median |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 3 | 84, 93, 84 | 84 | 9 | 100 | 100 | 100 | 2486 | 2419 to 2514 | 508 | 225 to 538 | 0.008 | 0 to 0.008 | 1198 | 38 |
| /pricer | 3 | 86, 86, 88 | 86 | 2 | 100 | 100 | 100 | 2357 | 2288 to 2442 | 444 | 415 to 478 | 0.000 | 0 to 0 | 1120 | 27 |

Performance again failed on both URLs, and LCP was again over 2 s.

## Why The Mobile Score Fell: Mostly The Laptop, Not Proven

For comparison, the same configs on 04-Nov-2026 against `819e9a1`, the production before `55e2739` (superseded, kept only for this comparison), from the same laptop with the CPU at 98 to 100% but no WMI stall:

| Run | Page | Performance Median | LCP ms Median | TBT ms Median | Desktop Performance Median |
|---|---|---|---|---|---|
| 04-Nov, `819e9a1` | / | 97 (93, 98, 97) | 2,150 | 191 | 100 |
| 04-Nov, `819e9a1` | /pricer | 96 (96, 98, 96) | 2,306 | 112 | 100 |
| 07-Nov, `55e2739` | / | 80 (80, 86, 79) | 2,564 | 665 | 97 |
| 07-Nov, `55e2739` | /pricer | 89 (90, 89, 82) | 2,390 | 426 | 100 |

The pages did not get heavier, but the main thread got slower at everything:

| Measure, From The Lighthouse Reports | 04-Nov, `819e9a1` | 07-Nov, `55e2739` |
|---|---|---|
| Script transferred, `/` | 230.8 to 230.9 KB in 14 files | 231.2 to 231.3 KB in 14 files |
| Script transferred, `/pricer` | 226.2 KB in 14 files | 226.4 KB in 14 files |
| HTML, `/pricer` | 31.0 KB, 246 DOM nodes | 31.0 KB, 246 DOM nodes, the same |
| HTML, `/` | 100.1 KB, 962 DOM nodes | 101.2 KB, 974 DOM nodes |
| Main-thread HTML parsing, `/` | 23 to 25 ms | 119 to 150 ms |
| Main-thread style and layout, `/` | 259 to 390 ms | 579 to 701 ms |
| Script evaluation, `/pricer` | 526 to 683 ms | 906 to 1,129 ms |

`/pricer` serves the same HTML on both days and only 0.2 KB more script, yet its TBT went from 110 to 157 ms up to 328 to 646 ms. HTML parsing, which app code does not change, took three to six times as long. In the second set, the one run whose HTML parsing was back to normal (27 ms on `/`) also scored 93, with TBT 225 ms. All of this points mainly to CPU contention on the laptop.

It does not prove the release blameless. Script evaluation on `/pricer` stayed at 984 to 1,169 ms in every 07-Nov run, against 526 to 683 ms on 04-Nov, even in the quietest one (HTML parsing 62 ms). A back-to-back comparison of `819e9a1` and `55e2739` would settle it, but both deployment URLs answer 302 to Vercel's sign-in, and only the production alias, now `55e2739`, is open. **The mobile Performance gate for `55e2739` stays open until it is rerun on a quiet machine;** this laptop measured 80 and 89, then 84 and 86. Desktop passed every gate under the same load.

## Reports

The `lhci` filesystem reports (an HTML and a JSON per run, with `manifest.json`) are in the session scratchpad, not in the repo.
