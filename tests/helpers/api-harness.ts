import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { mockChartResponse } from "@/lib/test/mocks/yahoo";

import pricingParams from "../fixtures/pricing-params.json";
import surface from "../fixtures/surface.json";

export const TEST_DB = "hedging_sheet_test";

/** Yahoo answered by MSW with the deterministic chart, so the real market data code path runs. */
export const yahooHandlers = ["query1", "query2"].map((host) =>
  http.get(`https://${host}.finance.yahoo.com/v8/finance/chart/:symbol`, ({ request }) => HttpResponse.json(mockChartResponse(request.url))),
);

/** An in-memory Mongo seeded with the fixture surface and parameters, plus MSW for Yahoo. */
export async function startApiHarness() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = TEST_DB;
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  const db = client.db(TEST_DB);
  await db.collection("vol_surfaces").insertOne({ ...surface, isActive: true, source: "fixture" });
  await db.collection("pricing_params").insertOne({ ...pricingParams, key: "month:2026-10", isActive: true, source: "fixture" });
  const msw = setupServer(...yahooHandlers);
  msw.listen({ onUnhandledRequest: "bypass" });
  return {
    db,
    async stop() {
      msw.close();
      const { closeDb } = await import("@/lib/db/mongo");
      await closeDb();
      await client.close();
      await mongod.stop();
      delete process.env.MONGODB_URI;
      delete process.env.MONGODB_DB;
    },
  };
}
