# Totals · 05-test-local-full-6b13fdc

- **Report Folder (Gitignored, Deleted By clean:dev):** `reports/local-2026-11-03_03-37-53`
- **HEAD When Saved:** 6b13fdc
- **Note:** npm run test:local:full, E2E_PORT=3007, one worker, E2E_FULL_WIDTHS=1, PW_FULL=1.

## junit-vitest.xml

```
<testsuites name="vitest tests" tests="757" failures="0" errors="0" time="109.2881104">
```

Vitest skipped (0):

Vitest failed (0):

## junit-e2e.xml

```
<testsuites id="" name="" tests="1046" failures="7" skipped="102" errors="7" time="13547.962421">
```

## Playwright Stats (results.json)

```
{"startTime":"2026-11-02T22:11:04.695Z","duration":13547962.421,"expected":930,"skipped":102,"unexpected":14,"flaky":0}
```

| Project | Total | Passed | Failed | Flaky | Skipped By Test | Did Not Run |
|---|---|---|---|---|---|---|
| chromium | 319 | 319 | 0 | 0 | 0 | 0 |
| firefox | 229 | 189 | 5 | 0 | 35 | 0 |
| webkit | 229 | 187 | 7 | 0 | 35 | 0 |
| mobile | 229 | 195 | 2 | 0 | 32 | 0 |
| chromium-writes | 40 | 40 | 0 | 0 | 0 | 0 |

## Failed (14)

- [firefox] crawl.spec.ts › Crawl · 1280 px: Every Tab After A Run, With No Console Error, No Failed Request And No Sideways Scroll: Test timeout of 240000ms exceeded.
- [webkit] edge-cases.spec.ts › Edge · Run › Losing The Network Mid Run Prices On The Loaded Surface And Says So: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from the Workstation changes tab inside the frame, and the run survives with no reload: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › a message from any other origin, or with any other path, does nothing: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › the Workstation cannot send the frame to a path outside the app's routes: Test timeout of 90000ms exceeded.
- [webkit] embed.spec.ts › Embed navigation in SP Workstation › framed at 768 by 1024 the footer ends inside the frame, nothing clipped: Test timeout of 90000ms exceeded.
- [firefox] final-inputs.spec.ts › Final Inputs at 1280 px › Default Values: full width, no vacant space, single lines, one chip, one number and date style: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1280 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1024 px › Default Values: full width, no vacant space, single lines, one chip, one number and date style: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [firefox] final-inputs.spec.ts › Final Inputs at 1024 px › Blank Inputs: the same layout once filled; locked steps are slim rows until then: Error: overlaps  expect(received).toEqual(expected) // deep equality 
- [webkit] hydration.spec.ts › First render when the browser's IST date differs from the server's › no hydration error with the browser's clock a day ahead, and the valuation date stays the server's: Error: expect(received).toEqual(expected) // deep equality  - Expected  - 1 + Received  + 5
- [webkit] hydration.spec.ts › First render when the browser's IST date differs from the server's › no hydration error with the browser's clock a day behind, and the valuation date stays the server's: Error: expect(received).toEqual(expected) // deep equality  - Expected  - 1 + Received  + 5
- [mobile] large-surface.spec.ts › A surface over 100 rows › renders a window of rows, scrolls to the last one under a sticky header, and every cell stays on one line: Error: expect(locator).toBeVisible() failed  Locator: getByTestId('vol-grid').locator('td[data-kind="date"]').filter({ hasText: /-2039$/ }).last() Expected: visible
- [mobile] default/parity.spec.ts › Default Values parity › D5 changing one input shows Inputs Changed and the gate returns: Test timeout of 90000ms exceeded.

## Flaky (0)


## Skipped By The Test (102)

### Rule and number checks run once, on desktop Chromium. (96)

- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 each required field cleared in turn is the only field listed, is marked invalid and keeps outputs gated
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 underlying left unselected keeps the later steps locked and is listed first
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 expiryCount left unselected keeps the later steps locked and is listed first
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 spreadCount left unselected keeps the later steps locked and is listed first
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeOptionTypes.0 left unselected keeps the later steps locked and is listed first
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeSides.5 left unselected keeps the later steps locked and is listed first
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 each required field cleared in turn is the only field listed, is marked invalid and keeps outputs gated
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 underlying left unselected keeps the later steps locked and is listed first
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 expiryCount left unselected keeps the later steps locked and is listed first
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 spreadCount left unselected keeps the later steps locked and is listed first
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeOptionTypes.0 left unselected keeps the later steps locked and is listed first
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeSides.5 left unselected keeps the later steps locked and is listed first
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 each required field cleared in turn is the only field listed, is marked invalid and keeps outputs gated
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 underlying left unselected keeps the later steps locked and is listed first
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 expiryCount left unselected keeps the later steps locked and is listed first
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 spreadCount left unselected keeps the later steps locked and is listed first
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeOptionTypes.0 left unselected keeps the later steps locked and is listed first
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B2 One required field missing › B2.1 strikeSides.5 left unselected keeps the later steps locked and is listed first
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.1 text such as "abc" is flagged
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.2 "1e999" and "NaN" are flagged
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.3 negative values are flagged
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.4 zero is flagged where zero is invalid, and accepted where it is allowed
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.5 values above the maximum and below the minimum are flagged
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.6 decimals are accepted at the allowed precision; whole-number fields reject them
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.7 pasted values with thousands separators are accepted
- [firefox] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.8 a future valuation date is rejected; text that is no real date reverts with a popup
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.1 text such as "abc" is flagged
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.2 "1e999" and "NaN" are flagged
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.3 negative values are flagged
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.4 zero is flagged where zero is invalid, and accepted where it is allowed
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.5 values above the maximum and below the minimum are flagged
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.6 decimals are accepted at the allowed precision; whole-number fields reject them
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.7 pasted values with thousands separators are accepted
- [webkit] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.8 a future valuation date is rejected; text that is no real date reverts with a popup
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.1 text such as "abc" is flagged
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.2 "1e999" and "NaN" are flagged
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.3 negative values are flagged
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.4 zero is flagged where zero is invalid, and accepted where it is allowed
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.5 values above the maximum and below the minimum are flagged
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.6 decimals are accepted at the allowed precision; whole-number fields reject them
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.7 pasted values with thousands separators are accepted
- [mobile] blank/b01-b03-required-and-invalid.spec.ts › B3 Invalid values in every number field › B3.8 a future valuation date is rejected; text that is no real date reverts with a popup
- [firefox] blank/b04-b06-strikes-and-expiries.spec.ts › B4 Strikes › B4.1 strikes out of order at each adjacent pair open a popup naming both strikes
- [webkit] blank/b04-b06-strikes-and-expiries.spec.ts › B4 Strikes › B4.1 strikes out of order at each adjacent pair open a popup naming both strikes
- [mobile] blank/b04-b06-strikes-and-expiries.spec.ts › B4 Strikes › B4.1 strikes out of order at each adjacent pair open a popup naming both strikes
- [firefox] blank/b04-b06-strikes-and-expiries.spec.ts › B5 Expiries › B5.4 for each count the Pricer shows one column per strike and expiry
- [webkit] blank/b04-b06-strikes-and-expiries.spec.ts › B5 Expiries › B5.4 for each count the Pricer shows one column per strike and expiry
- [mobile] blank/b04-b06-strikes-and-expiries.spec.ts › B5 Expiries › B5.4 for each count the Pricer shows one column per strike and expiry
- [firefox] blank/b04-b06-strikes-and-expiries.spec.ts › B6 Weekday rule › B6.1 a typed date moves to the last Thursday for Sensex and the last Tuesday for Nifty
- [webkit] blank/b04-b06-strikes-and-expiries.spec.ts › B6 Weekday rule › B6.1 a typed date moves to the last Thursday for Sensex and the last Tuesday for Nifty
- [mobile] blank/b04-b06-strikes-and-expiries.spec.ts › B6 Weekday rule › B6.1 a typed date moves to the last Thursday for Sensex and the last Tuesday for Nifty
- [firefox] blank/b07-b12-terms-and-market.spec.ts › B8 Option Type › B8.1 and B8.2 each strike takes its own Option Type, the hedge stays a put, and calls replicate the put book's premium
- [webkit] blank/b07-b12-terms-and-market.spec.ts › B8 Option Type › B8.1 and B8.2 each strike takes its own Option Type, the hedge stays a put, and calls replicate the put book's premium
- [mobile] blank/b07-b12-terms-and-market.spec.ts › B8 Option Type › B8.1 and B8.2 each strike takes its own Option Type, the hedge stays a put, and calls replicate the put book's premium
- [firefox] blank/b13-b17-outputs.spec.ts › B13 Full valid fill › B13.3 typing the Default Values into Blank Inputs gives identical outputs
- [webkit] blank/b13-b17-outputs.spec.ts › B13 Full valid fill › B13.3 typing the Default Values into Blank Inputs gives identical outputs
- [mobile] blank/b13-b17-outputs.spec.ts › B13 Full valid fill › B13.3 typing the Default Values into Blank Inputs gives identical outputs
- [firefox] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 summary: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [firefox] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 pricer: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [firefox] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 product: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [firefox] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 vega-hedge: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [firefox] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 margin: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [webkit] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 summary: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [webkit] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 pricer: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [webkit] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 product: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [webkit] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 vega-hedge: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [webkit] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 margin: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [mobile] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 summary: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [mobile] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 pricer: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [mobile] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 product: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [mobile] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 vega-hedge: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [mobile] blank/b13-b17-outputs.spec.ts › B14 Output tables › B14.1 to B14.5 margin: exact tables, headers, row labels, no bad cells, "-" only where not applicable, full width, copy rules
- [firefox] blank/b13-b17-outputs.spec.ts › B17 Excel › B17.1 to B17.6 name, one sheet per tab, no pivots, headers and values match the page, no Workbook text, capitals
- [webkit] blank/b13-b17-outputs.spec.ts › B17 Excel › B17.1 to B17.6 name, one sheet per tab, no pivots, headers and values match the page, no Workbook text, capitals
- [mobile] blank/b13-b17-outputs.spec.ts › B17 Excel › B17.1 to B17.6 name, one sheet per tab, no pivots, headers and values match the page, no Workbook text, capitals
- [firefox] blank/b20-b22-mobile-themes-a11y.spec.ts › B21 White theme › B21.1 the valid fill matches the regression and every output tab passes the table checks
- [webkit] blank/b20-b22-mobile-themes-a11y.spec.ts › B21 White theme › B21.1 the valid fill matches the regression and every output tab passes the table checks
- [mobile] blank/b20-b22-mobile-themes-a11y.spec.ts › B21 White theme › B21.1 the valid fill matches the regression and every output tab passes the table checks
- [firefox] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [firefox] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [firefox] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [firefox] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [firefox] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [firefox] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks
- [webkit] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [webkit] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [webkit] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [webkit] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [webkit] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [webkit] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 summary passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 pricer passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 product passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 vega-hedge passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D3 margin passes the output table checks
- [mobile] default/parity.spec.ts › Default Values parity › D4 the Excel export passes the workbook checks

### CPU throttling needs Chrome DevTools (6)

- [firefox] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › a tab scrolled into view on the rail is still there when the page hydrates
- [firefox] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › a tab clicked on a page whose own tab starts out of view lands too
- [firefox] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › the rail stays where it was scrolled to when the page hydrates, and shows the open tab if it was not
- [webkit] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › a tab scrolled into view on the rail is still there when the page hydrates
- [webkit] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › a tab clicked on a page whose own tab starts out of view lands too
- [webkit] nav-early-click.spec.ts › A tab clicked while the page is still hydrating, at 390 px on a CPU 6 times slower › the rail stays where it was scrolled to when the page hydrates, and shows the open tab if it was not

## Did Not Run (0)


## Measured Annotations (36)

- [chromium] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [chromium] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [chromium] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [chromium] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [chromium] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [chromium] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [chromium] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [chromium] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [firefox] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.7 KB in 14 files
- [firefox] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 222.1 KB in 14 files
- [firefox] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 222.2 KB in 14 files
- [firefox] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.7 KB in 14 files
- [firefox] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.9 KB in 14 files
- [firefox] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.5 KB in 14 files
- [firefox] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 243.2 KB in 15 files
- [firefox] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 223.1 KB in 14 files
- [webkit] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.0 KB in 14 files
- [webkit] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.4 KB in 14 files
- [webkit] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.5 KB in 14 files
- [webkit] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.0 KB in 14 files
- [webkit] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.2 KB in 14 files
- [webkit] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 220.8 KB in 14 files
- [webkit] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.5 KB in 15 files
- [webkit] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.5 KB in 14 files
- [mobile] Bundle · inputs: first load JavaScript under 250 KB compressed: first load JS = 226.3 KB in 14 files
- [mobile] Bundle · summary: first load JavaScript under 250 KB compressed: first load JS = 221.7 KB in 14 files
- [mobile] Bundle · pricer: first load JavaScript under 250 KB compressed: first load JS = 221.9 KB in 14 files
- [mobile] Bundle · product: first load JavaScript under 250 KB compressed: first load JS = 224.3 KB in 14 files
- [mobile] Bundle · vega-hedge: first load JavaScript under 250 KB compressed: first load JS = 225.5 KB in 14 files
- [mobile] Bundle · margin: first load JavaScript under 250 KB compressed: first load JS = 221.1 KB in 14 files
- [mobile] Bundle · market-data: first load JavaScript under 250 KB compressed: first load JS = 242.8 KB in 15 files
- [mobile] Bundle · logic-atlas: first load JavaScript under 250 KB compressed: first load JS = 222.8 KB in 14 files
- [chromium] performance budgets › Inputs meets LCP, CLS and TBT budgets: vitals = {"lcp":196,"cls":0.00006924082647462277,"longTaskMs":0}
- [chromium] performance budgets › Pricer meets LCP, CLS and TBT budgets after a run: vitals = {"lcp":156,"cls":0,"longTaskMs":0}
- [chromium] performance budgets › a run of the default book completes in under 1.5 s, with no main thread task over 200 ms: run = {"ms":1043,"longestTaskMs":0}
- [chromium] performance budgets › a Chrome performance trace of a default run shows no main thread task over 200 ms: trace = {"ms":997,"longestTaskMs":32,"tasksOver50Ms":0,"tasks":968}
