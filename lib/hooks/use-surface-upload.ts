"use client";

import { useCallback, useState } from "react";

import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { useDesk } from "@/lib/context/desk-provider";

/** Hosted requests are capped near 4.5 MB on Vercel. */
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

/** Upload a vol surface workbook and report the outcome in a desk dialog, as the Unwinding desk does. */
export function useSurfaceUpload() {
  const { applyMarket } = useDesk();
  const { alert } = useDeskDialog();
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        alert("This workbook is over the 4.5 megabyte request limit of the hosted desk.", {
          variant: "error",
          title: "Upload Failed",
          fix: "Upload the Volatility Surface sample layout, which is well under the limit.",
        });
        return false;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/uploads/vol-surface", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          alert(Array.isArray(data.issues) ? data.issues.join("\n") : (data.error ?? "The workbook could not be read."), {
            variant: "error",
            title: "Upload Failed",
            fix: "Download the sample from Market Data and keep its Vol Surface and Surface Parameters layout.",
          });
          return false;
        }
        applyMarket({ surface: data.surface, params: data.params });
        alert(
          `${file.name} replaced the active surface: ${data.summary.expiries} expiry rows and ${data.summary.strikePercents} Strike Change columns.${data.persisted === false ? "\n\nThe desk database is unavailable, so the surface applies to this session only." : ""}\n\nRun the simulation again to price on it.`,
          { variant: data.persisted === false ? "warning" : "info", title: data.persisted === false ? "Upload Applied Locally" : "Upload Complete" },
        );
        return true;
      } catch (err) {
        alert(err instanceof Error ? err.message : "The upload failed.", { variant: "error", title: "Upload Failed" });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [alert, applyMarket],
  );

  return { upload, busy };
}
