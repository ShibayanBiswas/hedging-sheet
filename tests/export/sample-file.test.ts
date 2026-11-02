import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import volSeed from "@/lib/data/vol-surface-seed.json";
import { parseVolSurfaceFile } from "@/lib/excel/parse-vol-surface";

describe("the sample surface file the app offers for download", () => {
  it("holds the built in surface in full, not rounded", () => {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "samples", "Hedging_Sheet_Vol_Surface_Sample.xlsx"));
    const { surface } = parseVolSurfaceFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "2026-11");
    expect(surface.volsPercent).toEqual(volSeed.volsPercent);
  });
});
