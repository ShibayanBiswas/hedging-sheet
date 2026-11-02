import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { normCdf } from "@/lib/engine/normal";
import { brentSolve } from "@/lib/engine/solver";
import { writeTypedCell } from "@/lib/excel/excel-cells";
import { croreText, dateText, numberText, percentText } from "@/lib/format";
import { copyViolations } from "@/lib/format/copy-rules";
import { parseExpiryPaste, parsePastedDate, parseStrikePaste } from "@/lib/inputs/bulk";
import { looksLikeExcel, uploadProblem } from "@/lib/upload-limits";

describe("pasted dates and rows", () => {
  it("reads a month name, refuses a made-up one, and reads a two digit year", () => {
    expect(parsePastedDate("25 April 30")).toBe("2030-04-25");
    expect(parsePastedDate("25-Abc-2030")).toBeNull();
    expect(parsePastedDate("31/02/2030")).toBeNull();
  });

  it("refuses an empty paste and more than 10 expiries, and names a date that is not one", () => {
    const ctx = { valuationDate: "2026-10-27", underlying: "Sensex" as const };
    expect(parseExpiryPaste(" \n ", ctx).error).toBe("Paste one date per line or per cell.");
    expect(parseExpiryPaste(Array.from({ length: 11 }, (_, i) => `2027-${String(i + 1).padStart(2, "0")}-15`).join("\n"), ctx).error).toMatch(/At most 10 expiries/);
    const bad = parseExpiryPaste("soon\n2027-03-25", ctx);
    expect(bad.rows[0]!.error).toBe("Not a date. Use 25-Apr-2030 or 2030-04-25.");
    expect(bad.rows[1]!.note).toBeUndefined();
    expect(bad.ok).toBe(false);
  });

  it("refuses an empty strike paste, more than 10 rows, a level that is not a number or out of range, and a bad type or side", () => {
    expect(parseStrikePaste("").error).toMatch(/Paste one strike per line/);
    expect(parseStrikePaste(Array.from({ length: 11 }, (_, i) => String(200 - i)).join("\n")).error).toMatch(/At most 10 strikes/);
    const r = parseStrikePaste("abc\n600\n130, Swap\n120, Call, Hold\n110, Call, Sell\n100");
    expect(r.rows.map((x) => x.error ?? "")).toEqual([
      "The level is not a number.",
      "The level must be above 0% and at most 500%.",
      "Option Type must be Put or Call.",
      "Buy Or Sell must be Buy or Sell.",
      "",
      "",
    ]);
    expect(r.rows[4]!.value).toEqual({ percent: 110, optionType: "C", side: "S" });
  });
});

describe("display of missing and broken values", () => {
  it("shows - with the reason, for a missing value and for one that could not be computed", () => {
    for (const show of [numberText, percentText, croreText]) {
      expect(show(null)).toEqual({ text: "-", title: "Not applicable" });
      expect(show(Number.NaN)).toEqual({ text: "-", title: "The value could not be computed" });
    }
    expect(dateText(null)).toEqual({ text: "-", title: "No date applies" });
    expect(dateText("2026-11-26").text).toBe("26-Nov-2026");
  });
});

describe("Excel cells", () => {
  const cell = () => new ExcelJS.Workbook().addWorksheet("T").getCell("A1");

  it("write a dash for a blank text cell on the left, a bad date, and a number that is not finite", () => {
    const blankText = cell();
    writeTypedCell(blankText, null, "text");
    expect(blankText.value).toBe("-");
    expect(blankText.alignment?.horizontal).toBe("left");
    const badDate = cell();
    writeTypedCell(badDate, "not a date", "date");
    expect(badDate.value).toBe("-");
    const inf = cell();
    writeTypedCell(inf, Number.POSITIVE_INFINITY, "number");
    expect(inf.value).toBe("-");
  });

  it("format integers, Greeks, rupees and plain numbers, and write -0 as 0", () => {
    const formats = (["integer", "greek", "rupee", "number"] as const).map((kind) => {
      const c = cell();
      writeTypedCell(c, -0, kind);
      expect(Object.is(c.value, 0)).toBe(true);
      return c.numFmt;
    });
    expect(formats).toEqual(["#,##0", "0.000", "#,##0.00", "#,##0.00"]);
    const text = cell();
    writeTypedCell(text, 12, "text");
    expect(text.value).toBe("12");
  });
});

describe("copy rules for cells", () => {
  it("flag an empty cell, Not Applicable words and broken numbers", () => {
    expect(copyViolations("", "cell")).toContain("is empty; use - when no value applies");
    expect(copyViolations("N/A", "cell").some((v) => v.includes("use - when no value applies"))).toBe(true);
    expect(copyViolations("NaN", "cell")).toContain('shows "NaN"');
  });
});

describe("normal distribution and the solver", () => {
  it("give the limits of the normal distribution, and NaN for NaN", () => {
    expect(normCdf(Infinity)).toBe(1);
    expect(normCdf(-Infinity)).toBe(0);
    expect(Number.isNaN(normCdf(Number.NaN))).toBe(true);
    expect(normCdf(40)).toBe(1);
  });

  it("returns a bound that is already a root, and reports no root when none is bracketed", () => {
    expect(brentSolve((x) => x - 2, 2, 5)).toMatchObject({ root: 2, converged: true });
    expect(brentSolve((x) => x - 5, 2, 5)).toMatchObject({ root: 5, converged: true });
    expect(brentSolve((x) => x * x + 1, -1, 1).converged).toBe(false);
  });
});

describe("upload checks", () => {
  it("know an old Excel file by its header, and refuse a name that is not Excel", () => {
    expect(looksLikeExcel(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe(true);
    expect(looksLikeExcel(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
    expect(uploadProblem({ name: "surface.csv", size: 10 })).toBe("Choose An Excel File.");
    expect(uploadProblem({ name: "surface.xls", size: 10 })).toBeNull();
  });
});
