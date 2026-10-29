"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Download, FileSpreadsheet, Gauge, History, Pencil, Plus, RefreshCw, RotateCcw, Save, SlidersHorizontal, Trash2, TrendingDown, Upload, X } from "lucide-react";

import { VolSurfaceGrid } from "@/components/market/vol-surface-grid";
import { PairsTable, TableCard } from "@/components/ui/desk-table";
import { NumberInput, Segmented } from "@/components/ui/fields";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useWriteFetch } from "@/lib/context/desk-key-provider";
import { useDesk } from "@/lib/context/desk-provider";
import { useSurfaceUpload, type MarketStatus } from "@/lib/context/surface-upload-provider";
import { formatDate } from "@/lib/engine/dates";
import { anchoredCurve, rateCapSellingForward, resolvedRate } from "@/lib/engine/rates";
import type { BidOffer, PricingParams, VolSurface } from "@/lib/engine/types";
import { forwardMarket, pricingRowForMonth, referencePriceForUnderlying } from "@/lib/engine/vol-surface";
import { fmtIstTime, fmtPercent } from "@/lib/format";
import type { TableSpec } from "@/lib/tables";
import { downloadSurfaceFile } from "@/lib/workbook/excel-runtime";

const SAMPLE_FILE = "/samples/Hedging_Sheet_Vol_Surface_Sample.xlsx";
const now = () => fmtIstTime(new Date().toISOString());

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

/** One height for every toolbar button: 44 px, the touch target. */
function ToolButton({
  icon: Icon,
  children,
  primary,
  spin,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: typeof Pencil; primary?: boolean; spin?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={cn("md-btn btn-animated", primary ? "btn-primary" : "btn-ghost", className)} {...rest}>
      <Icon className={cn("icon-sm", spin && "animate-spin")} aria-hidden />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function StatusRow({ status, testId }: { status: MarketStatus | null; testId: string }) {
  if (!status) return null;
  return (
    <p className={cn("md-status", `md-status--${status.tone}`)} role={status.tone === "error" ? "alert" : "status"} data-testid={testId}>
      {status.text}
    </p>
  );
}

function SurfaceParamsEditor() {
  const { market, inputs, applyMarket, refreshDataset } = useDesk();
  const { toast } = useDeskDialog();
  const writeFetch = useWriteFetch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PricingParams | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<MarketStatus | null>(null);
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
    setStatus(null);
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
      setStatus({ tone: "error", text: "Not Saved: Rate Curve Tenors Must Rise Strictly From Zero Or More." });
      return;
    }
    if (Object.values(g).some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
      setStatus({ tone: "error", text: "Not Saved: Volatility Bump, The Margins And The Forward Sell Rate Must Be Between 0% And 100%." });
      return;
    }
    setBusy(true);
    try {
      const res = await writeFetch("/api/params", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ params, grid: g }) });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) {
        setStatus({ tone: "error", text: `Not Saved: ${data.issues?.[0] ?? data.error ?? "The Save Failed."}` });
        return;
      }
      applyMarket({ params: data.params, ...(data.surface ? { surface: data.surface } : {}) });
      cancel();
      if (data.persisted === false) {
        setStatus({ tone: "warn", text: `Applied For This Session: Surface Parameters For ${data.monthKey} · ${now()}` });
        toast("Surface Parameters Applied For This Session");
      } else {
        setStatus({ tone: "ok", text: `Saved To Desk Database: Surface Parameters For ${data.monthKey} · ${now()}` });
        toast(`Surface Parameters Saved For ${data.monthKey}`);
      }
    } catch {
      setStatus({ tone: "error", text: "Not Saved: The Desk Database Could Not Be Reached." });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    cancel();
    const fresh = await refreshDataset();
    setStatus(fresh ? { tone: "ok", text: `Reloaded From Desk Database · ${now()}` } : { tone: "error", text: "Not Reloaded: The Desk Database Could Not Be Reached." });
    if (fresh) toast("Surface Parameters Reloaded");
  };

  const pctCell = (value: number, onChange: (v: number) => void, testId: string) =>
    editing ? <NumberInput kind="percent" digits={2} suffix="%" value={value} onChange={onChange} testId={testId} /> : fmtPercent(value, 2);

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
      note: "Pricing Parameters M2, applied to the Dividends row.",
    },
    { label: "Rate Cap While Buying Forward", value: pctCell(params.rateCapBuyingForward, (v) => edit({ rateCapBuyingForward: v }), "param-cap-buying"), note: "Pricing Parameters N2." },
    {
      label: "Rate Cap While Selling Forward",
      value: fmtPercent(rateCapSellingForward(params, inputs.premiumRate), 2),
      note: "Pricing Parameters O2: the last rate curve point.",
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
    { label: "Rate Curve Points", value: `${params.rateCurve.length} Tenors`, note: "Edit them in the Rate Curve Points table." },
  ];

  return (
    <Panel index={2}>
      <SectionTitle
        icon={SlidersHorizontal}
        subtitle="Every value the Pricer reads from the pricing parameters. Saving writes them to this month in the desk database and to every row of the forward grid."
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <ToolButton icon={Save} primary disabled={busy} onClick={() => void save()} data-testid="save-params">
                  {busy ? "Saving" : "Save"}
                </ToolButton>
                <ToolButton icon={X} onClick={cancel} data-testid="cancel-params">
                  Cancel
                </ToolButton>
              </>
            ) : (
              <ToolButton icon={Pencil} onClick={start} data-testid="edit-params">
                Edit Parameters
              </ToolButton>
            )}
            <ToolButton icon={RotateCcw} onClick={() => void reset()} data-testid="reset-params">
              Reset
            </ToolButton>
          </div>
        }
      >
        Surface Parameters
      </SectionTitle>
      <StatusRow status={status} testId="params-status" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="relative min-w-0">
          <div className="data-table-premium-wrap desk-table-scroll" tabIndex={0} role="region" aria-label="Surface Parameters">
            <table className="data-table-premium min-w-full" data-testid="surface-params-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Used In</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td className="md-param-label font-semibold">{row.label}</td>
                    <td className="md-param-value">{row.value}</td>
                    <td className="font-ui text-muted">{row.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0">
          <div className="relative min-w-0">
            <div className="data-table-premium-wrap desk-table-scroll" tabIndex={0} role="region" aria-label="Rate Curve Points">
              <table className="data-table-premium min-w-full" data-testid="rate-curve-editor">
                <thead>
                  <tr>
                    <th className="text-right">Tenor In Years</th>
                    <th className="text-right">Rate %</th>
                    <th>Linked To Premium Growth Rate</th>
                    <th className="text-right">Rate Used %</th>
                    {editing ? <th className="text-right">Remove</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {params.rateCurve.map((p, i) => (
                    <tr key={i}>
                      <td className="text-right" data-kind="number">
                        {editing ? (
                          <div className="md-cell-input">
                            <NumberInput digits={2} value={p.years} onChange={(v) => editPoint(i, { years: v })} testId={`curve-years-${i}`} ariaLabel={`Tenor In Years, Point ${i + 1}`} />
                          </div>
                        ) : (
                          p.years.toFixed(2)
                        )}
                      </td>
                      <td className="text-right" data-kind="number">
                        {editing ? (
                          <div className="md-cell-input">
                            <NumberInput
                              digits={2}
                              value={p.ratePercent}
                              disabled={p.linkedToPremiumRate}
                              onChange={(v) => editPoint(i, { ratePercent: v })}
                              testId={`curve-rate-${i}`}
                              ariaLabel={`Rate %, Point ${i + 1}`}
                            />
                          </div>
                        ) : (
                          p.ratePercent.toFixed(2)
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-body">
                            <input type="checkbox" checked={Boolean(p.linkedToPremiumRate)} onChange={(e) => editPoint(i, { linkedToPremiumRate: e.target.checked })} data-testid={`curve-linked-${i}`} />
                            {p.linkedToPremiumRate ? "Yes" : "No"}
                          </label>
                        ) : p.linkedToPremiumRate ? (
                          "Yes"
                        ) : (
                          "No"
                        )}
                      </td>
                      <td className="text-right" data-kind="number">
                        {(resolvedRate(p, inputs.premiumRate) * 100).toFixed(2)}
                      </td>
                      {editing ? (
                        <td className="text-right">
                          <button
                            type="button"
                            className="md-icon-btn btn-ghost btn-animated"
                            disabled={params.rateCurve.length <= 1}
                            onClick={() => edit({ rateCurve: params.rateCurve.filter((_, j) => j !== i) })}
                            aria-label={`Remove Tenor ${p.years} Years`}
                            data-testid={`curve-remove-${i}`}
                          >
                            <Trash2 className="icon-sm" aria-hidden />
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
            <ToolButton
              icon={Plus}
              className="mt-3"
              onClick={() => {
                const last = params.rateCurve[params.rateCurve.length - 1];
                edit({ rateCurve: [...params.rateCurve, { years: (last?.years ?? 0) + 1, ratePercent: last?.ratePercent ?? 6.5, linkedToPremiumRate: false }] });
              }}
              data-testid="curve-add"
            >
              Add Tenor
            </ToolButton>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function HistoryToggle({ shown, onToggle, testId }: { shown: boolean; onToggle: () => void; testId: string }) {
  return (
    <ToolButton icon={History} aria-pressed={shown} onClick={onToggle} data-testid={testId}>
      {shown ? "Hide History" : "Show History"}
    </ToolButton>
  );
}

export default function MarketDataPage() {
  const { inputs, market, datasetSource, datasetLoading, datasetFetchedAt, datasetError, applyMarket, refreshDataset } = useDesk();
  const { toast } = useDeskDialog();
  const writeFetch = useWriteFetch();
  const upload = useSurfaceUpload();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number[][]>([]);
  const [invalidCells, setInvalidCells] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pricingHistory, setPricingHistory] = useState(false);
  const [dividendHistory, setDividendHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Market data shows Sensex terms until an underlying is chosen.
  const u = inputs.underlying || "Sensex";
  const surface = market.surface;
  const live = useMemo(() => forwardMarket(market, inputs.valuationDate), [market, inputs.valuationDate]);
  const lastExpiry = surface.expiries[surface.expiries.length - 1];
  const { setStatus } = upload;
  const firstLoad = datasetLoading && !datasetFetchedAt;

  const startEdit = () => {
    setDraft(surface.volsPercent.map((row) => [...row]));
    setInvalidCells(0);
    setEditing(true);
  };

  const save = async () => {
    if (invalidCells > 0) return;
    setBusy(true);
    try {
      const next: VolSurface = { ...surface, volsPercent: draft };
      const res = await writeFetch("/api/surface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) {
        setStatus({ tone: "error", text: `Not Saved: ${data.issues?.[0] ?? data.error ?? "The Save Failed."}` });
        return;
      }
      applyMarket({ surface: data.surface });
      setEditing(false);
      if (data.persisted) {
        setStatus({ tone: "ok", text: `Saved To Desk Database: ${surface.label} · ${now()}` });
        toast("Surface Saved");
      } else {
        setStatus({ tone: "warn", text: `Applied For This Session: ${surface.label} · ${now()}` });
        toast("Surface Applied For This Session");
      }
    } catch {
      setStatus({ tone: "error", text: "Not Saved: The Desk Database Could Not Be Reached." });
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setReloading(true);
    const fresh = await refreshDataset();
    setReloading(false);
    if (fresh) {
      setStatus({ tone: "ok", text: `Reloaded From Desk Database · ${now()}` });
      toast("Surface Reloaded");
    } else setStatus({ tone: "error", text: "Not Reloaded: The Desk Database Could Not Be Reached." });
  };

  const downloadCurrent = () =>
    void downloadSurfaceFile(market, inputs.valuationDate, inputs.premiumRate).catch(() =>
      setStatus({ tone: "error", text: "Download Failed: The Surface File Could Not Be Built." }),
    );

  const downloadSample = () => {
    const a = document.createElement("a");
    a.href = SAMPLE_FILE;
    a.download = SAMPLE_FILE.split("/").pop()!;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const curveTable: TableSpec = {
    id: "rate-curve-used",
    title: "Rate Curve As Read",
    note: "Tenors dated from the valuation date, with one more point a year past the longest expiry so Lower Maturity always resolves.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "rate", label: "Rate %", kind: "number", digits: 2 },
    ],
    rows: anchoredCurve(market.params.rateCurve, inputs.valuationDate, inputs.premiumRate, lastExpiry).map((p) => ({ date: p.date, rate: p.rate * 100 })),
  };

  const pricingRows = pricingHistory ? surface.pricingParams : live.surface.pricingParams.filter((p) => p.date.slice(0, 10) >= inputs.valuationDate);
  const pricingTable: TableSpec = {
    id: "pricing-params",
    title: "Pricing Parameters By Expiry",
    note: pricingHistory ? "Every row in the surface file, history included." : "Rows from the valuation date on. Show History lists the earlier rows.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "bump", label: "Volatility Bump", kind: "percent" },
      { key: "inc", label: "Incremental Margin", kind: "percent" },
      { key: "full", label: "Full Margin", kind: "percent" },
      { key: "cost", label: "Margin Cost", kind: "percent" },
      { key: "fwd", label: "Forward Sell Rate", kind: "percent" },
    ],
    rows: pricingRows.map((p) => ({ date: p.date.slice(0, 10), bump: p.volBump, inc: p.incMargin ?? null, full: p.fullMargin ?? null, cost: p.marginCost ?? null, fwd: p.fwdSellRate })),
  };

  const dividendRows = dividendHistory ? market.params.dividends : live.params.dividends.filter((d) => d.date.slice(0, 10) >= inputs.valuationDate);
  const dividendTable: TableSpec = {
    id: "dividends",
    title: "Implied Dividends",
    note:
      u === "Nifty"
        ? "Points are in Sensex terms; Nifty scales them by the ratio of the reference prices."
        : dividendHistory
          ? "Every dividend in the surface file, history included."
          : "Future dates only. Show History lists the earlier dividends.",
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "amount", label: "Implied Dividend In Index Points", kind: "number", digits: 3 },
    ],
    rows: dividendRows.map((d) => ({ date: d.date.slice(0, 10), amount: d.amount })),
  };

  const pricingToggle = <HistoryToggle shown={pricingHistory} onToggle={() => setPricingHistory((v) => !v)} testId="pricing-history-toggle" />;
  const dividendToggle = <HistoryToggle shown={dividendHistory} onToggle={() => setDividendHistory((v) => !v)} testId="dividends-history-toggle" />;
  const preview = upload.preview;
  const previewVols = preview ? preview.surface.volsPercent.flat().filter((v) => Number.isFinite(v)) : [];

  return (
    <div className="md-page flex w-full flex-col gap-4">
      <PageIntro title="Market Data" subtitle="The active volatility surface, its surface parameters, the pricing parameters the Pricer reads, the rate curve and future dividends." />
      <Panel>
        <SectionTitle icon={Gauge}>Headline</SectionTitle>
        <PairsTable
          testId="table-market-headline"
          title="Headline"
          items={[
            { label: "Surface", value: surface.label, kind: "text" },
            { label: "Source", value: datasetSource === "database" ? "Desk Database" : "Built In Surface", kind: "text" },
            { label: "Fetched At", value: datasetFetchedAt ? fmtIstTime(datasetFetchedAt) : null, kind: "text" },
            { label: "Bid Or Offer", value: market.params.bidOffer === "O" ? "Offer" : "Bid", kind: "text" },
            { label: "Expiry Rows", value: surface.expiries.length, kind: "integer" },
            { label: "Strike Columns", value: surface.moneyness.length, kind: "integer" },
            { label: `Reference ${u} Price`, value: referencePriceForUnderlying(surface, u) || null, kind: "number" },
            { label: "Forward Sell Rate This Month", value: pricingRowForMonth(surface.pricingParams, inputs.valuationDate)?.fwdSellRate ?? null, kind: "percent" },
          ]}
        />
      </Panel>
      <Panel index={1}>
        <SectionTitle icon={FileSpreadsheet} subtitle={`${surface.label}. Volatility In %. Expiries beyond ${lastExpiry ? formatDate(lastExpiry) : "the last row"} read the last row.`}>
          Volatility Surface
        </SectionTitle>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xlsm,.xls"
          className="hidden"
          data-testid="surface-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload.choose(file);
          }}
        />
        <div className="md-toolbar" role="toolbar" aria-label="Volatility Surface" data-testid="surface-toolbar">
          {editing ? (
            <>
              <ToolButton icon={Check} primary disabled={busy || invalidCells > 0} onClick={() => void save()} data-testid="save-surface">
                {busy ? "Saving" : "Save Surface"}
              </ToolButton>
              <ToolButton icon={X} onClick={() => setEditing(false)} data-testid="discard-surface">
                Cancel
              </ToolButton>
            </>
          ) : (
            <ToolButton icon={Pencil} disabled={firstLoad || upload.busy || Boolean(preview)} onClick={startEdit} data-testid="edit-surface">
              Edit Surface
            </ToolButton>
          )}
          <ToolButton icon={Upload} disabled={upload.busy || editing} onClick={() => fileRef.current?.click()} data-testid="upload-surface">
            {upload.busy ? "Uploading" : "Upload Surface"}
          </ToolButton>
          <ToolButton icon={Download} disabled={editing || firstLoad} onClick={downloadCurrent} data-testid="download-surface">
            Download Current Surface
          </ToolButton>
          <ToolButton icon={FileSpreadsheet} onClick={downloadSample} data-testid="download-sample">
            Download Sample
          </ToolButton>
          <ToolButton icon={RefreshCw} spin={reloading} disabled={reloading || editing} onClick={() => void reload()} data-testid="reload-surface">
            {reloading ? "Reloading" : "Reload From Desk Database"}
          </ToolButton>
        </div>
        <StatusRow status={upload.status} testId="market-status" />
        {editing && invalidCells > 0 ? (
          <p className="md-status md-status--error" role="alert" data-testid="surface-invalid">
            {invalidCells} {invalidCells === 1 ? "Cell Needs" : "Cells Need"} A Volatility Above 0 And At Most 200. Save Is Off Until Every Cell Is Valid.
          </p>
        ) : null}
        {preview ? (
          <div className="md-preview" role="region" aria-label="Upload Preview" data-testid="upload-preview">
            <p className="font-ui text-body font-semibold text-ink">Upload Preview: Nothing Is Saved Until You Confirm</p>
            <PairsTable
              testId="table-upload-preview"
              title="Upload Preview"
              items={[
                { label: "File", value: preview.file.name, kind: "text" },
                { label: "Month", value: preview.surface.label.replace(" Volatility Surface", ""), kind: "text" },
                { label: "Expiry Rows", value: preview.summary.expiries, kind: "integer" },
                { label: "Strike Columns", value: preview.summary.strikePercents, kind: "integer" },
                { label: "First Expiry", value: preview.surface.expiries[0]?.slice(0, 10) ?? null, kind: "date" },
                { label: "Last Expiry", value: preview.surface.expiries.at(-1)?.slice(0, 10) ?? null, kind: "date" },
                { label: "Lowest Volatility %", value: previewVols.length ? Math.min(...previewVols) : null, kind: "number" },
                { label: "Highest Volatility %", value: previewVols.length ? Math.max(...previewVols) : null, kind: "number" },
              ]}
            />
            <VolSurfaceGrid surface={preview.surface} asOf="" testId="preview-grid" />
            <div className="md-toolbar">
              <ToolButton icon={Check} primary disabled={upload.busy} onClick={() => void upload.confirm()} data-testid="confirm-upload">
                {upload.busy ? "Uploading" : "Confirm Upload"}
              </ToolButton>
              <ToolButton icon={X} disabled={upload.busy} onClick={upload.cancel} data-testid="cancel-upload">
                Cancel Upload
              </ToolButton>
            </div>
          </div>
        ) : null}
        <VolSurfaceGrid
          key={editing ? "editing" : "viewing"}
          surface={surface}
          asOf={inputs.valuationDate}
          editing={editing}
          draft={draft}
          loading={firstLoad}
          error={datasetError}
          onInvalidChange={setInvalidCells}
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
      <Panel index={3} className="md-history">
        <SectionTitle icon={SlidersHorizontal} aside={pricingToggle}>
          Pricing Parameters By Expiry
        </SectionTitle>
        <TableCard spec={pricingTable} />
      </Panel>
      <Panel index={4}>
        <SectionTitle icon={TrendingDown}>Rate Curve As Read</SectionTitle>
        <TableCard spec={curveTable} />
      </Panel>
      <Panel index={5} className="md-history">
        <SectionTitle icon={TrendingDown} aside={dividendToggle}>
          Implied Dividends
        </SectionTitle>
        <TableCard spec={dividendTable} />
      </Panel>
    </div>
  );
}
