"use client";

import { useRef, useState } from "react";
import { Database, Download, FileSpreadsheet, Pencil, Save, SlidersHorizontal, TrendingDown, Upload, X } from "lucide-react";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { KeyValueCard, TableCard } from "@/components/ui/desk-table";
import { Segmented } from "@/components/ui/fields";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { resolvedRate } from "@/lib/engine/rates";
import type { VolSurface } from "@/lib/engine/types";
import { fmtNumber, fmtPercent } from "@/lib/format";
import type { KeyValueSpec, TableSpec } from "@/lib/tables";

export default function MarketDataPage() {
  const { inputs, workbookMarket, liveMarket, datasetSource, applyMarket, refreshDataset } = useDesk();
  const [view, setView] = useState<"active" | "workbook">(inputs.mode === "workbook" ? "workbook" : "active");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[][]>([]);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const market = view === "workbook" ? workbookMarket : (liveMarket ?? workbookMarket);
  const surface = market.surface;
  const params = market.params;
  const premiumRate = inputs.premiumRate;
  const editable = view === "active";

  const startEdit = () => {
    setDraft(surface.volsPercent.map((row) => [...row]));
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const next: VolSurface = { ...surface, volsPercent: draft };
      const res = await fetch("/api/surface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.[0] ?? data.error ?? "Save failed");
      applyMarket({ surface: data.surface });
      setEditing(false);
      setStatus(
        data.persisted
          ? { tone: "ok", text: "The surface was saved to the desk database." }
          : { tone: "warn", text: "The desk database is unavailable. The edit applies to this session only." },
      );
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/vol-surface", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.join(" ") ?? data.error ?? "Upload failed");
      applyMarket({ surface: data.surface, params: data.params });
      setView("active");
      setStatus(
        data.persisted
          ? { tone: "ok", text: `${file.name} replaced the active surface: ${data.summary.expiries} expiry rows and ${data.summary.strikePercents} Strike Change columns.` }
          : { tone: "warn", text: `${file.name} was read, but the desk database is unavailable, so it applies to this session only.` },
      );
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const surfaceParams: KeyValueSpec = {
    id: "surface-params",
    title: "Surface Parameters",
    items: [
      { label: "Month", value: surface.label, kind: "text" },
      { label: "Reference Nifty Price", value: surface.referenceUnderlyingPrice ?? null, kind: "number", digits: 2 },
      { label: "Reference Sensex Price", value: surface.referenceSensexPrice ?? null, kind: "number", digits: 2 },
      { label: "Volatility Bump", value: surface.pricingParams[0]?.volBump ?? 0, kind: "percent" },
      { label: "Forward Sell Rate", value: params.forwardSellRate, kind: "percent" },
      { label: "Rate Cap While Buying Forward", value: params.rateCapBuyingForward, kind: "percent" },
      { label: "Dividend Bid Offer Multiplier", value: params.dividendBidOfferMultiplier, kind: "number", digits: 2 },
    ],
  };

  const pricingTable: TableSpec = {
    id: "pricing-params",
    title: "Pricing Params By Expiry",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "bump", label: "Volatility Bump", kind: "percent" },
      { key: "inc", label: "Incremental Margin", kind: "percent" },
      { key: "full", label: "Full Margin", kind: "percent" },
      { key: "cost", label: "Margin Cost", kind: "percent" },
      { key: "fwd", label: "Forward Sell Rate", kind: "percent" },
    ],
    rows: surface.pricingParams.map((p) => ({
      date: p.date.slice(0, 10),
      bump: p.volBump,
      inc: p.incMargin ?? null,
      full: p.fullMargin ?? null,
      cost: p.marginCost ?? null,
      fwd: p.fwdSellRate,
    })),
  };

  const curveTable: TableSpec = {
    id: "rate-curve",
    title: "Rate Curve",
    note: "Points marked as linked follow the Premium Growth Rate, as the workbook links them to the Summary prem rate.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "rate", label: "Rate", kind: "percent" },
      { key: "linked", label: "Linked To Premium Growth Rate", kind: "text" },
    ],
    rows: params.rateCurve.map((p) => ({ date: p.date.slice(0, 10), rate: resolvedRate(p, premiumRate), linked: p.linkedToPremiumRate ? "Yes" : "No" })),
  };

  const dividendTable: TableSpec = {
    id: "dividends",
    title: "Implied Dividends",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Implied Dividend In Sensex Points", kind: "number", digits: 3 },
    ],
    rows: params.dividends.map((d) => ({ date: d.date.slice(0, 10), amount: d.amount })),
  };

  const lastExpiry = surface.expiries[surface.expiries.length - 1];

  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Market Data"
        subtitle="The vol surface, its reference prices, the Pricing Params, the rate curve and dividends. Workbook Defaults always price on the workbook seed; Live prices on the active desk surface."
        aside={
          <Segmented
            label="Surface View"
            testId="surface-view"
            value={view}
            onChange={(v) => {
              setView(v);
              setEditing(false);
            }}
            options={[
              { value: "active", label: "Active Desk Surface" },
              { value: "workbook", label: "Workbook Seed" },
            ]}
          />
        }
      />
      <KpiRail
        items={[
          { label: "Surface", value: surface.expiries.length, format: (v) => `${fmtNumber(v, 0)} Expiry Rows` },
          { label: "Reference Sensex Price", value: surface.referenceSensexPrice ?? null, format: (v) => fmtNumber(v, 2) },
          { label: "Reference Nifty Price", value: surface.referenceUnderlyingPrice ?? null, format: (v) => fmtNumber(v, 2) },
          { label: "Forward Sell Rate", value: params.forwardSellRate, format: (v) => fmtPercent(v) },
          { label: "Strike Change Columns", value: surface.moneyness.length, format: (v) => fmtNumber(v, 0) },
        ]}
      />
      <Panel index={0}>
        <SectionTitle
          icon={Upload}
          subtitle="The upload replaces the active surface for Live mode. Use the sample for the layout: a Vol Surface sheet, a Surface Parameters sheet, and optional Rate Curve and Dividends sheets."
          aside={<span className="hs-chip">Source {view === "workbook" ? "Workbook Seed" : datasetSource === "database" ? "Desk Database" : "Built In Seed"}</span>}
        >
          Upload and Replace
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            data-testid="surface-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <button type="button" className="btn-animated btn-motion btn-primary" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="upload-surface">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Upload Vol Surface
            </span>
          </button>
          <a className="btn-animated btn-motion btn-accent" href="/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx" download data-testid="download-sample">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Sample
            </span>
          </a>
          <button type="button" className="btn-ghost btn-animated text-xs" onClick={() => void refreshDataset()}>
            Reload From Desk
          </button>
        </div>
        {status ? (
          <p className={status.tone === "error" ? "hs-error mt-3" : status.tone === "warn" ? "hs-warning mt-3" : "hs-chip mt-3"} data-testid="upload-status">
            {status.text}
          </p>
        ) : null}
      </Panel>
      <Panel index={1}>
        <SectionTitle
          icon={Database}
          subtitle={`${surface.label}. Vols are in percent points. Expiries beyond ${lastExpiry ? formatDate(lastExpiry) : "the last row"} read the last row.`}
          aside={
            editable ? (
              editing ? (
                <>
                  <button type="button" className="btn-animated btn-motion btn-primary" disabled={busy} onClick={() => void save()} data-testid="save-surface">
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <Save className="h-4 w-4" /> Save
                    </span>
                  </button>
                  <button type="button" className="btn-ghost btn-animated text-xs" onClick={() => setEditing(false)} data-testid="discard-surface">
                    <X className="h-3.5 w-3.5" /> Discard
                  </button>
                </>
              ) : (
                <button type="button" className="btn-ghost btn-animated text-xs" onClick={startEdit} data-testid="edit-surface">
                  <Pencil className="h-3.5 w-3.5" /> Edit Surface
                </button>
              )
            ) : (
              <span className="hs-chip">Read Only Seed</span>
            )
          }
        >
          Volatility Surface
        </SectionTitle>
        <VolSurfaceGrid
          surface={surface}
          editing={editing}
          draft={draft}
          onCellChange={(r, c, v) =>
            setDraft((prev) => {
              const next = prev.map((row) => [...row]);
              if (next[r]) next[r]![c] = v;
              return next;
            })
          }
        />
      </Panel>
      <Panel index={2}>
        <SectionTitle icon={SlidersHorizontal}>Surface Parameters</SectionTitle>
        <KeyValueCard spec={surfaceParams} />
      </Panel>
      <Panel index={3}>
        <SectionTitle icon={SlidersHorizontal}>Pricing Params By Expiry</SectionTitle>
        <TableCard spec={pricingTable} />
      </Panel>
      <Panel index={4}>
        <SectionTitle icon={TrendingDown}>Rate Curve</SectionTitle>
        <TableCard spec={curveTable} />
      </Panel>
      <Panel index={5}>
        <SectionTitle icon={TrendingDown}>Implied Dividends</SectionTitle>
        <TableCard spec={dividendTable} />
      </Panel>
    </div>
  );
}
