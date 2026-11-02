/**
 * Live-server desk check: every page returns 200 and every API answers with the right shape.
 *
 *   npm run e2e:local                       # http://localhost:3005, start `npm run dev` first
 *   BASE_URL=https://hedging-sheet.vercel.app npm run e2e:local
 *
 * Skips cleanly when the server is down. Prints names, counts and statuses only, never secrets.
 */
import { bypassTarget } from "./bypass-target";

const BASE = (process.env.BASE_URL ?? "http://localhost:3005").replace(/\/$/, "");
const bypass = bypassTarget(BASE) === "trusted" ? process.env.VERCEL_AUTOMATION_BYPASS_SECRET : undefined;
const get = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}) } });
const PAGES = ["/", "/summary", "/pricer", "/product", "/vega-hedge", "/margin", "/market-data", "/logic-atlas"];
const PHASES = ["pre_open", "open", "closed", "holiday_or_weekend"];

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  try {
    await get(BASE, { cache: "no-store" });
  } catch {
    console.log(`SKIP  ${BASE} is not reachable. Start the app with npm run dev, or set BASE_URL.`);
    return;
  }
  console.log(`Checking ${BASE}`);
  for (const page of PAGES) {
    const res = await get(`${BASE}${page}`, { cache: "no-store" });
    check(`Page ${page}`, res.status === 200, String(res.status));
  }

  const levels = (await (await get(`${BASE}/api/market/levels`, { cache: "no-store" })).json()) as Record<string, unknown>;
  check("Levels source", levels.source === "yahoo", String(levels.source));
  check("Levels market status", PHASES.includes(String(levels.sessionPhase)), String(levels.sessionPhase));
  check("Levels Nifty and Sensex", Number(levels.niftyLevel) > 0 && Number(levels.sensexLevel) > 0, `${levels.niftyLevel} and ${levels.sensexLevel}`);

  const dataset = (await (await get(`${BASE}/api/dataset`, { cache: "no-store" })).json()) as {
    surface?: { label?: string; expiries?: unknown[] };
    params?: { bidOffer?: string };
    surfaceSource?: string;
  };
  check("Dataset surface", (dataset.surface?.expiries?.length ?? 0) > 0, `${dataset.surface?.label} from ${dataset.surfaceSource}`);
  check("Dataset Bid or Offer", dataset.params?.bidOffer === "B" || dataset.params?.bidOffer === "O", String(dataset.params?.bidOffer));

  const params = (await (await get(`${BASE}/api/params`, { cache: "no-store" })).json()) as { source?: string; monthKey?: string | null };
  check("Surface parameters", Boolean(params.source), `${params.source}${params.monthKey ? ` for ${params.monthKey}` : ""}`);

  const vol = (await (await get(`${BASE}/api/market/daily-vol?underlying=Sensex&days=365`, { cache: "no-store" })).json()) as { dailyVol?: number };
  check("Daily volatility", Number(vol.dailyVol) > 0, String(vol.dailyVol));

  const sample = await get(`${BASE}/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx`, { cache: "no-store" });
  check("Sample file", sample.status === 200, String(sample.status));

  console.log(failures ? `${failures} check${failures === 1 ? "" : "s"} failed` : "All checks passed");
  if (failures) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
