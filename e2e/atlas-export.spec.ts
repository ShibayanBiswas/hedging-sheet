import ExcelJS from "exceljs";
import fs from "node:fs";
import { PDFParse } from "pdf-parse";

import { expect, test } from "./fixtures";
import { downloadExcel } from "./support/excel";

/** The words of the mock history. The PDF table breaks long words at a hyphen, which flat joins back up. */
const CALCULATED = /calculated from \d+ daily returns from/;
const EDITED = /as edited on the Inputs tab/;
const flat = (text: string) => text.replace(/-\s+(?=[a-z])/g, "").replace(/\s+/g, " ");

test.describe("Logic Atlas exports name the volatility source as the page does", () => {
  test("a calculated volatility reads calculated on the page, in the PDF and in Excel", async ({ page, inputs, nav }) => {
    await inputs.goto();
    await expect(page.getByTestId("daily-vol-status")).toHaveText("Calculated");
    await inputs.run();
    await nav.go("logic-atlas");
    await expect(page.getByTestId("stage-volatility-description")).toContainText(CALCULATED);

    const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-pdf-logic-atlas").click()]);
    const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(await pdf.path())) });
    const { text } = await parser.getText();
    await parser.destroy();
    expect(flat(text)).toMatch(CALCULATED);
    expect(flat(text)).not.toMatch(EDITED);

    const { file } = await downloadExcel(page);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const cells: string[] = [];
    wb.getWorksheet("Logic Atlas")!.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value))));
    expect(cells.join(" ")).toMatch(CALCULATED);
    expect(cells.join(" ")).not.toMatch(EDITED);
  });
});
