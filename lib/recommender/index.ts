import type { Axis, Book, Rating, ReadingRecord, StandingPreference } from '@/lib/types';
import { AXES } from '@/lib/types';
import { AXIS_WEIGHT, LEARNING_THRESHOLD, SHORTLIST_SIZE, WILDCARD_MIN_DELTA } from './constants';
import { bookVector, buildSpace, cosine, l2Normalise } from './vector';
import { dnfWeight, ratingWeight } from './weights';
import { tasteAxes, tasteVector, type WeightedEntry } from './taste';
import { applyHardFilters, type Exclusion, type RuntimeWindowLike } from './filters';
import { predictRating, type Prediction, type RatedPoint } from './predict';
import { finalScore, mmrSelect, novelty, wildcardId } from './select';
import { axisMultipliers, fitSensitivities } from './sensitivity';
import { buildReasoning } from './reasoning';

// Pipeline order (§2): hard filters → sim → r̂ + band → nov → Score(δ) → MMR →
// wildcard swap if δ ≥ 0.42 → render with reasoning. Pure and deterministic:
// `now` is an input, and every intermediate value is returned (the Atlas seam).

export interface RecommenderInput {
  books: Book[];
  records: ReadingRecord[];
  ratings: Rating[];
  prefs: StandingPreference[];
  runtime: RuntimeWindowLike;
  notForMe: string[];
  delta: number;
  now: string; // ISO — structured-clone friendly for the worker
  minPopularity?: number; // recognition floor (Settings), default 0
}

export interface ScoredCandidate {
  book: Book;
  sim: number;
  nov: number;
  score: number;
  prediction: Prediction | null;
  wildcard: boolean;
  reasons: string[];
}

export interface RecommenderOutput {
  ratedCount: number;
  learning: boolean;
  coldStart: boolean; // zero ratings: preference-and-popularity picks, labelled
  userMean: number | null;
  hero: ScoredCandidate | null;
  shortlist: ScoredCandidate[];
  pool: ScoredCandidate[]; // every scored candidate (Atlas / queue ordering)
  tasteAxes: Record<Axis, number> | null;
  sensitivities: Record<Axis, number> | null;
  excluded: Exclusion[];
}

export function recommend(input: RecommenderInput): RecommenderOutput {
  const now = new Date(input.now);
  const booksById = new Map(input.books.map((b) => [b.id, b]));
  const recordsById = new Map(input.records.map((r) => [r.id, r]));

  // Join ratings to books through their reading records.
  const ratingJoins = input.ratings
    .map((rating) => {
      const record = recordsById.get(rating.readingRecordId);
      const book = record ? booksById.get(record.bookId) : undefined;
      return book && record ? { rating, record, book } : null;
    })
    .filter((x): x is { rating: Rating; record: ReadingRecord; book: Book } => x !== null)
    .sort((a, b) => a.rating.ratedAt.localeCompare(b.rating.ratedAt) || a.rating.id.localeCompare(b.rating.id));

  const ratedCount = ratingJoins.length;
  const learning = ratedCount < LEARNING_THRESHOLD;
  const coldStart = ratedCount === 0;
  const userMean = ratedCount
    ? ratingJoins.reduce((s, j) => s + j.rating.verdict, 0) / ratedCount
    : null;

  // Sensitivities (≥25 ratings) re-weight the axis block of every vector.
  const sensitivities = fitSensitivities(
    ratingJoins.map((j) => ({ book: j.book, verdict: j.rating.verdict })),
  );
  const mult = axisMultipliers(sensitivities);

  const space = buildSpace(input.books);
  const vectors = new Map(input.books.map((b) => [b.id, bookVector(b, space, mult)]));

  // §5.2 weigh: every rated encounter, plus DNFs (wrong_mood carries zero).
  const tasteEntries: WeightedEntry[] = [];
  const axisEntries: { book: Book; weight: number }[] = [];
  for (const j of ratingJoins) {
    const w = ratingWeight(j.rating, now);
    tasteEntries.push({ vector: vectors.get(j.book.id)!, weight: w });
    axisEntries.push({ book: j.book, weight: w });
  }
  for (const record of input.records) {
    const w = dnfWeight(record, now);
    if (w === 0) continue;
    const v = vectors.get(record.bookId);
    if (v) tasteEntries.push({ vector: v, weight: w });
  }

  // axisBias standing preferences nudge T as pseudo-entries: a unit vector on
  // that axis, weighted by the bias delta (soft, never a filter).
  for (const p of input.prefs) {
    if (p.effect?.type !== 'axisBias') continue;
    const v = new Array<number>(space.dim).fill(0);
    v[AXES.indexOf(p.effect.axis)] = AXIS_WEIGHT;
    tasteEntries.push({ vector: l2Normalise(v), weight: p.effect.delta });
  }

  const T = tasteVector(tasteEntries, space.dim);
  const readerAxes = tasteAxes(axisEntries);

  // k-NN points: the reader's own rated books (latest verdict per book).
  const latestByBook = new Map<string, { book: Book; verdict: number }>();
  for (const j of ratingJoins) latestByBook.set(j.book.id, { book: j.book, verdict: j.rating.verdict });
  const ratedPoints: RatedPoint[] = [...latestByBook.values()]
    .map(({ book, verdict }) => ({
      bookId: book.id,
      title: book.title,
      vector: vectors.get(book.id)!,
      verdict,
    }))
    .sort((a, b) => a.bookId.localeCompare(b.bookId));

  // Novelty is measured against the read shelf: finished or abandoned.
  const readVectors = [
    ...new Set(
      input.records
        .filter((r) => r.status === 'finished' || r.status === 'abandoned')
        .map((r) => r.bookId),
    ),
  ]
    .map((id) => vectors.get(id))
    .filter((v): v is number[] => !!v);

  // 1) Hard filters.
  const { pool: filteredBooks, excluded } = applyHardFilters(input.books, {
    records: input.records,
    prefs: input.prefs,
    runtime: input.runtime,
    notForMe: input.notForMe,
    booksById,
    now,
    minPopularity: input.minPopularity ?? 0,
  });

  // 2–5) sim → r̂ + band → nov → Score(δ).
  const scored = filteredBooks.map((book) => {
    const v = vectors.get(book.id)!;
    const sim = cosine(T, v);
    const prediction = predictRating(v, ratedPoints, userMean ?? 3, { learning });
    const nov = novelty(v, readVectors);
    const score = prediction ? finalScore(prediction.rHat, nov, input.delta) : prefAffinity(book, input.prefs);
    return { bookId: book.id, book, vector: v, sim, nov, score, prediction };
  });

  // 6) MMR shortlist; 7) wildcard swap at δ ≥ 0.42.
  const shortlisted = coldStart
    ? [...scored].sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).slice(0, SHORTLIST_SIZE)
    : mmrSelect(scored, SHORTLIST_SIZE);

  let finalIds = shortlisted.map((s) => s.bookId);
  const wildId = coldStart ? null : wildcardId(scored, shortlisted, input.delta);
  if (wildId) {
    finalIds = [...finalIds.slice(0, SHORTLIST_SIZE - 1).filter((id) => id !== wildId)];
    finalIds.push(wildId);
  }

  const scoredById = new Map(scored.map((s) => [s.bookId, s]));
  const toCandidate = (id: string, slot: number): ScoredCandidate => {
    const s = scoredById.get(id)!;
    const wildcard = !!wildId && slot === SHORTLIST_SIZE - 1 && input.delta >= WILDCARD_MIN_DELTA;
    return {
      book: s.book,
      sim: s.sim,
      nov: s.nov,
      score: s.score,
      prediction: s.prediction,
      wildcard,
      reasons: buildReasoning({
        book: s.book,
        prediction: s.prediction,
        nov: s.nov,
        delta: input.delta,
        tasteAxes: readerAxes,
        sensitivities,
        wildcard,
        ratedCount,
      }),
    };
  };

  const shortlist = finalIds.map(toCandidate);
  const pool = scored
    .slice()
    .sort((a, b) => b.score - a.score || a.bookId.localeCompare(b.bookId))
    .map((s) => toCandidate(s.bookId, -1));

  return {
    ratedCount,
    learning,
    coldStart,
    userMean,
    hero: shortlist[0] ?? null,
    shortlist,
    pool,
    tasteAxes: readerAxes,
    sensitivities,
    excluded,
  };
}

// Cold start ordering: stated preferences constrain and rank picks before any
// ratings exist (§5.7) — never fake ratings. Loves and biases raise affinity.
function prefAffinity(book: Book, prefs: StandingPreference[]): number {
  let a = 0;
  for (const p of prefs) {
    const e = p.effect;
    if (!e) continue;
    if (e.type === 'axisBias') a += e.delta * (book.axes[e.axis] ?? 0.5);
    if (e.type === 'axisFloor' && p.kind === 'love') a += (book.axes[e.axis] ?? 0.5) - e.min;
  }
  return a;
}

export type { Prediction, ScoredCandidate as Candidate };
export { DELTA_STOPS, DEFAULT_STOP_INDEX, LEARNING_THRESHOLD } from './constants';
