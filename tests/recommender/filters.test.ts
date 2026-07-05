import { beforeEach, describe, expect, it } from 'vitest';
import { applyHardFilters } from '@/lib/recommender/filters';
import { recommend } from '@/lib/recommender';
import { USER_ID, type Book } from '@/lib/types';
import { baseInput, bookId, BOOKS, makeDnf, makeFinished, resetCounter, NOW } from './helpers';

beforeEach(resetCounter);

function series(title: string, index: number): Book {
  return {
    id: `s-${index}`,
    title,
    author: 'Series Author',
    series: 'The Saga',
    seriesIndex: index,
    audioHours: 10,
    subjects: [],
    axes: BOOKS[0].axes,
    themeTags: ['saga'],
    profileVerified: true,
    source: 'manual',
  };
}

function ctx(overrides: Partial<Parameters<typeof applyHardFilters>[1]> = {}) {
  return {
    records: [],
    prefs: [],
    runtime: { enabled: false, minHours: 8, maxHours: 14 },
    notForMe: [],
    booksById: new Map(BOOKS.map((b) => [b.id, b])),
    now: new Date(NOW),
    ...overrides,
  };
}

describe('hard filters (§5.6)', () => {
  it('series order: n+1 never offered before n is finished (acceptance 5)', () => {
    const one = series('Saga One', 1);
    const two = series('Saga Two', 2);
    const books = [one, two];
    const byId = new Map(books.map((b) => [b.id, b]));

    const blocked = applyHardFilters(books, ctx({ booksById: byId }));
    expect(blocked.pool.map((b) => b.id)).toContain(one.id);
    expect(blocked.pool.map((b) => b.id)).not.toContain(two.id);
    expect(blocked.excluded.find((e) => e.bookId === two.id)?.reason).toMatch(/series order/);

    const finishedOne = {
      id: 'r1', userId: USER_ID, bookId: one.id, status: 'finished' as const,
      finishedAt: NOW, sessions: [],
    };
    const open = applyHardFilters(books, ctx({ booksById: byId, records: [finishedOne] }));
    expect(open.pool.map((b) => b.id)).toContain(two.id);
  });

  it('excludes already-encountered books', () => {
    const { record, rating } = makeFinished('Dune', 4.0);
    const out = recommend(baseInput({ records: [record], ratings: [rating] }));
    expect(out.pool.find((c) => c.book.title === 'Dune')).toBeUndefined();
    expect(out.excluded.find((e) => e.bookId === bookId('Dune'))?.reason).toBe('already encountered');
  });

  it('runtime window filters by audio hours when enabled', () => {
    const { pool, excluded } = applyHardFilters(BOOKS, ctx({
      runtime: { enabled: true, minHours: 8, maxHours: 14 },
    }));
    expect(pool.find((b) => b.title === 'All Systems Red')).toBeUndefined(); // 3.3h
    expect(pool.find((b) => b.title === 'Seveneves')).toBeUndefined(); // 31.9h
    expect(pool.find((b) => b.title === 'The Martian')).toBeDefined(); // 10.9h
    expect(excluded.find((e) => e.bookId === bookId('Seveneves'))?.reason).toMatch(/runtime/);
  });

  it('wrong_mood suppression lasts 6 months, then the book returns', () => {
    const recent = makeDnf('Hyperion', 'wrong_mood', '2026-05-01T00:00:00.000Z');
    const { pool: p1, excluded: e1 } = applyHardFilters(BOOKS, ctx({ records: [recent] }));
    expect(p1.find((b) => b.title === 'Hyperion')).toBeUndefined();
    expect(e1.find((e) => e.bookId === bookId('Hyperion'))?.reason).toMatch(/wrong mood/);

    const stale = makeDnf('Hyperion', 'wrong_mood', '2025-09-01T00:00:00.000Z');
    const { excluded: e2 } = applyHardFilters(BOOKS, ctx({ records: [stale] }));
    // Still excluded (encountered), but no longer via mood suppression.
    expect(e2.find((e) => e.bookId === bookId('Hyperion'))?.reason).toBe('already encountered');
  });

  it('standing rules: axis caps and tag exclusions', () => {
    const noMilitary = {
      id: 'p1', userId: USER_ID, kind: 'aversion' as const, label: 'no military SF',
      effect: { type: 'axisCap' as const, axis: 'military' as const, max: 0.5 },
    };
    const { pool, excluded } = applyHardFilters(BOOKS, ctx({ prefs: [noMilitary] }));
    expect(pool.find((b) => b.title === "Old Man's War")).toBeUndefined(); // military 0.9
    expect(excluded.find((e) => e.bookId === bookId("Old Man's War"))?.reason).toMatch(/no military SF/);

    const noSpiders = {
      id: 'p2', userId: USER_ID, kind: 'aversion' as const, label: 'no spiders',
      effect: { type: 'excludeTag' as const, tag: 'spiders' },
    };
    const tagOut = applyHardFilters(BOOKS, ctx({ prefs: [noSpiders] }));
    expect(tagOut.pool.find((b) => b.title === 'Children of Time')).toBeUndefined();
  });

  it('label-only (inert) preferences filter nothing', () => {
    const inert = { id: 'p3', userId: USER_ID, kind: 'aversion' as const, label: 'no vibes' };
    const { pool } = applyHardFilters(BOOKS, ctx({ prefs: [inert] }));
    expect(pool.length).toBe(BOOKS.length);
  });
});
