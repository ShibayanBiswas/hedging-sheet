import fs from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as getDataset } from "@/app/api/dataset/route";
import { GET as getDailyVol } from "@/app/api/market/daily-vol/route";
import { GET as getIndexAtDate } from "@/app/api/market/index-at-date/route";
import { GET as getLevels } from "@/app/api/market/levels/route";
import { GET as getParams, POST as postParams } from "@/app/api/params/route";
import { GET as getSurface, POST as postSurface } from "@/app/api/surface/route";
import { POST as postUpload } from "@/app/api/uploads/vol-surface/route";
import { MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

import defaults from "../fixtures/default-inputs.json";
import { startApiHarness } from "../helpers/api-harness";
import { TEST_DESK_KEY } from "../helpers/test-database";

let harness: Awaited<ReturnType<typeof startApiHarness>>;

beforeAll(async () => {
  harness = await startApiHarness();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(new Date(MOCK_NOW_ISO));
});

afterAll(async () => {
  vi.useRealTimers();
  await harness.stop();
});

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const writeReq = (url: string, init: RequestInit) => req(url, { ...init, headers: { ...(init.headers as Record<string, string>), "x-desk-key": TEST_DESK_KEY } });

describe("market routes with Yahoo mocked by MSW", () => {
  it("levels: the last completed closes and the session status", async () => {
    const body = await (await getLevels()).json();
    expect(body).toMatchObject({ sensexLevel: 76835.78, niftyLevel: 23500, sessionPhase: "open", valuationDate: "2026-10-28", source: "yahoo" });
  });

  it("daily volatility: one year of log returns", async () => {
    const res = await getDailyVol(req("/api/market/daily-vol?underlying=Sensex&windowDays=365"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.dailyVol).toBeCloseTo(defaults.inputs.dailyVol, 12);
    expect(body.observations).toBe(defaults.dailyVolObservations);
  });

  it("index at date: closes on or before the date, and a 400 for a bad date", async () => {
    const ok = await (await getIndexAtDate(req("/api/market/index-at-date?date=2026-10-01"))).json();
    expect(ok.sensexLevel).toBeGreaterThan(0);
    expect(ok.niftyLevel).toBeGreaterThan(0);
    expect((await getIndexAtDate(req("/api/market/index-at-date?date=01-10-2026"))).status).toBe(400);
  });
});

describe("data routes on an in-memory Mongo", () => {
  it("dataset: the seeded October surface and parameters from the database", async () => {
    const body = await (await getDataset()).json();
    expect(body.surfaceSource).toBe("database");
    expect(body.paramsSource).toBe("database");
    expect(body.surface.label).toBe("October 2026 Volatility Surface");
    expect(body.params.bidOffer).toBe("B");
  });

  it("params: saves per month, writes the scalars to the forward grid, and rejects bad bodies", async () => {
    const current = await (await getParams()).json();
    expect(current.monthKey).toBe("2026-10");
    const grid = { volBump: 0.001, incMargin: 0.06, fullMargin: 0.12, marginCost: 0.03, fwdSellRate: 0.056 };
    const res = await postParams(writeReq("/api/params", { method: "POST", body: JSON.stringify({ params: { ...current.params, rateCapBuyingForward: 0.069 }, grid }) }),
    );
    const saved = await res.json();
    expect(res.status).toBe(200);
    expect(saved).toMatchObject({ ok: true, monthKey: "2026-10", persisted: true });
    const reread = await (await getParams()).json();
    expect(reread.params.rateCapBuyingForward).toBe(0.069);
    const surface = (await (await getSurface()).json()).surface;
    const october = surface.pricingParams.find((p: { date: string }) => p.date.startsWith("2026-10"));
    expect(october).toMatchObject(grid);
    const history = surface.pricingParams.find((p: { date: string }) => p.date.startsWith("2026-08"));
    expect(history.fwdSellRate).not.toBe(0.056);
    expect((await postParams(writeReq("/api/params", { method: "POST", body: "{}" }))).status).toBe(400);
    expect((await postParams(writeReq("/api/params", { method: "POST", body: JSON.stringify({ params: current.params, grid: { volBump: 2 } }) }))).status).toBe(400);
  });

  it("surface: saves an edited grid and rejects an empty one", async () => {
    const surface = (await (await getSurface()).json()).surface;
    surface.volsPercent[0][1] = 42.42;
    const saved = await (await postSurface(writeReq("/api/surface", { method: "POST", body: JSON.stringify(surface) }))).json();
    expect(saved.persisted).toBe(true);
    expect((await (await getSurface()).json()).surface.volsPercent[0][1]).toBe(42.42);
    expect((await postSurface(writeReq("/api/surface", { method: "POST", body: JSON.stringify({ expiries: [] }) }))).status).toBe(400);
  });

  it("upload: reads the sample file and replaces the surface; refuses text", async () => {
    const sample = fs.readFileSync(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"));
    const form = new FormData();
    form.append("file", new File([sample], "sample.xlsx"));
    form.append("monthKey", "2026-10");
    const res = await postUpload(writeReq("/api/uploads/vol-surface", { method: "POST", body: form }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary).toEqual({ expiries: 18, strikePercents: 20 });
    expect(body.persisted).toBe(true);
    const bad = new FormData();
    bad.append("file", new File(["not a workbook"], "notes.txt"));
    expect((await postUpload(writeReq("/api/uploads/vol-surface", { method: "POST", body: bad }))).status).toBe(400);
  });
});
