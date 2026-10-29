"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useWriteFetch } from "@/lib/context/desk-key-provider";
import { useDesk } from "@/lib/context/desk-provider";
import type { PricingParams, VolSurface } from "@/lib/engine/types";
import { fmtIstTime } from "@/lib/format";
import { uploadProblem } from "@/lib/upload-limits";

/** The inline status row under the Market Data toolbar: the last save, upload or reload. */
export type MarketStatus = { tone: "ok" | "warn" | "error"; text: string };

type Preview = { file: File; surface: VolSurface; params: PricingParams | null; summary: { expiries: number; strikePercents: number } };

type SurfaceUploadValue = {
  busy: boolean;
  preview: Preview | null;
  status: MarketStatus | null;
  setStatus: (status: MarketStatus | null) => void;
  /** Checks the file, then shows the parsed surface for confirmation. Nothing is written yet. */
  choose: (file: File) => Promise<void>;
  confirm: () => Promise<void>;
  cancel: () => void;
};

const SurfaceUploadContext = createContext<SurfaceUploadValue | null>(null);

const issueOf = (data: { issues?: string[]; error?: string }) => data.issues?.[0] ?? data.error ?? "The Excel file could not be read.";

/** Upload flow shared by the header shortcut and Market Data: check, preview, confirm, then a toast and a status row. */
export function SurfaceUploadProvider({ children }: { children: ReactNode }) {
  const { applyMarket } = useDesk();
  const { toast } = useDeskDialog();
  const writeFetch = useWriteFetch();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<MarketStatus | null>(null);

  const send = useCallback(
    async (file: File, mode?: "preview") => {
      const form = new FormData();
      form.append("file", file);
      if (mode) form.append("mode", mode);
      return writeFetch("/api/uploads/vol-surface", { method: "POST", body: form });
    },
    [writeFetch],
  );

  const choose = useCallback(
    async (file: File) => {
      const problem = uploadProblem(file);
      if (problem) {
        setPreview(null);
        setStatus({ tone: "error", text: `Upload Refused: ${problem}` });
        return;
      }
      setBusy(true);
      try {
        const res = await send(file, "preview");
        if (!res) return;
        const data = await res.json();
        if (!res.ok) {
          setPreview(null);
          setStatus({ tone: "error", text: `Upload Refused: ${issueOf(data)}` });
          return;
        }
        setStatus(null);
        setPreview({ file, surface: data.surface, params: data.params, summary: data.summary });
      } catch {
        setStatus({ tone: "error", text: "Upload Refused: The Excel File Could Not Be Sent." });
      } finally {
        setBusy(false);
      }
    },
    [send],
  );

  const confirm = useCallback(async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await send(preview.file);
      if (!res) return;
      const data = await res.json();
      if (!res.ok) {
        setStatus({ tone: "error", text: `Upload Failed: ${issueOf(data)}` });
        return;
      }
      applyMarket({ surface: data.surface, params: data.params });
      const at = fmtIstTime(new Date().toISOString());
      const detail = `${preview.file.name} · ${data.summary.expiries} Expiry Rows · ${data.summary.strikePercents} Strike Columns · ${at}`;
      setStatus(data.persisted === false ? { tone: "warn", text: `Applied For This Session: ${detail}` } : { tone: "ok", text: `Saved To Desk Database: ${detail}` });
      toast(data.persisted === false ? "Surface Applied For This Session" : "Surface Uploaded");
      const deep = Number(data.summary.deepAdjusted ?? 0);
      if (deep > 0) toast(`Deep Volatility Set To The 55% Value On ${deep} ${deep === 1 ? "Row" : "Rows"}`);
      setPreview(null);
    } catch {
      setStatus({ tone: "error", text: "Upload Failed: Nothing Was Saved. Try Again." });
    } finally {
      setBusy(false);
    }
  }, [applyMarket, preview, send, toast]);

  const cancel = useCallback(() => setPreview(null), []);

  const value = useMemo(() => ({ busy, preview, status, setStatus, choose, confirm, cancel }), [busy, preview, status, choose, confirm, cancel]);
  return <SurfaceUploadContext.Provider value={value}>{children}</SurfaceUploadContext.Provider>;
}

export function useSurfaceUpload(): SurfaceUploadValue {
  const context = useContext(SurfaceUploadContext);
  if (!context) throw new Error("useSurfaceUpload needs SurfaceUploadProvider");
  return context;
}
