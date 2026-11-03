# Lighthouse · Local · 6b13fdc

Local numbers on the Windows laptop, against `next start` with the test hook and the mock server on port 3007. Production is measured separately after the push.

Assertions in the repo (unchanged): `lighthouserc.json` Performance at least 0.90, Accessibility at least 0.95, LCP at most 2,000 ms, CLS at most 0.05, TBT at most 200 ms, all on the median of the runs. `lighthouserc.mobile.json` Performance at least 0.90, Accessibility at least 0.95, CLS at most 0.05; it asserts no LCP or TBT. Performance was already 0.90 on both, so there was nothing to raise.

## Five Runs Per Page

Commands: `E2E_PROD=1 E2E_PORT=3007 npx lhci autorun --config=lighthouserc.json` (then `lighthouserc.mobile.json`) with `--collect.numberOfRuns=5` and the two URLs on port 3007. Both exited 0, 07:45 to 08:22 IST.

**Desktop** (10 runs)

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 5 | 100, 100, 100, 100, 100 | 100 | 0 | 96 | 643 | 623 to 723 | 0 | 0 to 12 | 0.000 |
| /pricer | 5 | 100, 100, 100, 100, 100 | 100 | 0 | 100 | 606 | 599 to 610 | 0 | 0 to 14 | 0.018 |

**Mobile** (10 runs)

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 5 | 91, 90, 92, 94, 90 | 91 | 4 | 100 | 2780 | 2731 to 2889 | 249 | 174 to 261 | 0.008 |
| /pricer | 5 | 93, 95, 94, 96, 95 | 95 | 3 | 100 | 2745 | 2713 to 2778 | 119 | 91 to 186 | 0.000 |

## Three Runs Per Page, Inside npm run test:local:full

**Desktop** (6 runs)

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 3 | 100, 100, 100 | 100 | 0 | 96 | 681 | 602 to 681 | 1 | 0 to 2 | 0.000 |
| /pricer | 3 | 100, 100, 100 | 100 | 0 | 100 | 580 | 578 to 588 | 0 | 0 to 0 | 0.018 |

**Mobile** (6 runs)

| Page | Runs | Performance Each Run | Median | Spread | Accessibility | LCP ms Median | LCP Range | TBT ms Median | TBT Range | CLS Median |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 3 | 93, 94, 90 | 93 | 4 | 100 | 2811 | 2732 to 2902 | 155 | 150 to 271 | 0.008 |
| /pricer | 3 | 94, 93, 93 | 93 | 1 | 100 | 2786 | 2710 to 2800 | 183 | 152 to 193 | 0.000 |

LCP and TBT on mobile are Lighthouse's simulated slow 4G and 4x CPU slowdown. INP is a field metric and is not measured by a lab navigation run.
