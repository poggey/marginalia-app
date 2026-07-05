import { describe, expect, it } from 'vitest';
import { dnfWeight, ratingWeight, recencyDecay, verdictStrength } from '@/lib/recommender/weights';
import { makeDnf, makeFinished, NOW } from './helpers';

const now = new Date(NOW);

describe('verdictStrength — the s(r) table, verbatim', () => {
  it.each([
    [5.0, 1.0], [4.5, 0.8], [4.0, 0.55], [3.5, 0.3], [3.0, 0.1],
    [2.5, -0.2], [2.0, -0.5], [1.5, -0.75], [1.0, -1.0],
  ])('s(%f) = %f', (v, s) => {
    expect(verdictStrength(v)).toBeCloseTo(s, 10);
  });

  it('clamps s(0.5) to −1.0 (below the tabled range)', () => {
    expect(verdictStrength(0.5)).toBe(-1.0);
  });
});

describe('recency decay τ = 24 months', () => {
  it('is 1 at t=0 and e^(-1) at 24 months', () => {
    expect(recencyDecay(NOW, now)).toBeCloseTo(1, 6);
    const twoYearsAgo = new Date(now.getTime() - 24 * 30.44 * 24 * 3600 * 1000).toISOString();
    expect(recencyDecay(twoYearsAgo, now)).toBeCloseTo(Math.exp(-1), 3);
  });
});

describe('encounter weights', () => {
  it('applies ×1.3 for re-read-yes', () => {
    const a = makeFinished('Dune', 5.0, { ratedAt: NOW });
    const b = makeFinished('Dune', 5.0, { ratedAt: NOW, wouldReread: true });
    expect(ratingWeight(b.rating, now)).toBeCloseTo(ratingWeight(a.rating, now) * 1.3, 10);
  });

  it('DNF is −0.75 (decayed), wrong_mood is exactly 0', () => {
    expect(dnfWeight(makeDnf('Hyperion', 'pacing', NOW), now)).toBeCloseTo(-0.75, 6);
    expect(dnfWeight(makeDnf('Hyperion', 'wrong_mood', NOW), now)).toBe(0);
  });
});
