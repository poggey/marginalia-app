import { describe, expect, it } from 'vitest';
import { bookVector, buildSpace, cosine } from '@/lib/recommender/vector';
import { AXES } from '@/lib/types';
import { BOOKS } from './helpers';

describe('book vectors (§5.1)', () => {
  const space = buildSpace(BOOKS);

  it('are L2-normalised', () => {
    for (const b of BOOKS) {
      const v = bookVector(b, space);
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      expect(norm).toBeCloseTo(1, 10);
    }
  });

  it('preserves within-block axis ratios (centred at neutral 0.5)', () => {
    const b = BOOKS[0];
    const v = bookVector(b, space);
    // Recover the pre-normalisation ratio between two centred axis components.
    const i = AXES.indexOf('pace');
    const j = AXES.indexOf('humour');
    expect(v[i] / v[j]).toBeCloseTo((b.axes.pace - 0.5) / (b.axes.humour - 0.5), 6);
  });

  it('a neutral profile contributes a zero axis block, not false similarity', () => {
    const neutral = {
      ...BOOKS[0],
      id: 'neutral',
      axes: Object.fromEntries(AXES.map((a) => [a, 0.5])) as typeof BOOKS[0]['axes'],
      themeTags: [],
    };
    const v = bookVector(neutral, space);
    expect(v.every((x) => x === 0)).toBe(true);
    expect(cosine(v, bookVector(BOOKS[0], space))).toBe(0);
  });

  it('cosine of a vector with itself is 1', () => {
    const v = bookVector(BOOKS[3], space);
    expect(cosine(v, v)).toBeCloseTo(1, 10);
  });
});
