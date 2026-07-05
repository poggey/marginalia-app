import { AXES } from '@/lib/types';
import type { Book } from '@/lib/types';
import { AXIS_NEUTRAL, AXIS_WEIGHT } from './constants';

// §5.1 Represent: x_b = [12 tone axes | TF-IDF theme tags], L2-normalised,
// axes ×2 vs tags. The representation is opaque to the rest of the pipeline.

export interface VectorSpace {
  vocab: string[];        // sorted theme-tag vocabulary over the corpus
  idf: number[];          // per-vocab smoothed IDF
  dim: number;            // 12 + vocab.length
}

export function buildSpace(books: Book[]): VectorSpace {
  const df = new Map<string, number>();
  for (const b of books) {
    for (const tag of new Set(b.themeTags)) {
      df.set(tag, (df.get(tag) ?? 0) + 1);
    }
  }
  const vocab = [...df.keys()].sort();
  const n = books.length;
  // Smoothed IDF (deterministic; tags are binary per book so TF = 1).
  const idf = vocab.map((t) => Math.log((1 + n) / (1 + (df.get(t) ?? 0))) + 1);
  return { vocab, idf, dim: AXES.length + vocab.length };
}

export function l2Normalise(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v.slice() : v.map((x) => x / norm);
}

/**
 * CONCRETIZED: "axes ×2 vs tags" is applied blockwise — each block is
 * L2-normalised on its own, the axis block is then weighted ×2, and the
 * concatenation is L2-normalised. This keeps the ×2 meaningful regardless of
 * vocabulary size or raw IDF magnitude (otherwise large IDFs silently
 * out-weigh the axes and invert the spec's intent).
 *
 * axisMultipliers (optional) come from sensitivity learning (§5.8): per-axis
 * factors re-weighting similarity once ≥25 ratings exist. Absent → 1.
 */
export function bookVector(
  book: Book,
  space: VectorSpace,
  axisMultipliers?: number[],
): number[] {
  // Centred at neutral (see AXIS_NEUTRAL): a blank profile contributes a zero
  // axis block instead of a false 90% similarity to everything.
  const axisBlock = AXES.map(
    (a, i) => ((book.axes[a] ?? AXIS_NEUTRAL) - AXIS_NEUTRAL) * (axisMultipliers?.[i] ?? 1),
  );
  const tags = new Set(book.themeTags);
  const tagBlock = space.vocab.map((t, j) => (tags.has(t) ? space.idf[j] : 0));
  const axisUnit = l2Normalise(axisBlock);
  const tagUnit = l2Normalise(tagBlock);
  return l2Normalise([...axisUnit.map((x) => x * AXIS_WEIGHT), ...tagUnit]);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
