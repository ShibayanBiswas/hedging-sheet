/// <reference lib="webworker" />
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { EngineRequest, EngineResponse } from "@/lib/engine/run-engine";

/** Pricing and the Goal Seek off the main thread, so the page keeps responding during Run. */
self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const { id, inputs, market } = event.data;
  let response: EngineResponse;
  try {
    response = { id, result: computeHedgingSheet(inputs, market) };
  } catch (err) {
    response = { id, error: err instanceof Error ? err.message : "The pricing engine stopped." };
  }
  self.postMessage(response);
};
