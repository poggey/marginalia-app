import {
  BAND_DISTANCE_WEIGHT, BAND_MAX, BAND_MIN, K_NEIGHBOURS,
  LEARNING_BAND_MULTIPLIER, SHRINKAGE_LAMBDA, SIM_EXPONENT,
} from './constants';
import { cosine } from './vector';

// §5.4 Predict: k-NN (k=7, sim³ weights) over the reader's own rated books,
// shrunk toward their mean (λ=1.5), with a confidence band from neighbour
// agreement + mean neighbour distance.

export interface RatedPoint {
  bookId: string;
  title: string;
  vector: number[];
  verdict: number;
}

export interface Neighbour {
  bookId: string;
  title: string;
  sim: number;
  verdict: number;
  weight: number; // sim³
}

export interface Prediction {
  rHat: number;          // shrunk prediction, 0.5..5
  band: number;          // ±, rounded to 0.1
  confidence: 'high' | 'medium' | 'low';
  neighbours: Neighbour[]; // the k driving neighbours, best first
}

export function predictRating(
  candidateVector: number[],
  rated: RatedPoint[],
  userMean: number,
  opts: { learning: boolean },
): Prediction | null {
  if (rated.length === 0) return null;

  const neighbours: Neighbour[] = rated
    .map((r) => {
      const sim = Math.max(0, cosine(candidateVector, r.vector));
      return { bookId: r.bookId, title: r.title, sim, verdict: r.verdict, weight: sim ** SIM_EXPONENT };
    })
    .sort((a, b) => b.sim - a.sim || a.bookId.localeCompare(b.bookId))
    .slice(0, K_NEIGHBOURS);

  const wSum = neighbours.reduce((s, n) => s + n.weight, 0);
  // Shrinkage toward the user mean: r̂ = (Σ wᵢrᵢ + λ·r̄) / (Σ wᵢ + λ).
  const rHat =
    (neighbours.reduce((s, n) => s + n.weight * n.verdict, 0) + SHRINKAGE_LAMBDA * userMean) /
    (wSum + SHRINKAGE_LAMBDA);

  // Neighbour agreement: weighted std of neighbour verdicts around their own
  // weighted mean; distance term: mean (1 − sim) over the k neighbours.
  const knnMean = wSum > 0 ? neighbours.reduce((s, n) => s + n.weight * n.verdict, 0) / wSum : userMean;
  const variance =
    wSum > 0
      ? neighbours.reduce((s, n) => s + n.weight * (n.verdict - knnMean) ** 2, 0) / wSum
      : 1;
  const meanDist = neighbours.reduce((s, n) => s + (1 - n.sim), 0) / neighbours.length;

  let band = Math.sqrt(variance) + BAND_DISTANCE_WEIGHT * meanDist;
  if (opts.learning) band *= LEARNING_BAND_MULTIPLIER; // deliberately wide (§5.7)
  band = Math.min(BAND_MAX, Math.max(BAND_MIN, band));
  band = Math.round(band * 10) / 10;

  const confidence: Prediction['confidence'] = band <= 0.35 ? 'high' : band <= 0.6 ? 'medium' : 'low';

  return {
    rHat: Math.min(5, Math.max(0.5, rHat)),
    band,
    confidence,
    neighbours,
  };
}
