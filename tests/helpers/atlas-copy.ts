import { seedMarketData } from "@/lib/engine/defaults";
import type { HedgingResult } from "@/lib/engine/types";
import type { DeskInputs } from "@/lib/inputs/draft";
import { atlasInsights, atlasOutputs, atlasStages } from "@/lib/logic-atlas";

/** Every piece of Logic Atlas copy for a run, before and after it: labels, prose and value cells. */
export function atlasCopy(r: HedgingResult): { labels: string[]; prose: string[]; cells: string[] } {
  const market = seedMarketData();
  const inputs = r.inputs as DeskInputs;
  const run = { result: r, market };
  const before = atlasStages(inputs, null, { market });
  const after = atlasStages(inputs, run, { market });
  const outputs = atlasOutputs(r);
  const insights = atlasInsights(run);
  return {
    labels: [
      ...after.flatMap((s) => [s.title, s.kind, s.rule, ...(s.lastRun ?? []).map((v) => v.label)]),
      ...outputs.flatMap((o) => [o.title, ...o.values.map((v) => v.label)]),
      ...insights.map((x) => x.title),
    ],
    prose: [...before.map((s) => s.description), ...after.map((s) => s.description), ...insights.map((x) => x.text)],
    cells: [...after.flatMap((s) => (s.lastRun ?? []).map((v) => v.value)), ...outputs.flatMap((o) => o.values.map((v) => v.value))],
  };
}
