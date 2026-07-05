import { beforeEach, describe, expect, it } from 'vitest';
import { recommend } from '@/lib/recommender';
import { bookVector, buildSpace, cosine, l2Normalise } from '@/lib/recommender/vector';
import { tasteVector } from '@/lib/recommender/taste';
import { AXES } from '@/lib/types';
import { baseInput, bookId, BOOKS, makeDnf, makeFinished, resetCounter } from './helpers';

beforeEach(resetCounter);

const space = buildSpace(BOOKS);
const vec = (fragment: string) => bookVector(BOOKS.find((b) => b.id === bookId(fragment))!, space);

function tasteFor(records: ReturnType<typeof makeFinished>[], dnfs: ReturnType<typeof makeDnf>[] = []) {
  const input = baseInput({
    records: [...records.map((r) => r.record), ...dnfs],
    ratings: records.map((r) => r.rating),
  });
  const out = recommend(input);
  return out;
}

describe('T — signed weighted centroid (§5.3)', () => {
  it('a 5.0★ rating pulls the taste vector toward that book (acceptance 3)', () => {
    // Baseline: two mid ratings. Then add a 5.0★ for Project Hail Mary.
    const base = [makeFinished('Hyperion', 3.0), makeFinished('Left Hand', 3.0)];
    const withPhm = [...base, makeFinished('Hail Mary', 5.0)];

    const tBase = tasteVector(
      [
        { vector: vec('Hyperion'), weight: 0.1 },
        { vector: vec('Left Hand'), weight: 0.1 },
      ],
      space.dim,
    );
    // Compare via the full pipeline: similarity of a PHM-like unrated book
    // (The Martian) must rise once PHM is loved.
    const before = tasteFor(base);
    const after = tasteFor(withPhm);
    const martianBefore = before.pool.find((c) => c.book.title === 'The Martian')!;
    const martianAfter = after.pool.find((c) => c.book.title === 'The Martian')!;
    expect(martianAfter.sim).toBeGreaterThan(martianBefore.sim);
    expect(tBase.length).toBe(space.dim); // sanity: dimensionality
  });

  it('wrong_mood DNF does NOT move T; pacing DNF does, negatively (acceptance 4)', () => {
    const rated = [makeFinished('Hail Mary', 5.0), makeFinished('Martian', 4.5)];
    const noDnf = tasteFor(rated);
    const wrongMood = tasteFor(rated, [makeDnf('Hyperion', 'wrong_mood')]);
    const pacingDnf = tasteFor(rated, [makeDnf('Hyperion', 'pacing')]);

    // Probe: an unrated book near Hyperion's coordinates (Dune).
    const duneNo = noDnf.pool.find((c) => c.book.title === 'Dune')!;
    const duneWrongMood = wrongMood.pool.find((c) => c.book.title === 'Dune')!;
    const dunePacing = pacingDnf.pool.find((c) => c.book.title === 'Dune')!;

    expect(duneWrongMood.sim).toBeCloseTo(duneNo.sim, 12); // no movement at all
    expect(dunePacing.sim).toBeLessThan(duneNo.sim); // aversion pushed T away
  });

  it('aversion weights push T away (signed centroid, not magnitude)', () => {
    const loved = vec('Hail Mary');
    const hated = vec('Blindsight');
    const t = tasteVector(
      [
        { vector: loved, weight: 1.0 },
        { vector: hated, weight: -1.0 },
      ],
      space.dim,
    );
    expect(cosine(t, loved)).toBeGreaterThan(0);
    expect(cosine(t, hated)).toBeLessThan(cosine(t, loved));
  });

  it('normalising the zero vector stays zero (empty ledger)', () => {
    const z = l2Normalise(new Array(AXES.length).fill(0));
    expect(z.every((x) => x === 0)).toBe(true);
  });
});
