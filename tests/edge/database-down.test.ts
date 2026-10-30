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
