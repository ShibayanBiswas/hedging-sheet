import fs from "node:fs";
import path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { POST as postRevalidate } from "@/app/api/admin/revalidate/route";
import { GET as getDataset } from "@/app/api/dataset/route";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getDailyVol } from "@/app/api/market/daily-vol/route";
import { GET as getLevels } from "@/app/api/market/levels/route";
import { GET as getParams, POST as postParams } from "@/app/api/params/route";
import { GET as getSurface, POST as postSurface } from "@/app/api/surface/route";
import { POST as postUpload } from "@/app/api/uploads/vol-surface/route";
import { COLLECTIONS } from "@/lib/db/collections";
import { PRODUCTION_DB, resolveDbName, resolveMongoConfig } from "@/lib/db/config";
import { computeHedgingSheet } from "@/lib/engine/hedging-sheet";
import type { HedgeInputs } from "@/lib/engine/types";
import { resetWriteGuard } from "@/lib/server/write-guard";
import { MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

import defaults from "../fixtures/default-inputs.json";
import surfaceFixture from "../fixtures/surface.json";
import { startApiHarness } from "../helpers/api-harness";
import { seedFixtures, TEST_DESK_KEY } from "../helpers/test-database";

let harness: Awaited<ReturnType<typeof startApiHarness>>;

beforeAll(async () => {
  harness = await startApiHarness();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(new Date(MOCK_NOW_ISO));
});

afterEach(async () => {
  resetWriteGuard();
  delete process.env.DESK_WRITE_LIMIT;
  process.env.DESK_WRITE_KEY = TEST_DESK_KEY;
  await seedFixtures(harness.db);
});

afterAll(async () => {
  vi.useRealTimers();
  await harness.stop();
});

const req = (url: string, init?: RequestInit) => new Request(`http://localhost${url}`, init);
const withKey = (url: string, init: RequestInit, key = TEST_DESK_KEY) =>
  req(url, { ...init, headers: { ...(init.headers as Record<string, string>), "x-desk-key": key } });

/** Every document in every collection, as JSON, to prove nothing changed. */
async function snapshot() {
  const names = (await harness.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
  const docs = await Promise.all(names.map(async (n) => [n, await harness.db.collection(n).find({}).sort({ _id: 1 }).toArray()]));
  return JSON.stringify(docs);
}

describe("the database rejects bad documents", () => {
  it("a surface missing its grid, or with an unknown field, is refused by the $jsonSchema validator", async () => {
    const col = harness.db.collection(COLLECTIONS.volSurfaces);
    await expect(col.insertOne({ monthKey: "2027-01", label: "Broken", source: "test", updatedAt: new Date() })).rejects.toMatchObject({ code: 121 });
    await expect(col.insertOne({ ...surfaceFixture, monthKey: "2027-01", source: "test", updatedAt: new Date(), isActive: true })).rejects.toMatchObject({
      code: 121,
    });
  });

  it("parameters with a text rate or a bad Bid or Offer are refused", async () => {
    const col = harness.db.collection(COLLECTIONS.pricingParams);
    const good = (await col.findOne({}, { projection: { _id: 0 } }))!;
    await expect(col.insertOne({ ...good, monthKey: "2027-01", forwardSellRate: "5.5" })).rejects.toMatchObject({ code: 121 });
    await expect(col.insertOne({ ...good, monthKey: "2027-01", bidOffer: "X" })).rejects.toMatchObject({ code: 121 });
  });

  it("a second document for the same month is refused by the unique index", async () => {
    const col = harness.db.collection(COLLECTIONS.volSurfaces);
    await expect(col.insertOne({ ...surfaceFixture, source: "test", updatedAt: new Date() })).rejects.toMatchObject({ code: 11000 });
  });

  it("the API refuses an incomplete surface before writing anything", async () => {
    const before = await snapshot();
    const broken = { ...surfaceFixture, volsPercent: surfaceFixture.volsPercent.slice(1) };
    const res = await postSurface(withKey("/api/surface", { method: "POST", body: JSON.stringify(broken) }));
    expect(res.status).toBe(400);
    expect((await res.json()).issues.join(" ")).toMatch(/expiry needs one row/);
    expect(await snapshot()).toBe(before);
  });
});

describe("repeated saves do not create duplicates", () => {
  it("saving the same month three times leaves one surface and one parameter document", async () => {
    const surface = (await (await getSurface()).json()).surface;
    const { params } = await (await getParams()).json();
    for (let i = 0; i < 3; i++) {
      expect((await postSurface(withKey("/api/surface", { method: "POST", body: JSON.stringify(surface) }))).status).toBe(200);
      expect((await postParams(withKey("/api/params", { method: "POST", body: JSON.stringify({ params }) }))).status).toBe(200);
    }
    expect(await harness.db.collection(COLLECTIONS.volSurfaces).countDocuments({ monthKey: surface.monthKey })).toBe(1);
    expect(await harness.db.collection(COLLECTIONS.pricingParams).countDocuments({ monthKey: "2026-10" })).toBe(1);
  });

  it("uploading the same workbook twice replaces the month rather than adding one", async () => {
    const sample = fs.readFileSync(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"));
    for (let i = 0; i < 2; i++) {
      const form = new FormData();
      form.append("file", new File([sample], "sample.xlsx"));
      form.append("monthKey", "2026-10");
      expect((await postUpload(withKey("/api/uploads/vol-surface", { method: "POST", body: form }))).status).toBe(200);
    }
    expect(await harness.db.collection(COLLECTIONS.volSurfaces).countDocuments({ monthKey: "2026-10" })).toBe(1);
    const names = (await harness.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
    expect(names).toEqual([COLLECTIONS.pricingParams, COLLECTIONS.volSurfaces].sort());
  });
});

describe("upload preview", () => {
  it("parses and returns the surface without writing anything", async () => {
    const before = await snapshot();
    const sample = fs.readFileSync(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"));
    const form = new FormData();
    form.append("file", new File([sample], "sample.xlsx"));
    form.append("mode", "preview");
    const res = await postUpload(withKey("/api/uploads/vol-surface", { method: "POST", body: form }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ preview: true, persisted: false, summary: { expiries: 18, strikePercents: 20 } });
    expect(await snapshot()).toBe(before);
  });

  it("refuses a workbook over the shared 4.5 megabyte limit", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(4.6 * 1024 * 1024)], "big.xlsx"));
    expect((await postUpload(withKey("/api/uploads/vol-surface", { method: "POST", body: form }))).status).toBe(413);
  });
});

describe("a run writes nothing", () => {
  it("loading the market, the closes, the volatility and pricing the book leave the database unchanged", async () => {
    const before = await snapshot();
    const dataset = await (await getDataset()).json();
    await getLevels();
    await getDailyVol(req("/api/market/daily-vol?underlying=Sensex&windowDays=365"));
    await getHealth();
    const result = computeHedgingSheet(defaults.inputs as unknown as HedgeInputs, { surface: dataset.surface, params: dataset.params });
    expect(result.ok).toBe(true);
    expect(await snapshot()).toBe(before);
  });
});

describe("writes are protected", () => {
  const body = () => JSON.stringify(surfaceFixture);

  it("no key or a wrong key gets 401, and nothing is written", async () => {
    const before = await snapshot();
    expect((await postSurface(req("/api/surface", { method: "POST", body: body() }))).status).toBe(401);
    expect((await postSurface(withKey("/api/surface", { method: "POST", body: body() }, "wrong"))).status).toBe(401);
    expect((await postRevalidate(req("/api/admin/revalidate", { method: "POST" }))).status).toBe(401);
    expect(await snapshot()).toBe(before);
  });

  it("a deployment without a Desk Key refuses every save", async () => {
    delete process.env.DESK_WRITE_KEY;
    expect((await postSurface(withKey("/api/surface", { method: "POST", body: body() }))).status).toBe(503);
  });

  it("too many attempts get 429", async () => {
    process.env.DESK_WRITE_LIMIT = "2";
    for (let i = 0; i < 2; i++) await postSurface(withKey("/api/surface", { method: "POST", body: body() }, "wrong"));
    const res = await postSurface(withKey("/api/surface", { method: "POST", body: body() }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("an oversized body gets 413 and a text file named like a workbook gets 400", async () => {
    const big = JSON.stringify({ ...surfaceFixture, label: "x".repeat(1_100_000) });
    expect((await postSurface(withKey("/api/surface", { method: "POST", body: big }))).status).toBe(413);
    const form = new FormData();
    form.append("file", new File(["not a workbook"], "surface.xlsx"));
    expect((await postUpload(withKey("/api/uploads/vol-surface", { method: "POST", body: form }))).status).toBe(400);
  });
});

describe("environments never share the production database", () => {
  it("previews and development deployments get their own database, even if MONGODB_DB names production", () => {
    expect(resolveDbName({ VERCEL_ENV: "preview", MONGODB_DB: PRODUCTION_DB })).toBe("hedging_sheet_preview");
    expect(resolveDbName({ VERCEL_ENV: "preview" })).toBe("hedging_sheet_preview");
    expect(resolveDbName({ VERCEL_ENV: "development" })).toBe("hedging_sheet_development");
    expect(resolveMongoConfig({ VERCEL_ENV: "preview", MONGODB_HOST: "cluster.example.mongodb.net", MONGODB_DB: PRODUCTION_DB })!.uri).toContain(
      "/hedging_sheet_preview?",
    );
  });

  it("tests and mock mode never use the production name; production does", () => {
    expect(resolveDbName({ NODE_ENV: "test", MONGODB_DB: PRODUCTION_DB })).toBe("hedging_sheet_test");
    expect(resolveDbName({ TEST_MODE: "mock" })).toBe("hedging_sheet_test");
    expect(resolveDbName({ VERCEL_ENV: "production" })).toBe(PRODUCTION_DB);
    expect(resolveDbName({ VERCEL_ENV: "production", MONGODB_DB: "hedging_sheet" })).toBe(PRODUCTION_DB);
  });
});

describe("health check", () => {
  it("reports the connection, the counts and the latest close, with no secrets", async () => {
    const res = await getHealth();
    const text = await res.text();
    expect(res.status).toBe(200);
    const body = JSON.parse(text);
    expect(body.database).toMatchObject({ connected: true, name: "hedging_sheet_test", collections: { vol_surfaces: 1, pricing_params: 1 }, latestSurfaceMonth: "2026-10" });
    expect(body.market.latestCloseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(text).not.toMatch(/mongodb(\+srv)?:\/\/|password|DESK_WRITE_KEY/i);
  });
});
