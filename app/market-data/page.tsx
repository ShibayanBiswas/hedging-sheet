"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Database, Download, FileSpreadsheet, Gauge, Pencil, Plus, RotateCcw, Save, SlidersHorizontal, Trash2, TrendingDown, Upload, X } from "lucide-react";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { TableCard } from "@/components/ui/desk-table";
import { NumberInput, Segmented } from "@/components/ui/fields";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";
import { formatDate } from "@/lib/engine/dates";
import { anchoredCurve, rateCapSellingForward, resolvedRate } from "@/lib/engine/rates";
import type { BidOffer, PricingParams, VolSurface } from "@/lib/engine/types";
import { forwardMarket, pricingRowForMonth, referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { fmtPercent } from "@/lib/format";
import { useSurfaceUpload } from "@/lib/hooks/use-surface-upload";
import { headlineTable, type TableSpec } from "@/lib/tables";
import { downloadSurfaceFile } from "@/lib/workbook/excel-runtime";

type Grid = { volBump: number; incMargin: number; fullMargin: number; marginCost: number; fwdSellRate: number };

function gridFrom(surface: VolSurface, valuationDate: string, fallbackFwd: number): Grid {
  const row = pricingRowForMonth(surface.pricingParams, valuationDate);
  return {
    volBump: row?.volBump ?? 0,
    incMargin: row?.incMargin ?? 0,
    fullMargin: row?.fullMargin ?? 0,
    marginCost: row?.marginCost ?? 0,
    fwdSellRate: row?.fwdSellRate ?? fallbackFwd,
  };
}

function SurfaceParamsEditor() {
  const { market, inputs, applyMarket, refreshDataset } = useDesk();
  const { alert, toast } = useDeskDialog();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PricingParams | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = useMemo(() => gridFrom(market.surface, inputs.valuationDate, market.params.forwardSellRate), [market, inputs.valuationDate]);
  const params = draft ?? market.params;
  const g = grid ?? saved;
  const linked = params.rateCurve.every((p) => p.linkedToPremiumRate) ? "Y" : params.rateCurve.every((p) => !p.linkedToPremiumRate) ? "N" : "M";

  const edit = (patch: Partial<PricingParams>) => setDraft({ ...params, ...patch });
  const editGrid = (patch: Partial<Grid>) => setGrid({ ...g, ...patch });
  const editPoint = (i: number, patch: Partial<PricingParams["rateCurve"][number]>) =>
    edit({ rateCurve: params.rateCurve.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const start = () => {
    setDraft(market.params);
    setGrid(saved);
    setEditing(true);
  };
  const cancel = () => {
    setDraft(null);
    setGrid(null);
    setEditing(false);
  };

  const save = async () => {
    const years = params.rateCurve.map((p) => p.years);
    if (years.some((y, i) => !Number.isFinite(y) || y < 0 || (i > 0 && y <= years[i - 1]!))) {
      alert("Rate curve tenors must be zero or more and rise strictly from one point to the next.", {
        variant: "error",
        title: "Please Fix The Rate Curve",
        fix: "Sort the tenors in years from shortest to longest and remove duplicates.",
      });
      return;
    }
    if (Object.values(g).some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
      alert("Volatility Bump, the margins and the Forward Sell Rate must be between 0% and 100%.", { variant: "error", title: "Please Fix The Parameters" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/params", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ params, grid: g }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.[0] ?? data.error ?? "Save failed");
      applyMarket({ params: data.params, ...(data.surface ? { surface: data.surface } : {}) });
      cancel();
      if (data.persisted === false) alert("The desk database is unavailable, so the surface parameters apply to this session only.", { variant: "warning", title: "Saved Locally" });
      else toast(`Surface Parameters Saved For ${data.monthKey}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed", { variant: "error", title: "Save Failed" });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    cancel();
    await refreshDataset();
    toast("Surface Parameters Reloaded");
  };

  const pctCell = (value: number, onChange: (v: number) => void, testId: string) =>
    editing ? <NumberInput kind="percent" digits={3} suffix="%" value={value} onChange={onChange} testId={testId} /> : fmtPercent(value, 3);

  const rows: Array<{ label: string; value: ReactNode; note?: string }> = [
    { label: "Month", value: market.surface.label.replace(" Volatility Surface", "") },
    {
      label: "Bid Or Offer",
      value: editing ? (
        <Segmented<BidOffer>
          label="Bid Or Offer"
          testId="bid-offer"
          value={params.bidOffer}
          onChange={(v) => edit({ bidOffer: v })}
          options={[
            { value: "B", label: "Bid" },
            { value: "O", label: "Offer" },
          ]}
        />
      ) : params.bidOffer === "O" ? (
        "Offer"
      ) : (
        "Bid"
      ),
      note: "Pricer row 34. Bid carries no incremental margin.",
    },
    { label: "Volatility Bump", value: pctCell(g.volBump, (v) => editGrid({ volBump: v }), "param-vol-bump"), note: "Pricer row 33, by expiry." },
    { label: "Incremental Margin", value: pctCell(g.incMargin, (v) => editGrid({ incMargin: v }), "param-inc-margin"), note: "Pricer row 38 on Offer." },
    { label: "Full Margin", value: pctCell(g.fullMargin, (v) => editGrid({ fullMargin: v }), "param-full-margin"), note: "Pricer row 43." },
    { label: "Margin Cost", value: pctCell(g.marginCost, (v) => editGrid({ marginCost: v }), "param-margin-cost"), note: "Pricer rows 39 and 44." },
    { label: "Forward Sell Rate", value: pctCell(g.fwdSellRate, (v) => editGrid({ fwdSellRate: v }), "param-fwd-sell"), note: "Pricer row 28, the valuation month row." },
    {
      label: "Dividend Bid Or Offer Factor",
      value: editing ? (
        <NumberInput value={params.dividendBidOfferMultiplier} onChange={(v) => edit({ dividendBidOfferMultiplier: v })} testId="param-dividend-factor" />
      ) : (
        params.dividendBidOfferMultiplier.toFixed(2)
      ),
      note: "Pricing Params M2, applied to the Dividends row.",
    },
    { label: "Rate Cap While Buying Forward", value: pctCell(params.rateCapBuyingForward, (v) => edit({ rateCapBuyingForward: v }), "param-cap-buying"), note: "Pricing Params N2." },
    {
      label: "Rate Cap While Selling Forward",
      value: fmtPercent(rateCapSellingForward(params, inputs.premiumRate), 3),
      note: "Pricing Params O2: the last rate curve point.",
    },
    {
      label: "Premium Growth Rate Link",
      value: editing ? (
        <Segmented<"Y" | "N" | "M">
          label="Premium Growth Rate Link"
          testId="param-link"
          value={linked}
          onChange={(v) => v !== "M" && edit({ rateCurve: params.rateCurve.map((p) => ({ ...p, linkedToPremiumRate: v === "Y" })) })}
          options={[
            { value: "Y", label: "All Linked" },
            { value: "N", label: "None Linked" },
          ]}
        />
      ) : linked === "Y" ? (
        "All Points Linked"
      ) : linked === "N" ? (
        "No Points Linked"
      ) : (
        "Some Points Linked"
      ),
      note: "Linked points follow the Premium Growth Rate input.",
    },
    { label: "Rate Curve Points", value: `${params.rateCurve.length} Tenors`, note: "Edit them in the table below." },
  ];

  return (
    <Panel index={2}>
      <SectionTitle
        icon={SlidersHorizontal}
        subtitle="Every value the Pricer reads from Pricing Params. Defaults are this month's values; saving writes them to this month in the desk database and to every row of the forward grid."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <button type="button" className="btn-animated btn-motion btn-primary inline-flex items-center gap-2 !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void save()} data-testid="save-params">
                  <Save className="h-3.5 w-3.5" /> {busy ? "Saving" : "Save"}
                </button>
                <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" onClick={cancel} data-testid="cancel-params">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn-ghost btn-animated inline-flex min-w-[180px] items-center justify-center gap-2 text-xs" onClick={start} data-testid="edit-params">
                <Pencil className="h-3.5 w-3.5" /> Edit Parameters
              </button>
            )}
            <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" onClick={() => void reset()} data-testid="reset-params">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        }
      >
        Surface Parameters
      </SectionTitle>
      <div className="overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-maroon via-gold to-maroon/70" aria-hidden />
        <div className="desk-table-scroll horizontal-rail !rounded-t-none" tabIndex={0} role="region" aria-label="Surface Parameters">
          <table className="data-table-premium data-table-fill" data-testid="surface-params-table">
            <thead>
              <tr>
                <th className="col-pinned">Parameter</th>
                <th>Value</th>
                <th>Used In</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} className={i % 2 === 1 ? "data-table-row-alt" : undefined}>
                  <td className="col-pinned font-semibold">{row.label}</td>
                  <td className="min-w-[14rem]">{row.value}</td>
                  <td className="font-ui text-xs text-muted">{row.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="label-chip mb-2 mt-4">Rate Curve Points</p>
      <div className="overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-maroon via-gold to-maroon/70" aria-hidden />
        <div className="desk-table-scroll horizontal-rail !rounded-t-none" tabIndex={0} role="region" aria-label="Rate Curve Points">
          <table className="data-table-premium data-table-fill" data-testid="rate-curve-editor">
            <thead>
              <tr>
                <th className="col-pinned">Tenor In Years</th>
                <th className="text-right">Rate %</th>
                <th>Linked To Premium Growth Rate</th>
                <th className="text-right">Rate Used</th>
                {editing ? <th aria-label="Remove" /> : null}
              </tr>
            </thead>
            <tbody>
              {params.rateCurve.map((p, i) => (
                <tr key={i} className={i % 2 === 1 ? "data-table-row-alt" : undefined}>
                  <td className="col-pinned min-w-[8rem]">
                    {editing ? <NumberInput digits={2} value={p.years} onChange={(v) => editPoint(i, { years: v })} testId={`curve-years-${i}`} /> : p.years.toFixed(2)}
                  </td>
                  <td className="min-w-[8rem] text-right">
                    {editing ? (
                      <NumberInput digits={3} suffix="%" value={p.ratePercent} disabled={p.linkedToPremiumRate} onChange={(v) => editPoint(i, { ratePercent: v })} testId={`curve-rate-${i}`} />
                    ) : (
                      `${p.ratePercent.toFixed(3)}%`
                    )}
                  </td>
                  <td>
                    {editing ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-sm">
                        <input type="checkbox" checked={Boolean(p.linkedToPremiumRate)} onChange={(e) => editPoint(i, { linkedToPremiumRate: e.target.checked })} data-testid={`curve-linked-${i}`} />
                        {p.linkedToPremiumRate ? "Yes" : "No"}
                      </label>
                    ) : p.linkedToPremiumRate ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums">{fmtPercent(resolvedRate(p, inputs.premiumRate), 3)}</td>
                  {editing ? (
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
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing ? (
        <button
          type="button"
          className="btn-ghost btn-animated mt-3 inline-flex items-center gap-2 text-xs"
          onClick={() => {
            const last = params.rateCurve[params.rateCurve.length - 1];
            edit({ rateCurve: [...params.rateCurve, { years: (last?.years ?? 0) + 1, ratePercent: last?.ratePercent ?? 6.5, linkedToPremiumRate: false }] });
          }}
          data-testid="curve-add"
        >
          <Plus className="h-3.5 w-3.5" /> Add Tenor
        </button>
      ) : null}
    </Panel>
  );
}

export default function MarketDataPage() {
  const { inputs, market, datasetSource, applyMarket } = useDesk();
  const { alert } = useDeskDialog();
  const { upload, busy: uploading } = useSurfaceUpload();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[][]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Market data shows Sensex terms until an underlying is chosen.
  const u = inputs.underlying || "Sensex";
  const surface = market.surface;
  const live = useMemo(() => forwardMarket(market, inputs.valuationDate), [market, inputs.valuationDate]);
  const lastExpiry = surface.expiries[surface.expiries.length - 1];
  const sourceLabel = datasetSource === "database" ? "Desk Database" : "Built In Surface";

  const save = async () => {
    if (draft.some((row) => row.some((v) => !(Number.isFinite(v) && v > 0 && v <= 200)))) {
      alert("Every volatility must be above 0 and at most 200 % points.", { variant: "error", title: "Please Fix The Surface", fix: "Correct the cells outlined in red, then save." });
      return;
    }
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

  const curveTable: TableSpec = {
    id: "rate-curve-used",
    title: "Rate Curve As Read",
    note: "Tenors dated from the valuation date, with one more point a year past the longest expiry so Lower Maturity always resolves.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "rate", label: "Rate", kind: "percent", digits: 3 },
    ],
    rows: anchoredCurve(market.params.rateCurve, inputs.valuationDate, inputs.premiumRate, lastExpiry).map((p) => ({ date: p.date, rate: p.rate })),
  };

  const pricingTable: TableSpec = {
    id: "pricing-params",
    title: "Pricing Params Forward Grid",
    note: "Rows from the valuation month on. Older rows are never looked up by a live expiry, so they are not shown.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "bump", label: "Volatility Bump", kind: "percent" },
      { key: "inc", label: "Incremental Margin", kind: "percent" },
      { key: "full", label: "Full Margin", kind: "percent" },
      { key: "cost", label: "Margin Cost", kind: "percent" },
      { key: "fwd", label: "Forward Sell Rate", kind: "percent" },
    ],
    rows: live.surface.pricingParams.map((p) => ({ date: p.date.slice(0, 10), bump: p.volBump, inc: p.incMargin ?? null, full: p.fullMargin ?? null, cost: p.marginCost ?? null, fwd: p.fwdSellRate })),
  };

  const dividendTable: TableSpec = {
    id: "dividends",
    title: "Implied Dividends",
    note: u === "Nifty" ? "Points are in Sensex terms; Nifty scales them by the ratio of the reference prices." : "Future dates only. History before the valuation date is dropped.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Implied Dividend In Index Points", kind: "number", digits: 3 },
    ],
    rows: live.params.dividends.map((d) => ({ date: d.date.slice(0, 10), amount: d.amount })),
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Market Data" subtitle="The active vol surface, its surface parameters, the Pricing Params the Pricer reads, the rate curve and future dividends." />
      <Panel>
        <SectionTitle icon={Gauge}>Headline</SectionTitle>
        <TableCard
          spec={headlineTable("market-headline", "Headline", [
            { label: "Surface", value: surface.label, kind: "text" },
            { label: "Source", value: sourceLabel, kind: "text" },
            { label: "Expiry Rows", value: surface.expiries.length, kind: "integer" },
            { label: "Strike Change Columns", value: surface.moneyness.length, kind: "integer" },
            { label: "Reference Underlying Price", value: referencePriceForUnderlying(surface, u) || null, kind: "number" },
            { label: "Forward Sell Rate This Month", value: pricingRowForMonth(surface.pricingParams, inputs.valuationDate)?.fwdSellRate ?? null, kind: "percent" },
            { label: "Bid Or Offer", value: market.params.bidOffer === "O" ? "Offer" : "Bid", kind: "text" },
          ])}
        />
      </Panel>
      <Panel index={1}>
        <SectionTitle
          icon={Database}
          subtitle={`${surface.label} · ${sourceLabel}. Volatilities are in % points; expiries beyond ${lastExpiry ? formatDate(lastExpiry) : "the last row"} read the last row.`}
          aside={
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              {editing ? (
                <>
                  <button type="button" className="btn-animated btn-motion btn-primary inline-flex min-w-[180px] items-center justify-center gap-2 !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void save()} data-testid="save-surface">
                    <Check className="h-3.5 w-3.5" /> {busy ? "Saving" : "Save Surface"}
                  </button>
                  <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" onClick={() => setEditing(false)} data-testid="discard-surface">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-ghost btn-animated inline-flex min-w-[180px] items-center justify-center gap-2 text-xs"
                  onClick={() => {
                    setDraft(surface.volsPercent.map((row) => [...row]));
                    setEditing(true);
                  }}
                  data-testid="edit-surface"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Surface
                </button>
              )}
              <button type="button" className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs" disabled={uploading || editing} onClick={() => fileRef.current?.click()} data-testid="upload-surface">
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading" : "Upload Surface"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-animated inline-flex items-center gap-2 text-xs"
                disabled={editing}
                onClick={() =>
                  void downloadSurfaceFile(market, inputs.valuationDate, inputs.premiumRate).catch((err) =>
                    alert(err instanceof Error ? err.message : "The download failed.", { variant: "error", title: "Download Failed" }),
                  )
                }
                data-testid="download-surface"
              >
                <Download className="h-3.5 w-3.5" /> Download Surface
              </button>
            </div>
          }
        >
          Volatility Surface
        </SectionTitle>
        <VolSurfaceGrid
          surface={surface}
          underlying={u}
          asOf={inputs.valuationDate}
          editing={editing}
          draft={draft}
          onInvalid={(message) => alert(message, { variant: "error", title: "Wrong Input", fix: "Type a volatility in % points, such as 13.39." })}
          onCellChange={(r, c, v) =>
            setDraft((prev) => {
              const next = prev.map((row) => [...row]);
              if (next[r]) next[r]![c] = v;
              return next;
            })
          }
        />
        <p className="mt-3 flex flex-wrap items-center gap-2 font-ui text-xs text-muted">
          <FileSpreadsheet className="h-3.5 w-3.5 text-gold-dark" />
          New to the layout? Download Surface gives a file you can edit and upload back, or use the
          <a className="font-semibold text-gold-dark underline-offset-2 hover:underline" href="/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx" download data-testid="download-sample">
            sample file
          </a>
          .
        </p>
      </Panel>
      <SurfaceParamsEditor />
      <Panel index={3}>
        <SectionTitle icon={SlidersHorizontal}>Pricing Params Forward Grid</SectionTitle>
        <TableCard spec={pricingTable} />
      </Panel>
      <Panel index={4}>
        <SectionTitle icon={TrendingDown}>Rate Curve As Read</SectionTitle>
        <TableCard spec={curveTable} />
      </Panel>
      <Panel index={5}>
        <SectionTitle icon={TrendingDown}>Implied Dividends</SectionTitle>
        <TableCard spec={dividendTable} />
      </Panel>
    </div>
  );
}
