import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { mockChartResponse } from "@/lib/test/mocks/yahoo";

import { startTestDatabase, TEST_DESK_KEY } from "./test-database";

const TEST_DB = "hedging_sheet_test";

/** Yahoo answered by MSW with the deterministic chart, so the real market data code path runs. */
const yahooHandlers = ["query1", "query2"].map((host) =>
  http.get(`https://${host}.finance.yahoo.com/v8/finance/chart/:symbol`, ({ request }) => HttpResponse.json(mockChartResponse(request.url))),
);

/** An in-memory Mongo replica set seeded with the fixture surface and parameters, plus MSW for Yahoo. */
export async function startApiHarness() {
  const database = await startTestDatabase(TEST_DB);
  process.env.MONGODB_URI = database.uri;
  process.env.MONGODB_DB = TEST_DB;
  process.env.DESK_WRITE_KEY = TEST_DESK_KEY;
  const msw = setupServer(...yahooHandlers);
  msw.listen({ onUnhandledRequest: "bypass" });
  return {
    db: database.db,
    async stop() {
      msw.close();
      const { closeDb } = await import("@/lib/db/client");
      await closeDb();
      await database.stop();
      delete process.env.MONGODB_URI;
      delete process.env.MONGODB_DB;
      delete process.env.DESK_WRITE_KEY;
    },
  };
}
