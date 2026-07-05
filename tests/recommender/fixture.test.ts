import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { recommend, type RecommenderInput } from '@/lib/recommender';
import { DELTA_STOPS } from '@/lib/recommender/constants';
import { baseInput, makeDnf, makeFinished, resetCounter } from './helpers';

// The committed fixture (acceptance 9): a synthetic 12-rating ledger over the
// calibration deck, one pacing DNF, fixed `now`. The expected ranking at every
// Discovery stop is committed to expected.json; any change to the mathematics
// shows up as a diff here.

function fixtureInput(delta: number): RecommenderInput {
  resetCounter();
  const rated = [
    makeFinished('Hail Mary', 5.0, { ratedAt: '2026-06-20T00:00:00.000Z', wouldReread: true }),
    makeFinished('The Martian', 5.0, { ratedAt: '2026-06-01T00:00:00.000Z' }),
    makeFinished('Legion', 4.5, { ratedAt: '2026-05-15T00:00:00.000Z' }),
    makeFinished('Children of Time', 4.5, { ratedAt: '2026-04-20T00:00:00.000Z' }),
    makeFinished('Player of Games', 4.0, { ratedAt: '2026-04-01T00:00:00.000Z' }),
    makeFinished('Systems Red', 4.0, { ratedAt: '2026-03-10T00:00:00.000Z' }),
    makeFinished('Recursion', 4.0, { ratedAt: '2026-02-14T00:00:00.000Z' }),
    makeFinished("Old Man's War", 3.5, { ratedAt: '2026-01-25T00:00:00.000Z' }),
    makeFinished('Hyperion', 3.0, { ratedAt: '2025-12-01T00:00:00.000Z' }),
    makeFinished('Three-Body', 3.0, { ratedAt: '2025-10-15T00:00:00.000Z' }),
    makeFinished('Blindsight', 2.5, { ratedAt: '2025-09-01T00:00:00.000Z' }),
    makeFinished('Annihilation', 2.0, { ratedAt: '2025-08-01T00:00:00.000Z' }),
  ];
  const dnf = makeDnf('Small, Angry Planet', 'pacing', '2026-03-01T00:00:00.000Z');
  return baseInput({
    records: [...rated.map((r) => r.record), dnf],
    ratings: rated.map((r) => r.rating),
    delta,
  });
}

interface ExpectedStop {
  stop: string;
  delta: number;
  hero: string | null;
  shortlist: { id: string; rHat: number | null; band: number | null; nov: number; wildcard: boolean }[];
}

function computeAll(): ExpectedStop[] {
  return DELTA_STOPS.map((stop) => {
    const out = recommend(fixtureInput(stop.delta));
    return {
      stop: stop.short,
      delta: stop.delta,
      hero: out.hero?.book.id ?? null,
      shortlist: out.shortlist.map((c) => ({
        id: c.book.id,
        rHat: c.prediction ? Math.round(c.prediction.rHat * 1000) / 1000 : null,
        band: c.prediction?.band ?? null,
        nov: Math.round(c.nov * 1000) / 1000,
        wildcard: c.wildcard,
      })),
    };
  });
}

const expectedPath = path.join(__dirname, 'expected.json');

describe('deterministic fixture ranking (acceptance 9)', () => {
  beforeEach(resetCounter);

  it('matches the committed expected ranking at every Discovery stop', () => {
    const actual = computeAll();
    if (process.env.GEN_FIXTURE) {
      fs.writeFileSync(expectedPath, JSON.stringify(actual, null, 2) + '\n');
      return;
    }
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as ExpectedStop[];
    expect(actual).toEqual(expected);
  });

  it('is deterministic run-to-run', () => {
    expect(computeAll()).toEqual(computeAll());
  });

  it('the fixture ledger is a Learning-free profile (12 ratings ≥ 10)', () => {
    const out = recommend(fixtureInput(0.12));
    expect(out.ratedCount).toBe(12);
    expect(out.learning).toBe(false);
    expect(out.hero).not.toBeNull();
    expect(out.hero!.prediction).not.toBeNull();
    expect(out.hero!.prediction!.neighbours.length).toBeGreaterThanOrEqual(3);
    expect(out.hero!.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
