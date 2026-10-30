import { displayCell, type AnySpec, type CellKind, type CellValue } from "@/lib/tables";

/** One printable table: header rows, body rows as display text, and which columns align right. */
export type PdfBlock = {
  title: string;
  note?: string;
  head: string[][];
  rows: Array<{ cells: string[]; strong?: boolean }>;
  right: boolean[];
};

/** Columns that fit a landscape A4 page; wider tables continue in further blocks that repeat the first column. */
const PDF_MAX_COLUMNS = 14;

const isRight = (kind: CellKind) => kind !== "text" && kind !== "date";

/**
 * Text the built-in PDF font can draw: it has no rupee sign or minus sign, so amounts drop the sign (their headers say
 * In Crore or In Rupees) and the minus becomes a hyphen.
 */
export function pdfText(s: string): string {
  return s.replace(/₹\s?/g, "").replace(/\u2212/g, "-");
}

const show = (value: CellValue, kind: CellKind, digits?: number) => pdfText(displayCell(value, kind, digits).text);

/** A group header row shows each label once, over the first of its columns. */
const once = (row: string[]) => row.map((label, k) => (k > 1 && row[k - 1] === label ? "" : label));

/**
 * Split a wide table into blocks of at most `max` columns, each repeating the first column.
 * `groupRow` names a header row of group labels, given once per column.
 */
function chunk(block: PdfBlock, max: number, groupRow = -1): PdfBlock[] {
  const width = block.right.length;
  const finish = (b: PdfBlock): PdfBlock => ({ ...b, head: b.head.map((h, i) => (i === groupRow ? once(h) : h)) });
  if (width <= max) return [finish(block)];
  const per = max - 1;
  return Array.from({ length: Math.ceil((width - 1) / per) }, (_, p) => {
    const cols = [0, ...Array.from({ length: Math.min(per, width - 1 - p * per) }, (_, k) => 1 + p * per + k)];
    return finish({
      title: `${block.title} · Columns ${cols[1]} To ${cols[cols.length - 1]}`,
      note: p === 0 ? block.note : undefined,
      head: block.head.map((h) => cols.map((c) => h[c] ?? "")),
      rows: block.rows.map((r) => ({ ...r, cells: cols.map((c) => r.cells[c] ?? "") })),
      right: cols.map((c) => block.right[c] ?? false),
    });
  });
}

/** The printable blocks of a table spec, values shown as on screen: at most 3 decimals and "-" when missing. */
export function specBlocks(spec: AnySpec, max = PDF_MAX_COLUMNS): PdfBlock[] {
  if ("items" in spec) {
    return [
      {
        title: spec.title,
        note: spec.note,
        head: [["Item", "Value"]],
        rows: spec.items.map((it) => ({ cells: [it.label, show(it.value, it.kind, it.digits)] })),
        right: [false, false],
      },
    ];
  }
  if ("corner" in spec) {
    const groups = spec.groups.flatMap((g) => Array.from({ length: g.span }, () => g.label));
    return chunk(
      {
        title: spec.title,
        note: spec.note,
        head: [
          [spec.corner[0], ...groups],
          [spec.corner[1], ...spec.columnLabels],
        ],
        rows: spec.rows.map((f) => ({ cells: [f.label, ...f.values.map((v) => show(v, f.kind, f.digits))] })),
        right: [false, ...spec.columnLabels.map(() => true)],
      },
      max,
      0,
    );
  }
  return chunk(
    {
      title: spec.title,
      note: spec.note,
      head: [spec.columns.map((c) => c.label)],
      rows: spec.rows.map((row, i) => ({
        cells: spec.columns.map((c) => show(row[c.key] ?? null, c.kind, c.digits)),
        strong: spec.highlightRow === i || spec.totalRow === i,
      })),
      right: spec.columns.map((c) => isRight(c.kind)),
    },
    max,
  );
}
