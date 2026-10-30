import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { pdfText, type PdfBlock } from "@/lib/pdf/blocks";

const MAROON = "#7a1e2c";
const GOLD = "#d4b24c";
const INK = "#1c1917";
const MUTED = "#78716c";
const RULE = "#e7e5e4";

const s = StyleSheet.create({
  page: { paddingTop: 70, paddingBottom: 40, paddingHorizontal: 28, fontFamily: "Helvetica", fontSize: 7.5, color: INK, backgroundColor: "#ffffff" },
  band: { position: "absolute", top: 0, left: 0, right: 0, height: 52, backgroundColor: MAROON, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: GOLD, fontSize: 7.5 },
  title: { color: "#ffffff", fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 2 },
  subtitle: { color: "#ffffff", fontSize: 8, textAlign: "right" },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: MUTED, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 4 },
  block: { marginBottom: 10 },
  blockTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: MAROON, marginBottom: 2 },
  note: { fontSize: 7, color: MUTED, marginBottom: 3 },
  headRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: "#faf7f2" },
  headCell: { paddingVertical: 3, paddingHorizontal: 3, fontFamily: "Helvetica-Bold", color: MAROON, fontSize: 7 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE },
  cell: { paddingVertical: 2.5, paddingHorizontal: 3 },
  strong: { fontFamily: "Helvetica-Bold" },
  empty: { color: MUTED, fontSize: 8, marginTop: 8 },
});

export type TabPdfProps = {
  /** The tab's title, such as Day 1 Vega Hedge. */
  title: string;
  subtitle: string;
  /** Footer text before the page number: the Valuation Date and the run time in IST. */
  footer: string;
  blocks: PdfBlock[];
};

function Table({ block }: { block: PdfBlock }) {
  const n = block.right.length;
  // The first column carries labels, so it gets more room.
  const width = (k: number) => (k === 0 ? { flexGrow: n > 6 ? 1.6 : 2, flexBasis: 0 } : { flexGrow: 1, flexBasis: 0 });
  const size = n > 10 ? { fontSize: 6.5 } : {};
  return (
    <View style={s.block}>
      <View wrap={false}>
        <Text style={s.blockTitle}>{pdfText(block.title)}</Text>
        {block.note ? <Text style={s.note}>{pdfText(block.note)}</Text> : null}
      </View>
      {block.head.map((h, i) => (
        <View key={`h${i}`} style={s.headRow} fixed>
          {h.map((label, k) => (
            <Text key={k} style={[s.headCell, size, width(k), { textAlign: block.right[k] ? "right" : "left" }]}>
              {pdfText(label)}
            </Text>
          ))}
        </View>
      ))}
      {block.rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {r.cells.map((c, k) => (
            <Text key={k} style={[s.cell, size, width(k), { textAlign: block.right[k] ? "right" : "left" }, r.strong || k === 0 ? s.strong : {}]}>
              {pdfText(c)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A whole tab as a landscape A4 document: header band, every table with its header repeated on each page, numbered footer. */
export function TabPdfDocument({ title, subtitle, footer, blocks }: TabPdfProps) {
  return (
    <Document title={`Hedging Sheet · ${title}`} author="Anand Rathi Wealth" creator="Hedging Sheet">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.band} fixed>
          <View>
            <Text style={s.brand}>Anand Rathi Wealth · Hedging Sheet</Text>
            <Text style={s.title}>{pdfText(title)}</Text>
          </View>
          <Text style={s.subtitle}>{pdfText(subtitle)}</Text>
        </View>
        {blocks.length ? blocks.map((b, i) => <Table key={i} block={b} />) : <Text style={s.empty}>-</Text>}
        <View style={s.footer} fixed>
          <Text>{pdfText(footer)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} Of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
