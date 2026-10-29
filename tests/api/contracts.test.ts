import fs from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { POST as postRevalidate } from "@/app/api/admin/revalidate/route";
import { GET as getDataset } from "@/app/api/dataset/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getDailyVol } from "@/app/api/market/daily-vol/route";
import { GET as getIndexAtDate } from "@/app/api/market/index-at-date/route";
import { GET as getLevels } from "@/app/api/market/levels/route";
import { GET as getParams, POST as postParams } from "@/app/api/params/route";
import { GET as getSurface, POST as postSurface } from "@/app/api/surface/route";
import { POST as postUpload } from "@/app/api/uploads/vol-surface/route";
import { pricingParamsSchema, volSurfaceSchema } from "@/lib/db/schemas";
import { resetWriteGuard } from "@/lib/server/write-guard";
import { MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

import { startApiHarness } from "../helpers/api-harness";
import { TEST_DESK_KEY } from "../helpers/test-database";

/**
 * Every route in app/api: the happy path with its response shape checked by Zod, a bad request, and for the
 * writes a missing Desk Key and the rate limit.
 */
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

afterEach(() => {
  resetWriteGuard();
  delete process.env.DESK_WRITE_LIMIT;
});

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const keyed = (url: string, init: RequestInit) => req(url, { ...init, headers: { ...(init.headers as Record<string, string>), "x-desk-key": TEST_DESK_KEY } });

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const refusal = z.object({ error: z.string().min(1), issues: z.array(z.string()).optional() });

const SHAPES = {
  health: z.object({
    status: z.enum(["ok", "degraded"]),
    environment: z.string(),
    database: z.object({ connected: z.boolean(), name: z.string().optional() }),
    market: z.object({ source: z.string(), latestCloseDate: ymd.nullable() }),
    checkedAt: z.string(),
  }),
  dataset: z.object({ surface: volSurfaceSchema, params: pricingParamsSchema, surfaceSource: z.string(), paramsSource: z.string() }),
  levels: z.object({ sensexLevel: z.number().positive(), niftyLevel: z.number().positive(), sessionPhase: z.string(), valuationDate: ymd, source: z.string() }),
  dailyVol: z.object({ underlying: z.enum(["Nifty", "Sensex"]), windowDays: z.number().int(), dailyVol: z.number().positive(), observations: z.number().int().positive() }),
  indexAtDate: z.object({ sensexLevel: z.number().positive(), niftyLevel: z.number().positive() }),
  params: z.object({ monthKey: z.string(), params: pricingParamsSchema }),
  surface: z.object({ surface: volSurfaceSchema }),
  paramsSaved: z.object({ ok: z.literal(true), monthKey: z.string(), persisted: z.boolean() }),
  surfaceSaved: z.object({ persisted: z.boolean() }),
  uploaded: z.object({ summary: z.object({ expiries: z.number(), strikePercents: z.number(), deepAdjusted: z.number() }), surface: volSurfaceSchema, persisted: z.boolean() }),
  revalidated: z.object({ ok: z.literal(true), expired: z.array(z.string()).min(1), at: z.string() }),
};

async function shaped<T extends z.ZodTypeAny>(res: Response, shape: T, status = 200): Promise<z.infer<T>> {
  expect(res.status).toBe(status);
  const body = await res.json();
  const parsed = shape.safeParse(body);
  expect(parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  return parsed.data as z.infer<T>;
}

describe("read routes", () => {
  it("health: database and market status, 200 with no secrets", async () => {
    const res = await getHealth();
    const text = await res.clone().text();
    await shaped(res, SHAPES.health);
    expect(text).not.toMatch(/mongodb(\+srv)?:\/\/|password|DESK_WRITE_KEY/i);
  });

  it("dataset: the surface and parameters", async () => {
    await shaped(await getDataset(), SHAPES.dataset);
  });

  it("levels: both closes and the session", async () => {
    await shaped(await getLevels(), SHAPES.levels);
  });

  it("daily volatility: the shape, and 400 for an underlying it does not price", async () => {
    await shaped(await getDailyVol(req("/api/market/daily-vol?underlying=Nifty&windowDays=365")), SHAPES.dailyVol);
    await shaped(await getDailyVol(req("/api/market/daily-vol?underlying=Bitcoin&windowDays=365")), refusal, 400);
    await shaped(await getDailyVol(req("/api/market/daily-vol?windowDays=365")), refusal, 400);
  });

  it("index at date: the shape, and 400 for a bad date", async () => {
    await shaped(await getIndexAtDate(req("/api/market/index-at-date?date=2026-10-01")), SHAPES.indexAtDate);
    await shaped(await getIndexAtDate(req("/api/market/index-at-date?date=yesterday")), refusal, 400);
  });

  it("params and surface reads", async () => {
    await shaped(await getParams(), SHAPES.params);
    await shaped(await getSurface(), SHAPES.surface);
  });
});

describe("write routes", () => {
  const sampleFile = () => {
    const form = new FormData();
    form.append("file", new File([fs.readFileSync(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"))], "sample.xlsx"));
    form.append("monthKey", "2026-10");
    return form;
  };
  const writes = [
    { name: "params", call: (r: Request) => postParams(r), url: "/api/params", body: async () => JSON.stringify(await (await getParams()).json()) },
    { name: "surface", call: (r: Request) => postSurface(r), url: "/api/surface", body: async () => JSON.stringify((await (await getSurface()).json()).surface) },
    { name: "upload", call: (r: Request) => postUpload(r), url: "/api/uploads/vol-surface", body: async () => sampleFile() },
    { name: "revalidate", call: (r: Request) => postRevalidate(r), url: "/api/admin/revalidate", body: async () => "" },
  ];

  for (const w of writes) {
    it(`${w.name}: 401 without the Desk Key`, async () => {
      await shaped(await w.call(req(w.url, { method: "POST", body: await w.body() })), refusal, 401);
    });

    it(`${w.name}: 429 once the attempts run out`, async () => {
      process.env.DESK_WRITE_LIMIT = "2";
      for (let i = 0; i < 2; i++) await w.call(req(w.url, { method: "POST", body: await w.body() }));
      const res = await w.call(keyed(w.url, { method: "POST", body: await w.body() }));
      await shaped(res, refusal, 429);
      expect(res.headers.get("retry-after")).toBeTruthy();
    });
  }

  it("params: saves, and 400 for a bad body", async () => {
    const current = await (await getParams()).json();
    await shaped(await postParams(keyed("/api/params", { method: "POST", body: JSON.stringify({ params: current.params }) })), SHAPES.paramsSaved);
    await shaped(await postParams(keyed("/api/params", { method: "POST", body: "not json" })), refusal, 400);
    await shaped(await postParams(keyed("/api/params", { method: "POST", body: JSON.stringify({ params: { bidOffer: "X" } }) })), refusal, 400);
  });

  it("surface: saves, and 400 for a bad body", async () => {
    const surface = (await (await getSurface()).json()).surface;
    await shaped(await postSurface(keyed("/api/surface", { method: "POST", body: JSON.stringify(surface) })), SHAPES.surfaceSaved);
    await shaped(await postSurface(keyed("/api/surface", { method: "POST", body: "[]" })), refusal, 400);
  });

  it("upload: reads the sample Excel file, and 400 for a text file", async () => {
    await shaped(await postUpload(keyed("/api/uploads/vol-surface", { method: "POST", body: sampleFile() })), SHAPES.uploaded);
    const bad = new FormData();
    bad.append("file", new File(["plain text"], "notes.txt"));
    await shaped(await postUpload(keyed("/api/uploads/vol-surface", { method: "POST", body: bad })), refusal, 400);
  });

  it("revalidate: expires every cached read", async () => {
    await shaped(await postRevalidate(keyed("/api/admin/revalidate", { method: "POST" })), SHAPES.revalidated);
  });
});
