import * as XLSX from "xlsx";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDataset } from "@/app/api/dataset/route";
import { GET as getSurface, POST as postSurface } from "@/app/api/surface/route";
import { POST as postUpload } from "@/app/api/uploads/vol-surface/route";
import { COLLECTIONS } from "@/lib/db/collections";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import { resetWriteGuard } from "@/lib/server/write-guard";
import { MOCK_NOW_ISO } from "@/lib/test/mocks/yahoo";

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

beforeEach(() => resetWriteGuard());

const write = (url: string, body: BodyInit) => new Request(`http://localhost${url}`, { method: "POST", body, headers: { "x-desk-key": TEST_DESK_KEY } });

const HEADER = ["Expiry", "Deep", 55, 60, 70, 80, 90, 100, 110];
const ROWS: Array<Array<string | number | Date | null>> = [
  [new Date(Date.UTC(2026, 10, 26)), 32, 32, 30, 27, 24, 21, 18, 16],
  [new Date(Date.UTC(2027, 1, 25)), 31, 31, 29, 26, 23, 20, 18, 16],
  [new Date(Date.UTC(2027, 4, 27)), 30, 30, 28, 25, 22, 20, 18, 16],
];

function workbook(rows: Array<Array<string | number | Date | null>>): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), "Vol Surface");
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

async function preview(bytes: Uint8Array | string, name = "surface.xlsx") {
  const form = new FormData();
  form.append("file", new File([bytes as BlobPart], name));
  form.append("monthKey", "2026-10");
  form.append("mode", "preview");
  const res = await postUpload(write("/api/uploads/vol-surface", form));
  return { status: res.status, body: await res.json() };
}

const savedSurfaces = async () => JSON.stringify(await harness.db.collection(COLLECTIONS.volSurfaces).find({}).sort({ _id: 1 }).toArray());

describe("Edge · Surface · Upload", () => {
  it("A Well Formed Surface Previews With Every Row And Column", async () => {
    const { status, body } = await preview(workbook([HEADER, ...ROWS]));
    expect(status).toBe(200);
    expect(body.summary).toMatchObject({ expiries: 3, strikePercents: 7 });
  });

  it("Text In A Number Cell Is Refused, Naming The Expiry And The Strike", async () => {
    const rows = ROWS.map((r) => [...r]);
    rows[1]![4] = "n/a";
    const { status, body } = await preview(workbook([HEADER, ...rows]));
    expect(status).toBe(400);
    expect(body.error).toBe('The volatility for 25-Feb-2027 at the 70% strike is "n/a"; every volatility must be a number above 0.');
  });

  it("A Missing Strike Value In A Row Is Refused, Never Read As 0%", async () => {
    const rows = ROWS.map((r) => [...r]);
    rows[2]![8] = null;
    const { status, body } = await preview(workbook([HEADER, ...rows]));
    expect(status).toBe(400);
    expect(body.error).toBe("The volatility for 27-May-2027 at the 110% strike is empty; every volatility must be a number above 0.");
  });

  it("A 0% Or Negative Volatility Is Refused", async () => {
    const rows = ROWS.map((r) => [...r]);
    rows[0]![3] = -5;
    const { status, body } = await preview(workbook([HEADER, ...rows]));
    expect(status).toBe(400);
    expect(body.error).toMatch(/at the 60% strike is "-5"/);
  });

  it("Missing Strike Columns Are Refused", async () => {
    const { status, body } = await preview(workbook([["Expiry", "Deep", "Notes"], ...ROWS.map((r) => [r[0]!, 30, "x"])]));
    expect(status).toBe(400);
    expect(body.error).toMatch(/Strike Change/);
  });

  it("No Expiry Rows Are Refused", async () => {
    const { status, body } = await preview(workbook([HEADER]));
    expect(status).toBe(400);
    expect(body.error).toBe("No expiry rows were found on the Volatility Surface Sheet.");
  });

  it("An Empty File Is Refused", async () => {
    const { status, body } = await preview(new Uint8Array(0));
    expect(status).toBe(400);
    expect(body.error).toBe("The Excel File Is Empty.");
  });

  it("A Very Large File Is Refused With 413 Before It Is Read", async () => {
    const { status, body } = await preview(new Uint8Array(MAX_UPLOAD_BYTES + 1));
    expect(status).toBe(413);
    expect(body.error).toBe("The Excel File Is Over The 4.5 Megabyte Limit.");
  });

  it("A Wrong Format Is Refused: A Text File, And A PDF Named Like A Workbook", async () => {
    expect((await preview("plain text", "notes.txt")).body.error).toBe("Choose An Excel File.");
    const pdf = await preview(new TextEncoder().encode("%PDF-1.7 not a workbook"), "surface.xlsx");
    expect(pdf.status).toBe(400);
    expect(pdf.body.error).toBe("The File Is Not In Excel Format.");
  });

  it("Nothing Refused Is Written", async () => {
    const before = await savedSurfaces();
    expect(before.length).toBeGreaterThan(10);
    const rows = ROWS.map((r) => [...r]);
    rows[1]![4] = "n/a";
    const form = new FormData();
    form.append("file", new File([workbook([HEADER, ...rows]) as BlobPart], "surface.xlsx"));
    form.append("monthKey", "2026-10");
    expect((await postUpload(write("/api/uploads/vol-surface", form))).status).toBe(400);
    expect(await savedSurfaces()).toBe(before);
  });
});

describe("Edge · Database", () => {
  it("A Write Rejected By Validation Returns 400 And Leaves The Saved Surface As It Was", async () => {
    const saved = (await (await getSurface()).json()).surface;
    const broken = { ...saved, volsPercent: saved.volsPercent.slice(1) };
    const res = await postSurface(write("/api/surface", JSON.stringify(broken)));
    expect(res.status).toBe(400);
    expect((await (await getSurface()).json()).surface.volsPercent).toEqual(saved.volsPercent);
  });

  it("Cache Clearing: A Save Is Read Back At Once, Not From A Stale Copy", async () => {
    const saved = (await (await getSurface()).json()).surface;
    saved.volsPercent[0][2] = 41.25;
    expect((await postSurface(write("/api/surface", JSON.stringify(saved)))).status).toBe(200);
    const dataset = await (await getDataset()).json();
    expect(dataset.surfaceSource).toBe("database");
    expect(dataset.surface.volsPercent[0][2]).toBe(41.25);
  });
});
