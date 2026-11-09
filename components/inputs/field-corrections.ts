"use client";

import { useCallback } from "react";

import type { FieldCheck, FieldCorrection } from "@/components/ui/fields";
import { useDeskDialog } from "@/lib/context/desk-dialog-provider";
import { focusField, useDesk } from "@/lib/context/desk-provider";
import { correctNumber } from "@/lib/validation/corrections";
import { allowedRange, numberFieldRules } from "@/lib/validation/inputRules";

/** The note testid of a field: note-floorUnits, note-strikePercents-1. */
export const noteTestId = (field: string) => `note-${field.replace(/\./g, "-")}`;

/** Notes on the strike, spread, leg and term fields go when those rows are rebuilt: a new count, a paste or the other book. */
export const isStrikeNote = (f: string) => /^(strikePercents|strikeSides|participations|customLegs)\./.test(f) || f === "target" || f === "protection" || f === "floorLevel";

/**
 * The rules behind each typed number. A value that breaks one never reaches the inputs while it is typed; on leaving the
 * field or Enter it becomes the corrected value, through `apply`, with a note under the field until the field is edited
 * again. Only this field changes. Text that is no number goes back to the last value with a popup.
 * `field` names the rule, such as target or strikePercents.0, and `noteField` the note, when a row shares one.
 */
export function useCorrect() {
  const { inputs, setNote, correctionContext } = useDesk();
  const { alert } = useDeskDialog();
  return useCallback(
    (field: string, apply: (v: number | null) => void, noteField = field) => ({
      correct: (v: number) => correctNumber(inputs, field, v, correctionContext),
      onCorrect: (c: FieldCorrection) => {
        apply(c.value);
        setNote(noteField, c.note);
      },
      onEdit: () => setNote(noteField, null),
      onReject: (r: FieldCheck) => {
        const rule = numberFieldRules(inputs).find((x) => x.field === field);
        const range = r.range ?? (rule ? allowedRange(rule) : undefined);
        alert(r.message, {
          variant: "error",
          title: `${r.label || rule?.label || "Value"} Reverted`,
          fix: range ? `Allowed: ${range}. The field is back to its last valid value.` : "The field is back to its last valid value.",
          onClose: () => focusField(field),
        });
      },
    }),
    [alert, inputs, setNote, correctionContext],
  );
}
