import { AXES, type Axis, type Book } from '@/lib/types';
import { RIDGE_ALPHA, SENSITIVITY_MIN_RATINGS } from './constants';

// §5.8 Sensitivity learning: at ≥25 ratings, ridge regression of verdicts on
// the 12 book axes learns which dimensions drive this reader's joy. Refit on
// every new rating; surfaced openly ("What actually moves you") and used to
// re-weight similarity.

/** Solve Ax = b for symmetric positive-definite A via Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const p = M[col][col];
    if (Math.abs(p) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / p;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

export function fitSensitivities(
  samples: { book: Book; verdict: number }[],
): Record<Axis, number> | null {
  if (samples.length < SENSITIVITY_MIN_RATINGS) return null;
  const n = samples.length;
  const d = AXES.length;
  const X = samples.map((s) => AXES.map((a) => s.book.axes[a] ?? 0.5));
  const y = samples.map((s) => s.verdict);

  // Centre X and y (intercept absorbed), then (XᵀX + αI)β = Xᵀy.
  const xMean = AXES.map((_, j) => X.reduce((s, row) => s + row[j], 0) / n);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const Xc = X.map((row) => row.map((v, j) => v - xMean[j]));
  const yc = y.map((v) => v - yMean);

  const A: number[][] = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => {
      let s = 0;
      for (let r = 0; r < n; r++) s += Xc[r][i] * Xc[r][j];
      return s + (i === j ? RIDGE_ALPHA : 0);
    }),
  );
  const b = AXES.map((_, j) => {
    let s = 0;
    for (let r = 0; r < n; r++) s += Xc[r][j] * yc[r];
    return s;
  });

  const beta = solve(A, b);
  const out = {} as Record<Axis, number>;
  AXES.forEach((a, i) => (out[a] = beta[i]));
  return out;
}

/**
 * CONCRETIZED similarity re-weighting: axis i's component weight scales by
 * 1 + |β_i| / max|β| (range 1–2), applied to the axis block before
 * normalisation. Tags are untouched. Only active once sensitivities exist.
 */
export function axisMultipliers(sens: Record<Axis, number> | null): number[] | undefined {
  if (!sens) return undefined;
  const maxAbs = Math.max(...AXES.map((a) => Math.abs(sens[a])));
  if (maxAbs < 1e-9) return undefined;
  return AXES.map((a) => 1 + Math.abs(sens[a]) / maxAbs);
}
