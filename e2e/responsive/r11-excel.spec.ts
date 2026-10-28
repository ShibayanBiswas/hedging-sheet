import ExcelJS from "exceljs";

import { EXCEL_FONT, EXCEL_LINE_HEIGHT, EXCEL_THEME, excelCellDisplayLength } from "../../lib/workbook/export-theme";
import { expect, test } from "../fixtures";
import { downloadExcel } from "../support/excel";

const DEFAULT_ROW_HEIGHT = 15;

/** R11 on one sheet: widths fit values, header rows fit wrapped headers, and fonts follow the desk export style. */
function sheetProblems(sheet: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  sheet.eachRow((row, r) => {
    const height = row.height ?? DEFAULT_ROW_HEIGHT;
    row.eachCell((cell) => {
      if (cell.value == null || cell.value === "") return;
      const where = `${sheet.name} ${cell.address}`;
      const font = cell.font ?? {};
      if (font.name !== EXCEL_FONT) out.push(`${where} uses font ${font.name ?? "default"}, not ${EXCEL_FONT}`);
      if (cell.isMerged) return;
      const width = sheet.getColumn(cell.col).width ?? 10;
      const length = excelCellDisplayLength(cell);
      const lines = Math.ceil(length / Math.max(1, width - 1));
      if (lines > 1) {
        if (!cell.alignment?.wrapText) out.push(`${where} is ${length} wide in a ${width} column and does not wrap`);
        else if (height < lines * EXCEL_LINE_HEIGHT - 0.5) out.push(`${where} needs ${lines} lines but row ${r} is ${height}pt`);
      }
      const isHeader = font.bold === true && font.color?.argb === EXCEL_THEME.maroon && (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb === EXCEL_THEME.label;
      if (isHeader && font.size !== 10) out.push(`${where} header is ${font.size}pt, not 10pt`);
      const isBody = font.color?.argb === EXCEL_THEME.ink && !isHeader;
      if (isBody && font.size !== 10) out.push(`${where} body cell is ${font.size}pt, not 10pt`);
    });
  });
  return out;
}

test.describe("R11 Excel layout", () => {
  test("column widths fit their longest value, header rows fit wrapped headers, and fonts follow the desk style", async ({ page, inputs }) => {
    await inputs.goto();
    await inputs.run();
    const { file } = await downloadExcel(page);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const problems = wb.worksheets.flatMap(sheetProblems);
    expect(problems.slice(0, 40), problems.join("\n")).toEqual([]);
    // Every sheet has at least one styled header row.
    for (const sheet of wb.worksheets) {
      let headers = 0;
      sheet.eachRow((row) => row.eachCell((cell) => (cell.font?.bold && cell.font?.color?.argb === EXCEL_THEME.maroon ? headers++ : undefined)));
      expect(headers, sheet.name).toBeGreaterThan(0);
    }
  });
});
