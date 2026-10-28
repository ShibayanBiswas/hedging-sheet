"use client";

import { BarChart3, Gauge } from "lucide-react";

import { TableCard } from "@/components/ui/desk-table";
import { PageIntro, Panel, SectionTitle } from "@/components/ui/panel";
import { ResultGate } from "@/components/ui/result-gate";
import { marginHeadline, marginTable } from "@/lib/tables";

export default function MarginPage() {
  return (
    <div className="flex w-full flex-col gap-4">
      <PageIntro title="Mark To Market And Margin Requirement" subtitle="Cash the desk posts as the underlying moves from −50% to +20%." />
      <ResultGate>
        {(r) => (
          <>
            <Panel>
              <SectionTitle icon={Gauge}>Headline</SectionTitle>
              <TableCard spec={marginHeadline(r)} />
            </Panel>
            <Panel index={1}>
              <SectionTitle icon={BarChart3}>Stress Grid</SectionTitle>
              <TableCard spec={marginTable(r)} />
            </Panel>
          </>
        )}
      </ResultGate>
    </div>
  );
}
