import type { HedgeInputs, HedgingFailure, HedgingResult, MarketData } from "@/lib/engine/types";

export type EngineRequest = { id: number; inputs: HedgeInputs; market: MarketData };
export type EngineResponse = { id: number; result?: HedgingResult | HedgingFailure; error?: string };

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (r: HedgingResult | HedgingFailure) => void; reject: (e: Error) => void }>();

function engineWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "hedging-engine" });
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.result) job.resolve(event.data.result);
      else job.reject(new Error(event.data.error ?? "The pricing engine stopped."));
    };
    worker.onerror = (event) => {
      for (const job of pending.values()) job.reject(new Error(event.message || "The pricing engine stopped."));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/**
 * Prices the book in a Web Worker, so the page never freezes during Run. Where workers are not available, such as in
 * component tests, the engine loads on demand and runs here instead.
 */
export async function priceBook(inputs: HedgeInputs, market: MarketData): Promise<HedgingResult | HedgingFailure> {
  const w = engineWorker();
  if (!w) {
    const { computeHedgingSheet } = await import("@/lib/engine/hedging-sheet");
    return computeHedgingSheet(inputs, market);
  }
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, inputs, market } satisfies EngineRequest);
  });
}
