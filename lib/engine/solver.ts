export type SolveResult = { root: number; iterations: number; converged: boolean };

/**
 * Brent's method with a bisection fallback. Expands the bracket outward when the
 * starting bounds do not straddle a root.
 */
export function brentSolve(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tol = 1e-10,
  maxIter = 200,
): SolveResult {
  let a = lo;
  let b = hi;
  let fa = f(a);
  let fb = f(b);
  let iterations = 0;
  let width = Math.max(Math.abs(b - a), 1);
  while (fa * fb > 0 && iterations < 60) {
    width *= 2;
    a = lo - width;
    b = hi + width;
    fa = f(a);
    fb = f(b);
    iterations += 1;
  }
  if (fa * fb > 0) return { root: NaN, iterations, converged: false };
  if (fa === 0) return { root: a, iterations, converged: true };
  if (fb === 0) return { root: b, iterations, converged: true };

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let i = 0; i < maxIter; i++) {
    iterations += 1;
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return { root: b, iterations, converged: true };
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      const min1 = 3 * xm * q - Math.abs(tol1 * q);
      const min2 = Math.abs(e * q);
      if (2 * p < Math.min(min1, min2)) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return { root: b, iterations, converged: Math.abs(fb) < 1e-6 };
}
