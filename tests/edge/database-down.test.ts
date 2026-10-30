import { afterEach, describe, expect, it } from "vitest";

import { GET as getDataset } from "@/app/api/dataset/route";
import { closeDb } from "@/lib/db/client";

afterEach(async () => {
  await closeDb();
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_DB;
});

describe("Edge · Database · Unavailable", () => {
  it("Disconnected: With No Database Configured, The Desk Still Loads A Surface And Says Where It Came From", async () => {
    delete process.env.MONGODB_URI;
    const res = await getDataset();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.surfaceSource).not.toBe("database");
    expect(body.surface.expiries.length).toBeGreaterThan(0);
  });

  it("Disconnected: A Save Is Refused By Validation, Or Lasts For This Instance Only And Is Read Back", async () => {
    delete process.env.MONGODB_URI;
    const { loadActiveParams, loadActiveSurface, ReferenceDataError, saveReferenceData } = await import("@/lib/data/load");
    const { seedMarketData } = await import("@/lib/engine/defaults");
    const market = seedMarketData();
    await expect(saveReferenceData({ surface: { ...market.surface, expiries: [] } }, "test")).rejects.toBeInstanceOf(ReferenceDataError);
    const surface = { ...market.surface, monthKey: "2099-01", label: "January 2099 Volatility Surface" };
    expect(await saveReferenceData({ surface, params: { values: { ...market.params, forwardSellRate: 0.0612 }, monthKey: "2099-01" } }, "test")).toBe(false);
    expect((await loadActiveSurface()).source).toBe("runtime");
    expect(await loadActiveParams()).toMatchObject({ source: "runtime", params: { forwardSellRate: 0.0612 } });
  });

  it("Slow Or Unreachable: The Request Gives Up Within Its Timeout And Still Answers", async () => {
    process.env.MONGODB_URI = "mongodb://127.0.0.1:9/?directConnection=true";
    process.env.MONGODB_DB = "hedging_sheet_test";
    const started = Date.now();
    const res = await getDataset();
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(res.status).toBe(200);
    expect((await res.json()).surfaceSource).not.toBe("database");
  }, 20_000);
});
