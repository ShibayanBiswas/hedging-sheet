# Region Trial · Skipped · Previews Are Protected

The idea: deploy the same code as a **preview** with its functions in `bom1` (Mumbai, next to the Atlas cluster in AP_SOUTH_1), compare `/api/health` and page TTFB with production in `iad1`, then delete the preview. Production, aliases, environment variables and project settings were not to be touched, and no bypass secret was to be added.

## 04-Nov-2026: A bom1 Preview Was Built, But Could Not Be Reached

- `npx vercel deploy --target preview --regions bom1 --scope shibayan-biswas-projects --yes`, from a clean `git archive` of `819e9a1` with only `.vercel/project.json` added, so no local file or secret was uploaded. It built in 40 s and was Ready at 14:21 IST: `hedging-sheet-69jd3iy3v-shibayan-biswas-projects.vercel.app`, `dpl_GAFG7NTcoa9mLH58kGm8MiPWL27J`, target preview, with every function in `[bom1]` by `vercel inspect`, and no alias.
- The deploy output listed `deploymentProtection: ["vercel_authentication"]`. Without a session, `/` and `/api/health` both answered **302 to `vercel.com/sso-api`**. `vercel curl` relies on a protection bypass (its help reads "automatic protection bypass" and offers `--protection-bypass <SECRET>`), so it was not used.
- The preview was removed with `npx vercel rm https://hedging-sheet-69jd3iy3v-shibayan-biswas-projects.vercel.app --scope shibayan-biswas-projects --yes`; afterwards it answered 404, and production was the same deployment, Ready.
- Its build ran `scripts/db-deploy-setup.ts`, which checks indexes and validators on the preview database, `hedging_sheet_preview`, never on `hedging_sheet`.

## 07-Nov-2026: Not Tried Again

An existing preview, `hedging-sheet-q7whqmpjs-shibayan-biswas-projects.vercel.app`, still answers `/api/health` with 302 to `vercel.com/sso-api`, so previews are still behind Vercel Authentication. No preview was deployed.

To run the trial, the owner can either let previews of this project be reached, or set `VERCEL_AUTOMATION_BYPASS_SECRET` in `.env.local`, which `npm run test:vercel` and `scripts/bypass-target.ts` already know how to send to this project's previews.

## Production Alone · 55e2739 · 07-Nov-2026, 21:07 To 21:08 IST

Ten requests a path, one new connection each, from the laptop in India. "After TLS" leaves out DNS, TCP and TLS. Every response came through `bom1::iad1`, Vercel's Mumbai edge to the function in Washington, with `x-vercel-cache: MISS`.

| Path | Status | TTFB Median | TTFB Range | After TLS Median | After TLS Range |
|---|---|---|---|---|---|
| `/api/health` | 200 × 10 | 1,671 ms | 583 to 2,882 ms | 1,483 ms | 457 to 2,538 ms |
| `/` | 200 × 10 | 480 ms | 348 to 619 ms | 330 ms | 264 to 433 ms |
| `/pricer` | 200 × 10 | 418 ms | 351 to 733 ms | 276 ms | 241 to 322 ms |

`/api/health` in order: 2,808, 1,848, 2,882, 1,829, 2,811, 1,513, 874, 839, 683 and 583 ms. On `55e2739` it reads both `hedging_sheet` and `unwinding_calculator` in Mumbai from `iad1` and asks Yahoo for the close, so each round trip to the database crosses from Washington to Mumbai; the first five were the slowest. On 04-Nov, on `819e9a1`, the same check had a median of 679 ms.
