import { afterEach, describe, expect, it, vi } from "vitest";

import type { EngineRequest } from "@/lib/engine/run-engine";

import { fixtureInputs } from "../helpers/fixture";
import { seedMarketData } from "@/lib/engine/defaults";

type Handler = ((event: { data: unknown; message?: string }) => void) | null;

/** A stand-in Worker that answers the way the test says, or never. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static answer: "result" | "error" | "silent" | "crash" | "unreadable" = "result";
  onmessage: Handler = null;
  onerror: Handler = null;
  onmessageerror: Handler = null;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(request: EngineRequest) {
    const mode = FakeWorker.answer;
    queueMicrotask(() => {
      if (mode === "result") this.onmessage?.({ data: { id: request.id, result: { ok: false, errors: [], warnings: [] } } });
      if (mode === "error") this.onmessage?.({ data: { id: request.id, error: "Engine failed." } });
      if (mode === "crash") this.onerror?.({ data: null, message: "" });
      if (mode === "unreadable") this.onmessageerror?.({ data: null });
    });
  }
  terminate() {
    this.terminated = true;
  }
}

async function load() {
  vi.resetModules();
  vi.stubGlobal("Worker", FakeWorker);
  return import("@/lib/engine/run-engine");
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

describe("pricing in the worker", () => {
  const args = () => [fixtureInputs(), seedMarketData()] as const;

  it("returns the worker's answer, and reuses one worker", async () => {
    const { priceBook } = await load();
    FakeWorker.answer = "result";
    await expect(priceBook(...args())).resolves.toMatchObject({ ok: false });
    await priceBook(...args());
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("rejects with the engine's message when it reports an error", async () => {
    const { priceBook } = await load();
    FakeWorker.answer = "error";
    await expect(priceBook(...args())).rejects.toThrow("Engine failed.");
  });

  it("a crash or an unreadable answer stops the worker, and the next run starts a fresh one", async () => {
    const { priceBook } = await load();
    FakeWorker.answer = "crash";
    await expect(priceBook(...args())).rejects.toThrow("The pricing engine stopped.");
    expect(FakeWorker.instances[0]!.terminated).toBe(true);
    FakeWorker.answer = "unreadable";
    await expect(priceBook(...args())).rejects.toThrow("The pricing engine's answer could not be read.");
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("a worker that never answers is given up after the time limit, so Run never hangs", async () => {
    const { priceBook, ENGINE_TIME_LIMIT_MS } = await load();
    vi.useFakeTimers();
    FakeWorker.answer = "silent";
    const run = priceBook(...args());
    const check = expect(run).rejects.toThrow("The pricing engine did not answer in time.");
    await vi.advanceTimersByTimeAsync(ENGINE_TIME_LIMIT_MS);
    await check;
    expect(FakeWorker.instances[0]!.terminated).toBe(true);
  });

  it("prices on the page where workers are not available", async () => {
    vi.resetModules();
    const { priceBook } = await import("@/lib/engine/run-engine");
    const r = await priceBook(...args());
    expect(r.ok).toBe(true);
  });
});
