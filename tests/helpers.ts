export type Mismatch = { path: string; expected: unknown; actual: unknown; diff?: number };

export const REL_TOL = 1e-6;
export const ABS_TOL = 1e-6;

/** Gamma is a second difference of prices near 1e4, so double precision noise is about 1e-8 per option. */
const FIELD_ABS_TOL: Record<string, number> = {
  gamma: 1e-6,
  gammaContracts: 1e-2,
};

export function close(actual: number, expected: number, field = ""): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  const diff = Math.abs(actual - expected);
  const abs = FIELD_ABS_TOL[field] ?? ABS_TOL;
  return diff <= abs || diff <= REL_TOL * Math.abs(expected);
}

export class ParityCollector {
  mismatches: Mismatch[] = [];
  checked = 0;

  num(path: string, actual: number | null | undefined, expected: number | null | undefined, field = "") {
    if (expected == null) return;
    this.checked += 1;
    if (actual == null || !close(actual, expected, field)) {
      this.mismatches.push({
        path,
        expected,
        actual,
        diff: actual == null ? undefined : actual - expected,
      });
    }
  }

  eq(path: string, actual: unknown, expected: unknown) {
    if (expected == null) return;
    this.checked += 1;
    if (actual !== expected) this.mismatches.push({ path, expected, actual });
  }

  report(): string {
    return this.mismatches
      .slice(0, 60)
      .map((m) => `${m.path}: expected ${String(m.expected)} got ${String(m.actual)}${m.diff != null ? ` (diff ${m.diff.toExponential(3)})` : ""}`)
      .join("\n");
  }
}
