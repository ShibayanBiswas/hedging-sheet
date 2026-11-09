"use client";

import { useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { ClipboardPaste, Plus, X } from "lucide-react";

import { BulkEditDialog } from "@/components/inputs/bulk-edit-dialog";
import { isStrikeNote, noteTestId, useCorrect } from "@/components/inputs/field-corrections";
import { ChoiceSelect, CountPicker, FieldNote, FieldRow, NumberInput, Segmented } from "@/components/ui/fields";
import { useDesk } from "@/lib/context/desk-provider";
import { MAX_LEGS, MIN_LEGS, percentFromLevel, rupeeStrike, startLevel } from "@/lib/engine/structure";
import type { BookMode, CustomLeg, OptionType, StrikeSide } from "@/lib/engine/types";
import { parseLegPaste } from "@/lib/inputs/bulk";
import { correctNumber } from "@/lib/validation/corrections";
import { addLeg, legsText, removeLeg, setLegCount, switchBook, TEMPLATES, type TemplateId } from "@/lib/inputs/custom-legs";
import type { DeskLeg } from "@/lib/inputs/draft";
import { fmtNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

const BOOKS: Array<{ value: BookMode; label: string }> = [
  { value: "product", label: "Product Payoff" },
  { value: "custom", label: "Custom Option Book" },
];
const OPTION_TYPES: Array<{ value: OptionType; label: string }> = [
  { value: "P", label: "Put" },
  { value: "C", label: "Call" },
];
const SIDES: Array<{ value: StrikeSide; label: string }> = [
  { value: "B", label: "Buy" },
  { value: "S", label: "Sell" },
];

/** What the Strikes And Spreads group hands its body: the inline error of a field. */
type FieldTools = {
  errorFor: (field: string) => string | null;
};

const isLegNote = (f: string) => f.startsWith("customLegs.");

/** Product Payoff prices the product from its terms; Custom Option Book prices the legs typed below. Each keeps its own entries. */
export function BookField() {
  const { mode, inputs, setInputs, clearNotes } = useDesk();
  return (
    <FieldRow label="Book" tip="Product Payoff Prices The Product From Its Terms; Custom Option Book Prices Any Legs You Type">
      <Segmented<BookMode>
        label="Book"
        value={inputs.bookMode ?? "product"}
        options={BOOKS}
        testId="book-mode"
        onChange={(next) => {
          clearNotes(isStrikeNote);
          setInputs((prev) => switchBook(prev, next, mode));
        }}
      />
    </FieldRow>
  );
}

/** The header of the group in Custom: the leg count chip. */
export function CustomBookRule() {
  const { inputs } = useDesk();
  const n = (inputs.customLegs ?? []).length;
  return (
    <span className="hs-chip inputs-card-rule" data-testid="custom-book-chip">
      Custom Option Book · {n} {n === 1 ? "Leg" : "Legs"}
    </span>
  );
}

const legText = (legs: DeskLeg[]) =>
  legs
    .map((l) => [Number.isFinite(l.percent) ? l.percent : "", l.optionType === "C" ? "Call" : l.optionType === "P" ? "Put" : "", l.side === "B" ? "Buy" : l.side === "S" ? "Sell" : "", Number.isFinite(l.quantity) ? l.quantity : ""].join("\t"))
    .join("\n");

/** Add Leg and the Bulk Edit Strikes paste of whole legs. */
export function CustomBookActions() {
  const { mode, inputs, setInputs, clearNotes } = useDesk();
  const [bulk, setBulk] = useState(false);
  const legs = inputs.customLegs ?? [];
  return (
    <>
      <button
        type="button"
        className="btn-animated btn-motion btn-ghost btn-compact"
        data-testid="custom-add-leg"
        disabled={legs.length >= MAX_LEGS}
        title={legs.length >= MAX_LEGS ? `At Most ${MAX_LEGS} Legs` : "Add A Leg At The End"}
        onClick={() => setInputs((prev) => ({ customLegs: addLeg(prev.customLegs ?? [], mode) }))}
      >
        <span className="relative z-10 inline-flex items-center gap-1">
          <Plus className="icon-xs" aria-hidden />
          Add Leg
        </span>
      </button>
      <button type="button" className="btn-animated btn-motion btn-ghost btn-compact" data-testid="strikes-bulk" onClick={() => setBulk(true)}>
        <span className="relative z-10 inline-flex items-center gap-1">
          <ClipboardPaste className="icon-xs" aria-hidden />
          Bulk Edit
        </span>
      </button>
      <BulkEditDialog<CustomLeg>
        open={bulk}
        title="Bulk Edit Strikes"
        hint={`Paste ${MIN_LEGS} to ${MAX_LEGS} legs from a sheet, in any order: Level %, then Put or Call, then Buy or Sell, then the Quantity, 1 when left out.`}
        placeholder={"105\tCall\tSell\t1\n100\tCall\tBuy\t1"}
        initialText={legText(legs)}
        columns={["Level %", "Option Type", "Buy Or Sell", "Quantity"]}
        parse={parseLegPaste}
        render={(l) => [`${l.percent}%`, l.optionType === "C" ? "Call" : "Put", l.side === "S" ? "Sell" : "Buy", fmtNumber(l.quantity, 2)]}
        onApply={(rows) => {
          clearNotes(isLegNote);
          setInputs({ customLegs: rows });
        }}
        onClose={() => setBulk(false)}
        testId="bulk-strikes"
      />
    </>
  );
}

/** The Custom Option Book in Strikes And Spreads: the book switch, the leg count and templates, then one row per leg. */
export function CustomBookBody({ errorFor }: FieldTools) {
  const { mode, inputs, setInputs, notes, clearNotes, correctionContext } = useDesk();
  const fix = useCorrect();
  const reduce = useReducedMotion();
  const legs = inputs.customLegs ?? [];
  const start = Number.isFinite(inputs.spot) && Number.isFinite(inputs.startLevelUplift) ? startLevel(inputs) : NaN;
  const [applied, setApplied] = useState<{ id: TemplateId; key: string } | null>(null);
  // The note names the template only while the legs are still the ones it filled.
  const template = applied && JSON.stringify(legs) === applied.key ? TEMPLATES.find((t) => t.id === applied.id) : undefined;
  const setLeg = (i: number, patch: Partial<DeskLeg>) => setInputs((prev) => ({ customLegs: (prev.customLegs ?? []).map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  return (
    <>
      <div className="inputs-grid">
        <BookField />
        <FieldRow label="Number Of Legs" error={errorFor("legCount")}>
          <CountPicker
            label="Number Of Legs"
            value={legs.length || NaN}
            min={MIN_LEGS}
            max={MAX_LEGS}
            testId="input-legCount"
            invalid={Boolean(errorFor("legCount"))}
            onChange={(c) => {
              clearNotes(isLegNote);
              setInputs((prev) => ({ customLegs: setLegCount(prev.customLegs ?? [], c, mode) }));
            }}
          />
        </FieldRow>
        <FieldRow label="Template" tip="Fills The Legs Around 100% Of The Start Level, With 5% Wings And Quantity 1">
          <ChoiceSelect<TemplateId>
            value=""
            placeholder="Pick A Template"
            testId="custom-template"
            options={TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(id) => {
              const t = TEMPLATES.find((x) => x.id === id)!;
              const filled = t.legs.map((l) => ({ ...l }));
              clearNotes(isLegNote);
              setInputs({ customLegs: filled });
              setApplied({ id, key: JSON.stringify(filled) });
            }}
          />
        </FieldRow>
      </div>
      {legs.length ? (
        <div className="relative mt-2 min-w-0">
          <div className="desk-table-scroll inputs-table-rail" tabIndex={0} role="region" aria-label="Legs Table">
            <div className="inputs-table" role="table" aria-label="Legs" data-testid="custom-legs-table">
              <div className="strike-row strike-head" role="row">
                {["Leg", "Level %", "Level In Points", "Option Type", "Buy Or Sell", "Quantity"].map((h) => (
                  <span key={h} role="columnheader">
                    {h}
                  </span>
                ))}
              </div>
              <AnimatePresence initial={false}>
                {legs.map((leg, i) => {
                  const error = errorFor(`customLegs.${i}.percent`) ?? errorFor(`customLegs.${i}.optionType`) ?? errorFor(`customLegs.${i}.side`) ?? errorFor(`customLegs.${i}.quantity`);
                  const level = Number.isFinite(start) && Number.isFinite(leg.percent) ? rupeeStrike(start, leg.percent) : NaN;
                  return (
                    <m.div
                      key={i}
                      role="row"
                      data-testid={`leg-row-${i}`}
                      className={cn("strike-row", error && "strike-row--error")}
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span className="flex items-center justify-between gap-1 font-ui text-body font-bold text-ink" role="cell">
                        <span className="whitespace-nowrap">Leg {i + 1}</span>
                        <button
                          type="button"
                          aria-label={`Remove Leg ${i + 1}`}
                          title={legs.length <= MIN_LEGS ? "A Book Keeps At Least One Leg" : `Remove Leg ${i + 1}`}
                          data-testid={`custom-remove-leg-${i}`}
                          disabled={legs.length <= MIN_LEGS}
                          className="glass-control inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => {
                            clearNotes(isLegNote);
                            setInputs((prev) => ({ customLegs: removeLeg(prev.customLegs ?? [], i) }));
                          }}
                        >
                          <X className="icon-xs" aria-hidden />
                        </button>
                      </span>
                      <span role="cell">
                        <NumberInput
                          value={leg.percent}
                          digits={3}
                          suffix="%"
                          ariaLabel={`Leg ${i + 1} Level %`}
                          testId={`input-customLegs-${i}-percent`}
                          invalid={Boolean(errorFor(`customLegs.${i}.percent`))}
                          placeholder="-"
                          onChange={(v) => setLeg(i, { percent: v })}
                          onBlankChange={() => setLeg(i, { percent: NaN })}
                          {...fix(`customLegs.${i}.percent`, (v) => setLeg(i, { percent: v ?? NaN }))}
                        />
                      </span>
                      <span role="cell">
                        <NumberInput
                          value={level}
                          digits={0}
                          disabled={!Number.isFinite(start)}
                          ariaLabel={`Leg ${i + 1} Level In Points`}
                          testId={`input-customLegs-${i}-level`}
                          placeholder="-"
                          onChange={(v) => setLeg(i, { percent: percentFromLevel(v, start) })}
                          {...fix(`customLegs.${i}.percent`, (v) => setLeg(i, { percent: v ?? NaN }))}
                          correct={(points) => correctNumber(inputs, `customLegs.${i}.percent`, percentFromLevel(points, start), correctionContext)}
                        />
                      </span>
                      <span role="cell">
                        <Segmented<OptionType>
                          label={`Leg ${i + 1} Option Type`}
                          value={leg.optionType}
                          options={OPTION_TYPES}
                          testId={`input-customLegs-${i}-optionType`}
                          invalid={Boolean(errorFor(`customLegs.${i}.optionType`))}
                          onChange={(v) => setLeg(i, { optionType: v })}
                        />
                      </span>
                      <span role="cell">
                        <Segmented<StrikeSide>
                          label={`Leg ${i + 1} Buy Or Sell`}
                          value={leg.side}
                          options={SIDES}
                          testId={`input-customLegs-${i}-side`}
                          invalid={Boolean(errorFor(`customLegs.${i}.side`))}
                          onChange={(v) => setLeg(i, { side: v })}
                        />
                      </span>
                      <span role="cell">
                        <NumberInput
                          value={leg.quantity}
                          digits={2}
                          ariaLabel={`Leg ${i + 1} Quantity`}
                          testId={`input-customLegs-${i}-quantity`}
                          invalid={Boolean(errorFor(`customLegs.${i}.quantity`))}
                          placeholder="-"
                          onChange={(v) => setLeg(i, { quantity: v })}
                          onBlankChange={() => setLeg(i, { quantity: NaN })}
                          {...fix(`customLegs.${i}.quantity`, (v) => setLeg(i, { quantity: v ?? NaN }))}
                        />
                      </span>
                      <FieldNote note={notes[`customLegs.${i}.percent`]} testId={noteTestId(`customLegs.${i}.percent`)} className="strike-row-note" />
                      <FieldNote note={notes[`customLegs.${i}.quantity`]} testId={noteTestId(`customLegs.${i}.quantity`)} className="strike-row-note" />
                      {error ? (
                        <p className="hs-error strike-row-error" role="alert" data-testid={`leg-error-${i}`}>
                          {error}
                        </p>
                      ) : null}
                    </m.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <p className="inputs-slim-row mt-2" data-testid="legs-empty">
          Select Number Of Legs
        </p>
      )}
      <p className="hint mt-2 font-ui" data-testid="custom-book-note">
        {template
          ? `${template.label}: ${legsText(template.legs)}.`
          : "Each leg is priced as typed: a call is a real call, with no futures leg. Quantity is in units per start level of notional, and Buy Or Sell gives its sign."}
      </p>
    </>
  );
}
