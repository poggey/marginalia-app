import { AXES, type Axis, type Book } from '@/lib/types';
import { l2Normalise } from './vector';

// §5.3 Compare: T = signed weighted centroid — aversions (negative weights)
// push T away. sim(c) = cos(T, x_c).

export interface WeightedEntry {
  vector: number[];
  weight: number;
}

export function tasteVector(entries: WeightedEntry[], dim: number): number[] {
  const t = new Array<number>(dim).fill(0);
  for (const { vector, weight } of entries) {
    for (let i = 0; i < dim; i++) t[i] += weight * vector[i];
  }
  return l2Normalise(t);
}

/**
 * Readable axis-space taste profile: weighted mean of encountered books' raw
 * axes using positive weights only. Feeds reasoning ("your usual pace") and
 * the onboarding mini-polygon — not the similarity pipeline.
 */
export function tasteAxes(
  entries: { book: Book; weight: number }[],
): Record<Axis, number> | null {
  const positive = entries.filter((e) => e.weight > 0);
  if (!positive.length) return null;
  const total = positive.reduce((s, e) => s + e.weight, 0);
  const out = {} as Record<Axis, number>;
  for (const a of AXES) {
    out[a] = positive.reduce((s, e) => s + e.weight * (e.book.axes[a] ?? 0.5), 0) / total;
  }
  return out;
}
