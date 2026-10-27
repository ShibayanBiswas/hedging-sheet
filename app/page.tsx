"use client";

import { RotateCcw } from "lucide-react";

import {
  CostsSection,
  ExpiriesSection,
  ProductTermsSection,
  RatesSection,
  SavedSetsSection,
  SpreadsSection,
  StrikesSection,
  UnderlyingSection,
  VolatilitySection,
} from "@/components/inputs/input-sections";
import { IssueList } from "@/components/ui/fields";
import { KpiRail } from "@/components/ui/kpi-rail";
import { PageIntro } from "@/components/ui/panel";
import { useDesk } from "@/lib/context/desk-provider";
import { fmtCrore, fmtNumber, fmtPercent } from "@/lib/format";

export default function InputsPage() {
  const { result, resetToWorkbook, recalculating } = useDesk();
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro
        title="Inputs"
        subtitle="Every field reprices the whole book live. Defaults equal the saved Aug 2026 accelerator."
        aside={
          <button type="button" className="btn-animated btn-motion btn-accent" onClick={resetToWorkbook} data-testid="reset-defaults">
            <span className="btn-shine" aria-hidden />
            <span className="relative z-10 inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset To Workbook Defaults
            </span>
          </button>
        }
      />
      {result.ok ? (
        <KpiRail
          recalculating={recalculating}
          items={[
            { label: "Actual Inbuilt", value: result.summary.actualInbuilt, format: (v) => fmtPercent(v) },
            { label: "Option Premium", value: result.summary.totalPremiumCr, format: (v) => `${fmtCrore(v)} Cr` },
            { label: "Maturity Payout", value: result.productDescription.maturityCr, format: (v) => `${fmtCrore(v)} Cr` },
            { label: "Margin Requirement", value: result.summary.margin, format: (v) => fmtPercent(v) },
            { label: "Hedge Quantity", value: result.dayOneVegaHedge.quantity, format: (v) => fmtNumber(v, 2) },
          ]}
        />
      ) : (
        <IssueList errors={result.errors} warnings={result.warnings} />
      )}
      <UnderlyingSection index={0} />
      <RatesSection index={1} />
      <ProductTermsSection index={2} />
      <ExpiriesSection index={3} />
      <StrikesSection index={4} />
      <SpreadsSection index={5} />
      <CostsSection index={6} />
      <VolatilitySection index={7} />
      <SavedSetsSection index={8} />
    </div>
  );
}
