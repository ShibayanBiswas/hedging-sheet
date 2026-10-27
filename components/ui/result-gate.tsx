"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { IssueList } from "@/components/ui/fields";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import type { HedgingResult } from "@/lib/engine/types";

/** Output pages render only when the inputs price; otherwise the blocking errors are listed. */
export function ResultGate({ children }: { children: (result: HedgingResult, recalculating: boolean) => ReactNode }) {
  const { result, recalculating } = useDesk();
  if (!result.ok) {
    return (
      <Panel>
        <SectionTitle icon={AlertTriangle}>Pricing Is Blocked</SectionTitle>
        <p className="mb-3 font-ui text-sm text-muted">The book cannot be priced until these inputs are fixed.</p>
        <IssueList errors={result.errors} warnings={result.warnings} />
        <Link href="/" className="btn-animated btn-motion btn-accent mt-4 inline-flex">
          <span className="relative z-10">Go To Inputs</span>
        </Link>
      </Panel>
    );
  }
  return <>{children(result, recalculating)}</>;
}
