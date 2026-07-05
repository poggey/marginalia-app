import { beforeEach, describe, expect, it } from 'vitest';
import { predictRating } from '@/lib/recommender/predict';
import { finalScore, mmrSelect, novelty, wildcardId } from '@/lib/recommender/select';
import { bookVector, buildSpace } from '@/lib/recommender/vector';
import { recommend } from '@/lib/recommender';
import { baseInput, BOOKS, makeFinished, resetCounter } from './helpers';

beforeEach(resetCounter);

const space = buildSpace(BOOKS);
const points = BOOKS.slice(0, 10).map((b, i) => ({
  bookId: b.id,
  title: b.title,
  vector: bookVector(b, space),
  verdict: [5, 4.5, 4, 3.5, 3, 4, 4.5, 2, 3.5, 4][i],
}));

describe('k-NN prediction (§5.4)', () => {
  it('uses at most k=7 neighbours and shrinks toward the user mean', () => {
    const cand = bookVector(BOOKS[15], space);
    const p = predictRating(cand, points, 3.8, { learning: false })!;
    expect(p.neighbours.length).toBe(7);
    // Shrinkage keeps r̂ strictly between the raw k-NN estimate and pure mean.
    expect(p.rHat).toBeGreaterThan(0.5);
    expect(p.rHat).toBeLessThanOrEqual(5);
  });

  it('identical neighbours agreeing → tight band; learning widens it ×1.5', () => {
    const cand = bookVector(BOOKS[0], space);
    const agree = predictRating(cand, points, 4, { learning: false })!;
    const wide = predictRating(cand, points, 4, { learning: true })!;
    expect(wide.band).toBeGreaterThanOrEqual(agree.band);
    expect(agree.band).toBeGreaterThanOrEqual(0.2);
    expect(wide.band).toBeLessThanOrEqual(1.2);
  });

  it('returns null with no rated books (cold start is honest)', () => {
    expect(predictRating(bookVector(BOOKS[0], space), [], 3, { learning: true })).toBeNull();
  });
});

describe('selection (§5.5, Ch. VI)', () => {
  it('Score = (1−δ)·r̂/5 + δ·nov', () => {
    expect(finalScore(4.5, 0.4, 0.12)).toBeCloseTo(0.88 * 0.9 + 0.12 * 0.4, 12);
    expect(finalScore(4.5, 0.4, 0)).toBeCloseTo(0.9, 12);
  });

  it('novelty is 1 with nothing read, and 1 − max cos otherwise', () => {
    const v = bookVector(BOOKS[0], space);
    expect(novelty(v, [])).toBe(1);
    expect(novelty(v, [v])).toBeCloseTo(0, 10);
  });

  it('MMR diversifies: the second pick is not simply the second-highest score', () => {
    const scored = BOOKS.map((b) => {
      const vector = bookVector(b, space);
      return { bookId: b.id, vector, nov: 0.3, score: 0.8 };
    });
    // Give two near-identical books (same author/axes) the top two scores.
    const phm = scored.find((s) => s.bookId.includes('project-hail-mary'))!;
    const martian = scored.find((s) => s.bookId.includes('the-martian'))!;
    phm.score = 0.95;
    martian.score = 0.81;
    const picked = mmrSelect(scored, 5);
    expect(picked[0].bookId).toBe(phm.bookId);
    // The Martian (cos ≈ very high vs PHM) should be pushed below slot 2.
    expect(picked[1].bookId).not.toBe(martian.bookId);
  });

  it('wildcard: at δ ≥ 0.42 slot five is the pure-novelty argmax, unscored (acceptance 2)', () => {
    const rated = [
      makeFinished('Hail Mary', 5.0), makeFinished('Martian', 5.0),
      makeFinished('Legion', 4.5), makeFinished('Recursion', 4.0),
      makeFinished('Old Man', 3.5), makeFinished('Player', 4.0),
      makeFinished('Children of Time', 4.5), makeFinished('Systems Red', 4.0),
      makeFinished('Hyperion', 3.0), makeFinished('Three-Body', 3.0),
    ];
    const input = baseInput({
      records: rated.map((r) => r.record),
      ratings: rated.map((r) => r.rating),
      delta: 0.42,
    });
    const out = recommend(input);
    expect(out.shortlist.length).toBe(5);
    expect(out.shortlist[4].wildcard).toBe(true);
    // The wildcard is the max-novelty candidate not already in slots 1–4.
    const topFour = new Set(out.shortlist.slice(0, 4).map((c) => c.book.id));
    const eligible = out.pool.filter((c) => !topFour.has(c.book.id));
    const maxNov = Math.max(...eligible.map((c) => c.nov));
    expect(out.shortlist[4].nov).toBeCloseTo(maxNov, 10);

    const familiar = recommend({ ...input, delta: 0.12 });
    expect(familiar.shortlist.every((c) => !c.wildcard)).toBe(true);

    // δ visibly re-ranks (acceptance 2): orders differ between stops.
    const comfort = recommend({ ...input, delta: 0 });
    const unknown = recommend({ ...input, delta: 0.6 });
    expect(comfort.shortlist.map((c) => c.book.id)).not.toEqual(
      unknown.shortlist.map((c) => c.book.id),
    );
  });

  it('wildcardId returns null below the threshold', () => {
    const scored = BOOKS.slice(0, 6).map((b) => ({
      bookId: b.id, vector: bookVector(b, space), nov: 0.5, score: 0.5,
    }));
    expect(wildcardId(scored, scored.slice(0, 5), 0.25)).toBeNull();
  });
});
