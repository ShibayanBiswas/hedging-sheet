"use client";

import { useRef, useState } from "react";
import { Database, Download, FileSpreadsheet, Gauge, Pencil, Plus, RotateCcw, Save, SlidersHorizontal, Trash2, TrendingDown, Upload, X } from "lucide-react";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { TableCard } from "@/components/ui/desk-table";
import { FieldRow, NumberInput, Segmented } from "@/components/ui/fields";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { resolvedRate } from "@/lib/engine/rates";
import type { BidOffer, PricingParams, VolSurface } from "@/lib/engine/types";
import { forwardSellRateForMonth } from "@/lib/engine/vol-surface";
import { useSurfaceUpload } from "@/lib/hooks/use-surface-upload";
import { headlineTable, type TableSpec } from "@/lib/tables";

function SurfaceParamsEditor() {
  const { market, inputs, applyMarket } = useDesk();
  const { alert, toast } = useDeskDialog();
  const [draft, setDraft] = useState<PricingParams | null>(null);
  const [busy, setBusy] = useState(false);
  const params = draft ?? market.params;
  const dirty = draft != null;

  const edit = (patch: Partial<PricingParams>) => setDraft({ ...params, ...patch });
  const editPoint = (i: number, patch: Partial<PricingParams["rateCurve"][number]>) =>
    edit({ rateCurve: params.rateCurve.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = async () => {
    if (!draft) return;
    const years = draft.rateCurve.map((p) => p.years);
    if (years.some((y, i) => !Number.isFinite(y) || y < 0 || (i > 0 && y <= years[i - 1]!))) {
      alert("Rate curve tenors must be zero or more and rise strictly from one point to the next.", {
        variant: "error",
        title: "Please Fix The Rate Curve",
        fix: "Sort the tenors in years from shortest to longest and remove duplicates.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/params", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.[0] ?? data.error ?? "Save failed");
      applyMarket({ params: data.params });
      setDraft(null);
      if (data.persisted === false) {
        alert("The desk database is unavailable, so the surface parameters apply to this session only.", { variant: "warning", title: "Saved Locally" });
      } else {
        toast("Surface Parameters Saved");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed", { variant: "error", title: "Save Failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel index={2}>
      <SectionTitle
        icon={SlidersHorizontal}
        subtitle="These feed the Pricer: the Bid or Offer row, the discount yield caps and the rate curve. The curve is anchored at the valuation date and extended a year past the longest expiry."
        aside={
          dirty ? (
            <>
              <button type="button" className="btn-animated btn-motion btn-primary" disabled={busy} onClick={() => void save()} data-testid="save-params">
                <span className="relative z-10 inline-flex items-center gap-2">
                  <Save className="h-4 w-4" /> Save
                </span>
              </button>
              <button type="button" className="btn-ghost btn-animated text-xs" onClick={() => setDraft(null)} data-testid="discard-params">
                <X className="h-3.5 w-3.5" /> Discard
              </button>
            </>
          ) : null
        }
      >
        Surface Parameters
      </SectionTitle>
      <div className="grid w-full gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FieldRow label="Bid or Offer" hint="The side every Pricer leg is priced on.">
          <Segmented<BidOffer>
            label="Bid or Offer"
            testId="bid-offer"
            value={params.bidOffer}
            onChange={(v) => edit({ bidOffer: v })}
            options={[
              { value: "B", label: "Bid" },
              { value: "O", label: "Offer" },
            ]}
          />
        </FieldRow>
        <FieldRow label="Rate Cap While Buying Forward" hint="Caps the discount yield on the buying side.">
          <NumberInput kind="percent" suffix="%" value={params.rateCapBuyingForward} onChange={(v) => edit({ rateCapBuyingForward: v })} testId="rate-cap-buying" />
        </FieldRow>
        <FieldRow label="Premium Rate Spread" hint="Added to the Premium Growth Rate for the selling side cap.">
          <NumberInput kind="percent" suffix="%" value={params.premiumRateSpread} onChange={(v) => edit({ premiumRateSpread: v })} testId="premium-rate-spread" />
        </FieldRow>
        <FieldRow label="Dividend Bid Offer Multiplier" hint="Scales the implied dividend yield.">
          <NumberInput value={params.dividendBidOfferMultiplier} onChange={(v) => edit({ dividendBidOfferMultiplier: v })} testId="dividend-multiplier" />
        </FieldRow>
      </div>
      <div className="mt-4 w-full overflow-x-auto">
        <table className="desk-table w-full" data-testid="rate-curve-editor">
          <thead>
            <tr>
              <th className="text-left">Tenor In Years</th>
              <th className="text-right">Rate In Percent</th>
              <th className="text-left">Linked To Premium Growth Rate</th>
              <th className="text-right">Rate Used</th>
              <th aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {params.rateCurve.map((p, i) => (
              <tr key={i}>
                <td className="min-w-[8rem]">
                  <NumberInput digits={2} value={p.years} onChange={(v) => editPoint(i, { years: v })} testId={`curve-years-${i}`} />
                </td>
                <td className="min-w-[8rem]">
                  <NumberInput digits={3} suffix="%" value={p.ratePercent} disabled={p.linkedToPremiumRate} onChange={(v) => editPoint(i, { ratePercent: v })} testId={`curve-rate-${i}`} />
                </td>
                <td>
                  <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-sm">
                    <input type="checkbox" checked={Boolean(p.linkedToPremiumRate)} onChange={(e) => editPoint(i, { linkedToPremiumRate: e.target.checked })} data-testid={`curve-linked-${i}`} />
                    {p.linkedToPremiumRate ? "Yes" : "No"}
                  </label>
                </td>
                <td className="text-right font-mono tabular-nums">{(resolvedRate(p, inputs.premiumRate) * 100).toFixed(3)}%</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn-ghost btn-animated text-xs"
                    disabled={params.rateCurve.length <= 1}
                    onClick={() => edit({ rateCurve: params.rateCurve.filter((_, j) => j !== i) })}
                    aria-label={`Remove tenor ${p.years}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs"
          onClick={() => {
            const last = params.rateCurve[params.rateCurve.length - 1];
            edit({ rateCurve: [...params.rateCurve, { years: (last?.years ?? 0) + 1, ratePercent: last?.ratePercent ?? 6.5, linkedToPremiumRate: false }] });
          }}
          data-testid="curve-add"
        >
          <Plus className="h-3.5 w-3.5" /> Add Tenor
        </button>
        {dirty ? (
          <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" onClick={() => setDraft(null)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset To Saved
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

export default function MarketDataPage() {
  const { inputs, market, datasetSource, applyMarket, refreshDataset } = useDesk();
  const { alert } = useDeskDialog();
  const { upload, busy: uploading } = useSurfaceUpload();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[][]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const surface = market.surface;
  const params = market.params;
  const lastExpiry = surface.expiries[surface.expiries.length - 1];
  const sourceLabel = datasetSource === "database" ? "Desk Database" : "Built In Seed";

  const save = async () => {
    setBusy(true);
    try {
      const next: VolSurface = { ...surface, volsPercent: draft };
      const res = await fetch("/api/surface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.[0] ?? data.error ?? "Save failed");
      applyMarket({ surface: data.surface });
      setEditing(false);
      alert(
        data.persisted ? "The surface was saved to the desk database. Run the simulation again to price on it." : "The desk database is unavailable, so the edit applies to this session only.",
        { variant: data.persisted ? "info" : "warning", title: data.persisted ? "Surface Saved" : "Saved Locally" },
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed", { variant: "error", title: "Save Failed" });
    } finally {
      setBusy(false);
    }
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

  const dividendTable: TableSpec = {
    id: "dividends",
    title: "Implied Dividends",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Implied Dividend In Index Points", kind: "number", digits: 3 },
    ],
    rows: params.dividends.map((d) => ({ date: d.date.slice(0, 10), amount: d.amount })),
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Market Data" subtitle="The active vol surface, its reference prices, the surface parameters, the Pricing Params and the implied dividends." />
      <Panel>
        <SectionTitle icon={Gauge}>Headline</SectionTitle>
        <TableCard
          spec={headlineTable("market-headline", "Headline", [
            { label: "Surface", value: surface.label, kind: "text" },
            { label: "Source", value: sourceLabel, kind: "text" },
            { label: "Expiry Rows", value: surface.expiries.length, kind: "integer" },
            { label: "Strike Change Columns", value: surface.moneyness.length, kind: "integer" },
            { label: "Reference Nifty Price", value: surface.referenceUnderlyingPrice ?? null, kind: "number" },
            { label: "Reference Sensex Price", value: surface.referenceSensexPrice ?? null, kind: "number" },
            { label: "Forward Growth This Month", value: forwardSellRateForMonth(surface.pricingParams, inputs.valuationDate), kind: "percent" },
            { label: "Bid or Offer", value: params.bidOffer === "O" ? "Offer" : "Bid", kind: "text" },
          ])}
        />
      </Panel>
      <Panel index={0}>
        <SectionTitle
          icon={Upload}
          subtitle="The upload replaces the active surface. Use the sample for the layout: a Vol Surface sheet, a Surface Parameters sheet with Bid or Offer, and optional Rate Curve and Dividends sheets."
          aside={<span className="hs-chip">Source {sourceLabel}</span>}
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
              if (file) void upload(file).finally(() => fileRef.current && (fileRef.current.value = ""));
            }}
          />
          <button type="button" className="btn-animated btn-motion btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()} data-testid="upload-surface">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              {uploading ? "Uploading" : "Upload Vol Surface"}
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
      </Panel>
      <Panel index={1}>
        <SectionTitle
          icon={Database}
          subtitle={`${surface.label}. Vols are in percent points. Expiries beyond ${lastExpiry ? formatDate(lastExpiry) : "the last row"} read the last row.`}
          aside={
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
              <button
                type="button"
                className="btn-ghost btn-animated text-xs"
                onClick={() => {
                  setDraft(surface.volsPercent.map((row) => [...row]));
                  setEditing(true);
                }}
                data-testid="edit-surface"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Surface
              </button>
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
      <SurfaceParamsEditor />
      <Panel index={3}>
        <SectionTitle icon={SlidersHorizontal}>Pricing Params By Expiry</SectionTitle>
        <TableCard spec={pricingTable} />
      </Panel>
      <Panel index={4}>
        <SectionTitle icon={TrendingDown}>Implied Dividends</SectionTitle>
        <TableCard spec={dividendTable} />
      </Panel>
    </div>
  );
}
