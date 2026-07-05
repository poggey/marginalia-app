'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '@/lib/db';
import { useRecommendations } from '@/lib/useRecommendations';
import { DEFAULT_STOP_INDEX, DELTA_STOPS } from '@/lib/recommender/constants';
import BookCover from '@/components/BookCover';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default function QueuePage() {
  // The queue is ordered by the live model score at your saved Discovery stop.
  const [stopIndex, setStopIndex] = useState(DEFAULT_STOP_INDEX);
  useEffect(() => {
    getMeta<number>('discoveryStop').then((v) => v !== undefined && setStopIndex(v));
  }, []);
  const { output } = useRecommendations(DELTA_STOPS[stopIndex].delta);

  const queued = useLiveQuery(async () => {
    const records = await db.records.where('status').equals('queued').toArray();
    const books = await db.books.bulkGet(records.map((r) => r.bookId));
    return records
      .map((record, i) => ({ record, book: books[i] }))
      .filter((x): x is { record: (typeof records)[number]; book: NonNullable<(typeof books)[number]> } => !!x.book);
  }, []);

  if (!queued || !output) return null;

  const scoreById = new Map(output.pool.map((c) => [c.book.id, c]));
  const rows = [...queued].sort((a, b) => {
    const sa = scoreById.get(a.book.id)?.score ?? -1;
    const sb = scoreById.get(b.book.id)?.score ?? -1;
    return sb - sa;
  });
  const now = Date.now();

  return (
    <>
      <div className="mt-11 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-serif text-[34px] font-medium tracking-[-0.01em]">Queue</h1>
        <span className="tnum text-[13px] text-ink-3">
          your want-to-read shortlist · {rows.length} waiting · ordered by live model score · target 10–25
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-14 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">
          Nothing queued. Send something over from{' '}
          <Link href="/for-you" className="font-semibold text-accent">
            For you
          </Link>{' '}
          or press <kbd className="rounded-[5px] border border-hairline bg-surface px-1.5 text-[12px]">N</kbd>{' '}
          to log one directly.
        </div>
      ) : (
        <div className="mt-8 rounded-panel border border-hairline bg-surface px-8 py-2">
          {rows.map(({ record, book }, i) => {
            const c = scoreById.get(book.id);
            const stale = record.queuedAt && now - new Date(record.queuedAt).getTime() >= YEAR_MS;
            return (
              <div
                key={record.id}
                className="grid grid-cols-[26px_44px_1fr_auto_auto] items-center gap-5 border-b border-hairline-2 py-4 last:border-b-0"
              >
                <div className="tnum text-[12.5px] font-medium text-ink-3">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <Link href={`/library/${book.id}`}>
                  <BookCover book={book} className="h-[62px] w-[42px]" titleSize={7} />
                </Link>
                <div className="min-w-0">
                  <Link href={`/library/${book.id}`} className="truncate font-serif text-[17px] font-medium leading-tight">
                    {book.title}
                  </Link>
                  <div className="text-[12.5px] text-ink-2">
                    {book.author}
                    {book.audioHours ? ` · ${book.audioHours} h` : ''}
                  </div>
                  {stale && (
                    <div className="mt-1 text-[12px] text-ink-3">
                      Queued over a year — still calling to you?{' '}
                      <button
                        onClick={() => db.records.delete(record.id)}
                        className="font-semibold text-ink-2 underline decoration-hairline underline-offset-2 hover:text-ink"
                      >
                        Let it go
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="tnum text-[15px] font-semibold">
                    {c?.prediction ? c.prediction.rHat.toFixed(1) : '—'}
                  </div>
                  <div className="tnum text-[11.5px] text-ink-3">
                    {c?.prediction ? `± ${c.prediction.band.toFixed(1)}` : 'unscored'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      db.records.update(record.id, { status: 'reading', startedAt: new Date().toISOString() })
                    }
                    className="rounded-btn border border-hairline px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => db.records.delete(record.id)}
                    aria-label={`Remove ${book.title} from queue`}
                    className="rounded-btn border border-hairline px-3 py-2 text-[12.5px] font-semibold text-ink-3 hover:border-ink-3 hover:text-ink-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
