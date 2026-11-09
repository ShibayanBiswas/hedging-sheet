import { readFileSync } from "node:fs";

import { MongoClient, type Db } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDataset } from "@/app/api/dataset/route";
import { POST as postSurface } from "@/app/api/surface/route";
import { COLLECTIONS } from "@/lib/db/collections";
import { resolveUnwindingDbName } from "@/lib/db/config";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";
import type { VolSurface } from "@/lib/engine/types";
import { normalizeVolSurface } from "@/lib/engine/vol-surface";
import { resetWriteGuard } from "@/lib/server/write-guard";
import { fetchIndexAtDate } from "@/lib/market-data";
import { MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

import unwindingOctober from "../fixtures/unwinding-surface-october.json";
import fixtureSurface from "../fixtures/surface.json";
import { startApiHarness } from "../helpers/api-harness";
import { seedFixtures, TEST_DESK_KEY } from "../helpers/test-database";

/** The Unwinding Calculator's live October 2026 document, its seed, field for field. */
const UNWINDING = unwindingOctober as VolSurface;
const grid = (s: VolSurface) => {
  const n = normalizeVolSurface(s);
  return { expiries: n.expiries, moneyness: n.moneyness, strikes: n.strikes, volsPercent: n.volsPercent, nifty: n.referenceUnderlyingPrice, sensex: n.referenceSensexPrice };
};

let harness: Awaited<ReturnType<typeof startApiHarness>>;
let client: MongoClient;
let unwinding: Db;
/** The Yahoo closes on or before 1-Oct-2026: the month's Reference Prices, whatever the surface itself carries. */
let anchors: Awaited<ReturnType<typeof fetchIndexAtDate>>;
const anchored = (s: VolSurface) => ({ ...grid(s), nifty: anchors.niftyLevel, sensex: anchors.sensexLevel });

beforeAll(async () => {
  harness = await startApiHarness();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
  vi.setSystemTime(new Date(MOCK_NOW_ISO));
  anchors = await fetchIndexAtDate("2026-10-01");
  client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  unwinding = client.db(resolveUnwindingDbName());
});

afterAll(async () => {
  vi.useRealTimers();
  await client.close();
  await harness.stop();
});

beforeEach(async () => {
  resetWriteGuard();
  await seedFixtures(harness.db);
  await unwinding.collection(COLLECTIONS.volSurfaces).deleteMany({});
  await unwinding.collection(COLLECTIONS.volSurfaces).insertOne({ ...UNWINDING, isActive: true, source: "Vol Surface for Oct26.xlsx", updatedAt: new Date() });
});

describe("Shared Surface · The Unwinding Calculator's Active Surface Is The Desk Surface", () => {
  it("Tests Read A Database Of Their Own, Never The Live One", () => {
    expect(resolveUnwindingDbName()).toBe("unwinding_calculator_test");
    expect(resolveUnwindingDbName({ MONGODB_DB: "hedging_sheet" })).toBe("unwinding_calculator");
    expect(resolveUnwindingDbName({ MONGODB_DB: "hedging_sheet", VERCEL_ENV: "preview" })).toBe("unwinding_calculator_preview");
  });

  it("Prices On The Unwinding Grid And Anchors, With This Desk's Pricing Params Grid", async () => {
    const body = await (await getDataset()).json();
    expect(body.surfaceSource).toBe("shared");
    // The grid is Unwinding's; the Reference Prices are Yahoo's closes for the 1st, not the ones the document carries.
    expect(anchors.sensexLevel).not.toBe(UNWINDING.referenceSensexPrice);
    expect(grid(body.surface)).toEqual(anchored(UNWINDING));
    expect(body.surface.deepStrike).toBe(500);
    expect(body.surface.volsPercent.every((row: number[]) => row[0] === row[1])).toBe(true);
    expect(body.surface.pricingParams).toEqual(normalizeVolSurface(fixtureSurface as VolSurface).pricingParams);
  });

  it("Mirrors The Shared Grid Into The Desk Database", async () => {
    await getDataset();
    const mirrored = await harness.db.collection(COLLECTIONS.volSurfaces).findOne({ monthKey: "2026-10" });
    expect(mirrored?.source).toBe("unwinding 2026-10");
    expect(grid(mirrored as unknown as VolSurface)).toEqual(anchored(UNWINDING));
  });

  it("An Edited Grid Becomes The Unwinding Calculator's Active Surface Too", async () => {
    const { surface } = await (await getDataset()).json();
    const edited = { ...surface, volsPercent: surface.volsPercent.map((row: number[]) => row.map((v) => v + 1)) };
    const res = await postSurface(new Request("http://localhost/api/surface", { method: "POST", body: JSON.stringify(edited), headers: { "x-desk-key": TEST_DESK_KEY } }));
    expect(res.status).toBe(200);
    const docs = await unwinding.collection(COLLECTIONS.volSurfaces).find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0]!.isActive).toBe(true);
    expect(grid(docs[0] as unknown as VolSurface)).toEqual(grid(edited));
    expect(docs[0]!.pricingParams).toEqual(UNWINDING.pricingParams);
    expect(grid((await (await getDataset()).json()).surface)).toEqual(grid(edited));
  });

  it("Without An Unwinding Surface The Desk Month Document Is Used", async () => {
    await unwinding.collection(COLLECTIONS.volSurfaces).deleteMany({});
    const body = await (await getDataset()).json();
    expect(body.surfaceSource).toBe("database");
    expect(grid(body.surface)).toEqual(anchored(fixtureSurface as VolSurface));
  });

  it("One File Feeds Both Desks: The Unwinding Upload Sample Parses To Its Active Grid", () => {
    const bytes = readFileSync("tests/fixtures/unwinding-vol-surface-october.xlsx");
    const parsed = parseVolSurfaceFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "2026-10");
    // The sample stores each volatility to 4 decimals; the uploaded October file carries full precision.
    const { volsPercent, ...rest } = grid(parsed.surface);
    const { volsPercent: expected, ...expectedRest } = grid(UNWINDING);
    expect(rest).toEqual(expectedRest);
    volsPercent.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]![j]!, 4)));
    expect(parsed.surface.pricingParams).toHaveLength(1);
    expect(parsed.surface.pricingParams[0]!.fwdSellRate).toBeCloseTo(0.066, 9);
  });
});
