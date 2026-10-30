import type { DeskInputs } from "@/lib/inputs/draft";

/**
 * The keys a run is matched on. A different inputs key makes the last run stale on every tab; overrides are made on
 * the output tabs, so they are keyed apart and only bring up the stale banner.
 */
export function splitKeys(inputs: DeskInputs): { inputsKey: string; overridesKey: string } {
  const { legVolOverrides, hedgeVolOverride, ...rest } = inputs;
  return { inputsKey: JSON.stringify(rest), overridesKey: JSON.stringify({ legVolOverrides, hedgeVolOverride }) };
}
