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

  it('weights axes ×2 vs tags before normalisation', () => {
    const b = BOOKS[0];
    const v = bookVector(b, space);
    // Recover the pre-normalisation ratio between two axis components.
    const i = AXES.indexOf('pace');
    const j = AXES.indexOf('humour');
    expect(v[i] / v[j]).toBeCloseTo(b.axes.pace / b.axes.humour, 6);
  });

  it('cosine of a vector with itself is 1', () => {
    const v = bookVector(BOOKS[3], space);
    expect(cosine(v, v)).toBeCloseTo(1, 10);
  });
});
