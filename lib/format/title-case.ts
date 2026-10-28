/**
 * Desk capitalisation rule: every word starts with a capital letter, small joining words included.
 * Units, symbols, numbers, dates and the BSE and NSE tickers are left as written.
 */

const ALLOWED_TOKENS = new Set(["%", "₹", "Cr", "L", "BSE", "NSE"]);

/** Punctuation and separators carry no letters to check. */
const PUNCTUATION_ONLY = /^[\s·•:;,.!?/\\()[\]{}"'“”‘’…×+\-−–—=<>|&*#@~^]+$/u;

/** Numbers, % values, ₹ amounts, multipliers and dates such as 28-Oct-2026 or 2026-10. */
const NUMERIC = /^[₹+\-−(]*[\d.,]+[%x)]*$|^[₹+\-−]?\d[\d.,]*(%|x|L|Cr)?$|^\d{1,2}-[A-Z][a-z]{2}-\d{4}$|^\d{4}-\d{2}(-\d{2})?$/u;

/** Strip surrounding punctuation so "(Sensex)" or "Strikes," is judged on its word. */
function core(token: string): string {
  return token.replace(/^[\s·•:;,.!?"'“”‘’(\[{]+|[\s·•:;,.!?"'“”‘’)\]}]+$/gu, "");
}

export function isAllowedToken(token: string): boolean {
  const word = core(token);
  if (!word || PUNCTUATION_ONLY.test(token)) return true;
  return ALLOWED_TOKENS.has(word) || NUMERIC.test(word);
}

/** True when the word starts with a capital, a digit, ₹, % or a minus, or is allowlisted. */
export function isTitleCaseWord(token: string): boolean {
  if (isAllowedToken(token)) return true;
  return /^[A-Z0-9₹%\-−+]/u.test(core(token));
}

/** Words of a string that break the rule. Empty means the string complies. */
export function titleCaseViolations(text: string): string[] {
  return text
    .split(/\s+/u)
    .filter(Boolean)
    .filter((token) => !isTitleCaseWord(token));
}

export function isTitleCase(text: string): boolean {
  return titleCaseViolations(text).length === 0;
}

/** Capitalise the first letter of every word, keeping the rest of each word as written. */
export function titleCase(text: string): string {
  return text.replace(/(^|[\s(\-/·])([a-z])/gu, (_m, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`);
}
