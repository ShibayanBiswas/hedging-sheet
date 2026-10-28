/**
 * Desk copy rules: words are spelled out, nothing sits in brackets, "/" is avoided, the % sign replaces the word
 * percent, and a cell with no value shows "-". The capitalisation rule lives in title-case.ts.
 */

/** The only shortforms the desk keeps. Every other word in capitals is written out in full. */
export const ALLOWED_SHORTFORMS = new Set(["NBFC", "BSE", "NSE", "IST", "OK", "UTC"]);

/** Ways a missing value must not be shown; the desk shows "-". */
const NOT_APPLICABLE_WORDS = /^(n\/?a|na|none|null|nil|—|–|--)$/i;

export type CopyKind =
  /** Titles, headers, tabs, buttons and field labels. */
  | "label"
  /** Sentences: subtitles, notes, hints and popup messages. */
  | "prose"
  /** The text of a table cell. */
  | "cell";

/** Rules a piece of copy breaks. Empty means it complies. */
export function copyViolations(text: string, kind: CopyKind): string[] {
  const out: string[] = [];
  const t = text.trim();
  if (/\bper\s?cent(age)?s?\b/i.test(t)) out.push('uses the word "percent" instead of %');
  if (/[()[\]{}]/.test(t)) out.push("has text in brackets");
  if (kind !== "prose" && t.includes("/")) out.push('uses "/"');
  if (kind === "prose" && (t.match(/\//g) ?? []).length > 1) out.push('uses "/" more than once');
  for (const word of t.match(/\b[A-Z]{2,}\b/g) ?? []) {
    if (!ALLOWED_SHORTFORMS.has(word)) out.push(`uses the shortform ${word}`);
  }
  if (kind === "cell") {
    if (!t) out.push("is empty; use - when no value applies");
    else if (NOT_APPLICABLE_WORDS.test(t)) out.push(`shows "${t}"; use - when no value applies`);
    if (/NaN|Infinity|undefined|Invalid Date|00-Jan-00/.test(t)) out.push(`shows "${t}"`);
  }
  return out;
}
