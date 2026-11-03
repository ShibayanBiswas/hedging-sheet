# Bundle · 6b13fdc

`npm run bundle:report` after the `next build` of `npm run test:local:full`, 08:22 IST, exit 0:

```
/market-data    210.7 KB gzipped    692.8 KB raw   13 files
/               206.7 KB gzipped    679.0 KB raw   13 files
/vega-hedge     205.9 KB gzipped    678.1 KB raw   13 files
/product        204.7 KB gzipped    675.4 KB raw   13 files
/logic-atlas    202.9 KB gzipped    671.1 KB raw   13 files
/pricer         202.3 KB gzipped    667.4 KB raw   13 files
/summary        202.1 KB gzipped    667.3 KB raw   13 files
/margin         201.5 KB gzipped    665.7 KB raw   13 files
Largest 210.7 KB of 250.0 KB
```

The Playwright gate `e2e/bundle.spec.ts` measures what the browser downloads, headers included, so its numbers run higher: 221.1 to 242.8 KB, every tab under 250 KB, the same on all 5 repeats (see `07-perf-and-bundle-x5-6b13fdc/totals.md`).
