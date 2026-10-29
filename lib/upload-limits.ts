/** One limit for the browser and the server: hosted requests are capped near 4.5 megabytes on Vercel. */
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

export const EXCEL_FILE_NAME = /\.(xlsx|xlsm|xls)$/i;

/** Zip for xlsx and xlsm, OLE for xls. */
export function looksLikeExcel(bytes: Uint8Array): boolean {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  return zip || ole;
}

/** The reason a file cannot be uploaded, checked before anything is sent, or null when it may go. */
export function uploadProblem(file: { name: string; size: number }): string | null {
  if (!EXCEL_FILE_NAME.test(file.name)) return "Choose An Excel Workbook.";
  if (file.size === 0) return "The Workbook Is Empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The Workbook Is Over The 4.5 Megabyte Limit.";
  return null;
}
