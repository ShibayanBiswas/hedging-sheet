import { autoHedgeStrike, DEFAULT_TERMS } from "@/lib/engine/defaults";
import { isValidYmd } from "@/lib/engine/dates";
import { snapExpiry } from "@/lib/engine/schedule";
import type { DeskInputs } from "@/lib/inputs/draft";

/**
 * Values that follow other inputs: the auto hedge strike follows the spot and the underlying's rule, a new
 * underlying moves every expiry to its own last expiry weekday of the month, and a spot arriving while the
 * Start Level Uplift is empty brings the desk's 0.6%, so the Start Level shows as soon as there is a spot.
 */
export function deriveInputs(prev: DeskInputs, next: DeskInputs): DeskInputs {
  const out = { ...next };
  if (out.underlying && out.underlying !== prev.underlying) {
    const u = out.underlying;
    out.expiryDates = out.expiryDates.map((d) => (isValidYmd(d) ? snapExpiry(d, u) : d));
    // A typed hedge strike belongs to the old index, so the new one follows its own spot.
    if (prev.underlying) out.hedgeStrikeAuto = true;
  }
  const spotArrived = Number.isFinite(out.spot) && (!Number.isFinite(prev.spot) || out.spot !== prev.spot);
  if (spotArrived && Number.isNaN(out.startLevelUplift)) out.startLevelUplift = DEFAULT_TERMS.startLevelUplift;
  if (out.hedgeStrikeAuto && out.underlying && Number.isFinite(out.spot)) out.hedgeStrike = autoHedgeStrike(out.spot, out.underlying);
  return out;
}
