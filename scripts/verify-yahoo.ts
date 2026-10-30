/**
 * Live Yahoo, with no mock: both closes, the session status and a year of daily volatility for each index.
 *
 *   npm run verify:yahoo
 */
import { fetchDailyVolatility, fetchLiveMarketLevels } from "../lib/market-data";

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${detail})`);
  if (!ok) failures += 1;
}

async function main() {
  const levels = await fetchLiveMarketLevels();
  check("Source", levels.source === "yahoo", String(levels.source));
  check("Sensex close", Number(levels.sensexLevel) > 10_000, `${levels.sensexLevel} as of ${levels.priceAsOfDate}`);
  check("Nifty close", Number(levels.niftyLevel) > 5_000, `${levels.niftyLevel} as of ${levels.priceAsOfDate}`);
  check("Session status", Boolean(levels.sessionPhase), String(levels.sessionPhase));
  for (const u of ["Sensex", "Nifty"] as const) {
    const v = await fetchDailyVolatility(u, 365);
    check(`${u} daily volatility`, Number(v.dailyVol) > 0.001 && Number(v.dailyVol) < 0.05, `${v.dailyVol} from ${v.observations} returns, ${v.from} to ${v.to}`);
    check(`${u} history`, v.observations >= 200, `${v.observations} returns`);
  }
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
