"use client";

import { OctagonAlert, RotateCcw } from "lucide-react";

/** A tab that fails to render keeps the header, the tabs and the inputs, and offers another try. */
export default function TabError({ retry }: { retry: () => void }) {
  return (
    <div className="flex min-h-[52dvh] w-full items-center justify-center py-8" data-testid="tab-error" role="alert">
      <div className="glass hs-enter w-full max-w-xl rounded-2xl px-6 py-8 text-center">
        <span className="mx-auto inline-flex rounded-2xl border border-rose-400/40 p-3 text-rose-700">
          <OctagonAlert className="icon-lg" aria-hidden />
        </span>
        <h2 className="mt-4 font-bold tracking-tight text-ink text-h2">This Tab Could Not Be Shown</h2>
        <p className="mx-auto mt-2 max-w-md font-ui text-body text-muted">Your inputs and the last run are safe. Try the tab again.</p>
        <button type="button" className="btn-animated btn-motion btn-ghost btn-compact tab-action mx-auto mt-6" onClick={() => retry()} data-testid="tab-error-retry">
          <span className="relative z-10 inline-flex items-center gap-2">
            <RotateCcw className="icon-sm" aria-hidden />
            Try Again
          </span>
        </button>
      </div>
    </div>
  );
}
