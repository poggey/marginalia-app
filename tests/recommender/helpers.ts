import { deckBooks } from '@/lib/deck';
import type { Rating, ReadingRecord } from '@/lib/types';
import { USER_ID } from '@/lib/types';
import type { RecommenderInput } from '@/lib/recommender';

export const NOW = '2026-07-01T00:00:00.000Z';

export const BOOKS = deckBooks();

export function bookId(titleFragment: string): string {
  const b = BOOKS.find((x) => x.title.toLowerCase().includes(titleFragment.toLowerCase()));
  if (!b) throw new Error(`No deck book matching "${titleFragment}"`);
  return b.id;
}

let counter = 0;
export function makeFinished(
  titleFragment: string,
  verdict: number,
  opts: { ratedAt?: string; wouldReread?: boolean } = {},
): { record: ReadingRecord; rating: Rating } {
  counter += 1;
  const id = bookId(titleFragment);
  const ratedAt = opts.ratedAt ?? '2026-06-01T00:00:00.000Z';
  const record: ReadingRecord = {
    id: `rec-${counter.toString().padStart(3, '0')}-${id}`,
    userId: USER_ID,
    bookId: id,
    status: 'finished',
    format: 'audio',
    finishedAt: ratedAt,
    sessions: [],
  };
  const rating: Rating = {
    id: `rat-${counter.toString().padStart(3, '0')}-${id}`,
    userId: USER_ID,
    readingRecordId: record.id,
    axes: { ideas: 7, pace: 7, characters: 7, prose: 7, ending: 7 },
    verdict,
    wouldReread: opts.wouldReread ?? false,
    moods: [],
    ratedAt,
  };
  return { record, rating };
}

export function makeDnf(
  titleFragment: string,
  reason: ReadingRecord['dnfReason'],
  finishedAt = '2026-06-01T00:00:00.000Z',
): ReadingRecord {
  counter += 1;
  const id = bookId(titleFragment);
  return {
    id: `dnf-${counter.toString().padStart(3, '0')}-${id}`,
    userId: USER_ID,
    bookId: id,
    status: 'abandoned',
    format: 'audio',
    finishedAt,
    progressPct: 31,
    dnfReason: reason,
    sessions: [],
  };
}

export function resetCounter(): void {
  counter = 0;
}

export function baseInput(overrides: Partial<RecommenderInput> = {}): RecommenderInput {
  return {
    books: BOOKS,
    records: [],
    ratings: [],
    prefs: [],
    runtime: { enabled: false, minHours: 8, maxHours: 14 },
    notForMe: [],
    delta: 0.12,
    now: NOW,
    ...overrides,
  };
}
