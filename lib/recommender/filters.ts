import { AXES, type Book, type ReadingRecord, type StandingPreference } from '@/lib/types';
import {
  AXIS_NEUTRAL, MIN_PROFILE_DEVIATION, MS_PER_MONTH, WRONG_MOOD_SUPPRESS_MONTHS,
} from './constants';

/**
 * A neutral tone profile is unknown, not average — recommending on it is
 * guessing. Reader-verified and deck-authored profiles are always trusted;
 * anything else must carry real information on its axes.
 */
export function profileInformative(book: Book): boolean {
  if (book.profileVerified || book.source === 'seed') return true;
  const deviation =
    AXES.reduce((s, a) => s + Math.abs((book.axes[a] ?? AXIS_NEUTRAL) - AXIS_NEUTRAL), 0) /
    AXES.length;
  return deviation >= MIN_PROFILE_DEVIATION;
}

// Hard filters first (§5.6): already-read, series order, runtime window,
// suppressions, reader-written standing rules. Every exclusion is recorded
// with its reason — transparency is the product.

export interface RuntimeWindowLike {
  enabled: boolean;
  minHours: number;
  maxHours: number;
}

export interface FilterContext {
  records: ReadingRecord[];
  prefs: StandingPreference[];
  runtime: RuntimeWindowLike;
  notForMe: string[]; // book ids dismissed via "Not for me"
  booksById: Map<string, Book>;
  now: Date;
  /** Recognition floor: fetched books logged by fewer readers are excluded. */
  minPopularity?: number;
}

export interface Exclusion {
  bookId: string;
  reason: string;
}

const ENCOUNTERED: ReadingRecord['status'][] = ['finished', 'abandoned', 'reading', 'paused'];

export function applyHardFilters(
  candidates: Book[],
  ctx: FilterContext,
): { pool: Book[]; excluded: Exclusion[] } {
  const pool: Book[] = [];
  const excluded: Exclusion[] = [];

  const recordsByBook = new Map<string, ReadingRecord[]>();
  for (const r of ctx.records) {
    const list = recordsByBook.get(r.bookId) ?? [];
    list.push(r);
    recordsByBook.set(r.bookId, list);
  }
  const finishedSeriesIndices = new Map<string, Set<number>>();
  for (const r of ctx.records) {
    if (r.status !== 'finished') continue;
    const b = ctx.booksById.get(r.bookId);
    if (b?.series && b.seriesIndex != null) {
      const set = finishedSeriesIndices.get(b.series) ?? new Set<number>();
      set.add(b.seriesIndex);
      finishedSeriesIndices.set(b.series, set);
    }
  }

  for (const book of candidates) {
    const recs = recordsByBook.get(book.id) ?? [];

    if (ctx.notForMe.includes(book.id)) {
      excluded.push({ bookId: book.id, reason: 'dismissed — not for me' });
      continue;
    }

    if (!profileInformative(book)) {
      excluded.push({
        bookId: book.id,
        reason: 'tone profile unknown — tune it on the book page to make it recommendable',
      });
      continue;
    }

    // Recognition floor applies only where popularity is known (fetched
    // stock); the deck, manual entries and books you logged yourself pass.
    if (
      ctx.minPopularity != null &&
      book.popularity != null &&
      book.popularity < ctx.minPopularity
    ) {
      excluded.push({
        bookId: book.id,
        reason: `below your recognition floor — ${book.popularity} readers logged it`,
      });
      continue;
    }

    if (recs.some((r) => ENCOUNTERED.includes(r.status))) {
      const wrongMood = recs.find(
        (r) =>
          r.status === 'abandoned' &&
          r.dnfReason === 'wrong_mood' &&
          r.finishedAt &&
          ctx.now.getTime() - new Date(r.finishedAt).getTime() <
            WRONG_MOOD_SUPPRESS_MONTHS * MS_PER_MONTH,
      );
      excluded.push({
        bookId: book.id,
        reason: wrongMood ? 'wrong mood — suppressed 6 months' : 'already encountered',
      });
      continue;
    }

    // Series order: n+1 never offered before n is finished. A predecessor we
    // cannot verify as finished (including one absent from the corpus) blocks.
    if (book.series && book.seriesIndex != null && book.seriesIndex > 1) {
      const done = finishedSeriesIndices.get(book.series);
      if (!done?.has(book.seriesIndex - 1)) {
        excluded.push({ bookId: book.id, reason: `series order — #${book.seriesIndex - 1} unfinished` });
        continue;
      }
    }
    // Series continuation of a finished entry is range-exempt (§7.4): it skips
    // the runtime window below.
    const seriesContinuation =
      !!book.series &&
      book.seriesIndex != null &&
      !!finishedSeriesIndices.get(book.series)?.has(book.seriesIndex - 1);

    if (
      ctx.runtime.enabled &&
      !seriesContinuation &&
      book.audioHours != null &&
      (book.audioHours < ctx.runtime.minHours || book.audioHours > ctx.runtime.maxHours)
    ) {
      excluded.push({
        bookId: book.id,
        reason: `runtime — ${book.audioHours}h outside ${ctx.runtime.minHours}–${ctx.runtime.maxHours}h`,
      });
      continue;
    }

    const ruleHit = standingRuleExclusion(book, ctx.prefs);
    if (ruleHit) {
      excluded.push({ bookId: book.id, reason: ruleHit });
      continue;
    }

    pool.push(book);
  }
  return { pool, excluded };
}

function standingRuleExclusion(book: Book, prefs: StandingPreference[]): string | null {
  for (const p of prefs) {
    const e = p.effect;
    if (!e) continue; // label-only preferences are inert
    switch (e.type) {
      case 'axisCap':
        if ((book.axes[e.axis] ?? 0.5) > e.max) return `standing rule — ${p.label}`;
        break;
      case 'axisFloor':
        if ((book.axes[e.axis] ?? 0.5) < e.min) return `standing rule — ${p.label}`;
        break;
      case 'excludeTag':
        if (
          book.themeTags.includes(e.tag) ||
          book.subjects.some((s) => s.toLowerCase().includes(e.tag.toLowerCase()))
        )
          return `standing rule — ${p.label}`;
        break;
      case 'runtime':
        if (book.audioHours != null) {
          if (e.minHours != null && book.audioHours < e.minHours) return `standing rule — ${p.label}`;
          if (e.maxHours != null && book.audioHours > e.maxHours) return `standing rule — ${p.label}`;
        }
        break;
      case 'axisBias':
        break; // soft effect, applied to T in the pipeline, never a filter
    }
  }
  return null;
}
