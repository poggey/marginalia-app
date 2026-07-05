import {
  MMR_DIVERSITY_WEIGHT, MMR_SCORE_WEIGHT, SHORTLIST_SIZE, WILDCARD_MIN_DELTA,
} from './constants';
import { cosine } from './vector';

// §5.5 Select: nov(c) = 1 − maxᵦ cos(x_c, x_b) over read books;
// Score = (1−δ)·r̂/5 + δ·nov; shortlist of five by MMR; wildcard at δ ≥ 0.42.

export function novelty(candidateVector: number[], readVectors: number[][]): number {
  if (readVectors.length === 0) return 1;
  let maxSim = -1;
  for (const rv of readVectors) {
    const s = cosine(candidateVector, rv);
    if (s > maxSim) maxSim = s;
  }
  return 1 - maxSim;
}

export function finalScore(rHat: number, nov: number, delta: number): number {
  return (1 - delta) * (rHat / 5) + delta * nov;
}

export interface Selectable {
  bookId: string;
  vector: number[];
  score: number;
  nov: number;
}

/** MMR: pick = argmax [0.75·Score − 0.25·max cos to already-picked]. */
export function mmrSelect<T extends Selectable>(pool: T[], n = SHORTLIST_SIZE): T[] {
  const picked: T[] = [];
  const remaining = [...pool].sort((a, b) => b.score - a.score || a.bookId.localeCompare(b.bookId));
  while (picked.length < n && remaining.length > 0) {
    let best = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const maxSimToPicked = picked.length
        ? Math.max(...picked.map((p) => cosine(c.vector, p.vector)))
        : 0;
      const val = MMR_SCORE_WEIGHT * c.score - MMR_DIVERSITY_WEIGHT * maxSimToPicked;
      if (val > bestVal + 1e-12 || (Math.abs(val - bestVal) <= 1e-12 && best >= 0 && c.bookId < remaining[best].bookId)) {
        bestVal = val;
        best = i;
      }
    }
    picked.push(remaining.splice(best, 1)[0]);
  }
  return picked;
}

/**
 * Wildcard swap (Ch. VI): at Far/Unknown, slot five becomes the pure-novelty
 * argmax over the filtered pool (honestly rendered unscored).
 * Returns the id to place in slot 5, or null when no swap applies.
 */
export function wildcardId<T extends Selectable>(
  pool: T[],
  shortlist: T[],
  delta: number,
): string | null {
  if (delta < WILDCARD_MIN_DELTA) return null;
  const topFour = new Set(shortlist.slice(0, SHORTLIST_SIZE - 1).map((s) => s.bookId));
  const candidates = pool.filter((c) => !topFour.has(c.bookId));
  if (!candidates.length) return null;
  const wild = candidates.reduce((a, b) =>
    b.nov > a.nov || (b.nov === a.nov && b.bookId < a.bookId) ? b : a,
  );
  return wild.bookId;
}
