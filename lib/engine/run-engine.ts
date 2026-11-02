import type { HedgeInputs, HedgingFailure, HedgingResult, MarketData } from "@/lib/engine/types";

export type EngineRequest = { id: number; inputs: HedgeInputs; market: MarketData };
export type EngineResponse = { id: number; result?: HedgingResult | HedgingFailure; error?: string };

/** A book prices in well under a second; past this the worker is taken as lost, so a run never hangs on Running. */
export const ENGINE_TIME_LIMIT_MS = 20_000;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (r: HedgingResult | HedgingFailure) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

/** Fails every job in flight and drops the worker, so the next run starts a fresh one. */
function stopWorker(message: string) {
  for (const job of pending.values()) {
    clearTimeout(job.timer);
    job.reject(new Error(message));
  }
  pending.clear();
  worker?.terminate();
  worker = null;
}

function engineWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "hedging-engine" });
    worker.onmessage = (event: MessageEvent<EngineResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      clearTimeout(job.timer);
      if (event.data.result) job.resolve(event.data.result);
      else job.reject(new Error(event.data.error ?? "The pricing engine stopped."));
    };
    worker.onerror = (event) => stopWorker(event.message || "The pricing engine stopped.");
    worker.onmessageerror = () => stopWorker("The pricing engine's answer could not be read.");
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
    const timer = setTimeout(() => stopWorker("The pricing engine did not answer in time."), ENGINE_TIME_LIMIT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, inputs, market } satisfies EngineRequest);
  });
}
