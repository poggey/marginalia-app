'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '@/lib/db';
import { useRecommendations } from '@/lib/useRecommendations';
import { DEFAULT_STOP_INDEX, DELTA_STOPS, LEARNING_THRESHOLD } from '@/lib/recommender/constants';
import { AXES, AXIS_LABELS, type Book, type Rating, type ReadingRecord } from '@/lib/types';
import BookCover from '@/components/BookCover';
import ReadingNowList from '@/components/ReadingNowList';

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Gate on the onboarding flag before mounting anything — no flash of Home
  // for a fresh profile, and no recommender worker spun up just to redirect.
  useEffect(() => {
    getMeta<boolean>('onboarded').then((done) => {
      if (!done) router.replace('/onboarding');
      else setReady(true);
    });
  }, [router]);

  if (!ready) return null;
  return <HomeContent />;
}

function HomeContent() {
  // Read recommendations at the same discovery stop as the For-you tab, so
  // the teaser here always previews that page's hero.
  const [stopIndex, setStopIndex] = useState<number>(DEFAULT_STOP_INDEX);
  useEffect(() => {
    getMeta<number>('discoveryStop').then((v) => {
      if (v !== undefined) setStopIndex(v);
    });
  }, []);
  const { output } = useRecommendations(DELTA_STOPS[stopIndex].delta);

  const stats = useLiveQuery(async () => {
    const [records, ratings] = await Promise.all([db.records.toArray(), db.ratings.toArray()]);
    const year = String(new Date().getFullYear());
    return {
      finishedThisYear: records.filter((r) => r.status === 'finished' && r.finishedAt?.startsWith(year))
        .length,
      reading: records.filter((r) => r.status === 'reading' || r.status === 'paused').length,
      avg: ratings.length ? ratings.reduce((s, r) => s + r.verdict, 0) / ratings.length : null,
      ratedCount: ratings.length,
    };
  }, []);

  const recentlyFinished = useLiveQuery(async () => {
    const finished = await db.records.where('status').equals('finished').toArray();
    finished.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
    const top = finished.slice(0, 5);
    const [books, ratings] = await Promise.all([
      db.books.bulkGet(top.map((r) => r.bookId)),
      db.ratings.where('readingRecordId').anyOf(top.map((r) => r.id)).toArray(),
    ]);
    const byRecord = new Map(ratings.map((r) => [r.readingRecordId, r]));
    return top
      .map((record, i) => ({ record, book: books[i], rating: byRecord.get(record.id) }))
      .filter((r): r is { record: ReadingRecord; book: Book; rating: Rating | undefined } => !!r.book);
  }, []);

  const hero = output?.hero ?? null;
  const tasteAxes = output?.tasteAxes ?? null;
  const strongestAxes = tasteAxes
    ? [...AXES]
        .sort(
          (a, b) => Math.abs((tasteAxes[b] ?? 0.5) - 0.5) - Math.abs((tasteAxes[a] ?? 0.5) - 0.5),
        )
        .slice(0, 5)
    : null;

  return (
    <>
      <h1 className="mt-11 font-serif text-[34px] font-medium tracking-[-0.01em]">Home</h1>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-4">
          <div className="rounded-card border border-hairline bg-surface p-5">
            <div className="label-caps">Finished this year</div>
            <div className="tnum mt-1.5 font-serif text-[28px] font-medium">{stats.finishedThisYear}</div>
          </div>
          <div className="rounded-card border border-hairline bg-surface p-5">
            <div className="label-caps">Average rating</div>
            <div className="tnum mt-1.5 font-serif text-[28px] font-medium">
              {stats.avg !== null ? `★ ${stats.avg.toFixed(1)}` : '—'}
            </div>
          </div>
          <div className="rounded-card border border-hairline bg-surface p-5">
            <div className="label-caps">Reading now</div>
            <div className="tnum mt-1.5 font-serif text-[28px] font-medium">{stats.reading}</div>
          </div>
          <div className="rounded-card border border-hairline bg-surface p-5">
            <div className="label-caps">Calibration</div>
            <div className="tnum mt-1.5 font-serif text-[28px] font-medium">
              {stats.ratedCount >= LEARNING_THRESHOLD
                ? 'Calibrated'
                : `${Math.min(stats.ratedCount, LEARNING_THRESHOLD)} / ${LEARNING_THRESHOLD}`}
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-[3px] bg-hairline-2">
              <div
                className="h-full rounded-[3px] bg-accent"
                style={{ width: `${Math.min(1, stats.ratedCount / LEARNING_THRESHOLD) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <ReadingNowList />

          {recentlyFinished && recentlyFinished.length > 0 && (
            <section className="mt-11">
              <div className="label-caps mb-4">Recently finished</div>
              <div className="flex flex-col gap-3">
                {recentlyFinished.map(({ book, record, rating }) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-4 rounded-card border border-hairline bg-surface px-5 py-3.5"
                  >
                    <Link href={`/library/${book.id}`}>
                      <BookCover book={book} className="h-[62px] w-[42px]" titleSize={7} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/library/${book.id}`}
                        className="truncate font-serif text-[16px] font-medium leading-tight"
                      >
                        {book.title}
                      </Link>
                      <div className="text-[12.5px] text-ink-2">
                        {book.author}
                        {record.finishedAt
                          ? ` · finished ${new Date(record.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                          : ''}
                      </div>
                    </div>
                    {rating ? (
                      <span className="tnum text-[13px] font-semibold">★ {rating.verdict.toFixed(1)}</span>
                    ) : (
                      <Link
                        href={`/review/${record.id}`}
                        className="rounded-btn bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-[#DFE3FD]"
                      >
                        Rate it
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="mt-11 rounded-card border border-hairline bg-surface p-6">
            <div className="label-caps mb-4">Chosen for you</div>
            {!output ? (
              <div className="text-[13.5px] text-ink-3">Consulting the ledger…</div>
            ) : hero ? (
              <>
                <div className="flex gap-4">
                  <Link href={`/library/${hero.book.id}`} className="shrink-0">
                    <BookCover book={hero.book} className="h-[120px] w-[80px]" titleSize={11} />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/library/${hero.book.id}`}
                      className="font-serif text-[19px] font-medium leading-[1.25]"
                    >
                      {hero.book.title}
                    </Link>
                    <div className="mt-0.5 text-[12.5px] text-ink-2">{hero.book.author}</div>
                    {hero.prediction && (
                      <div className="tnum mt-2 text-[13px] font-semibold">
                        ★ {hero.prediction.rHat.toFixed(1)}
                        <span className="ml-1 font-normal text-ink-3">
                          ± {hero.prediction.band.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {hero.reasons[0] && (
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-2">{hero.reasons[0]}</p>
                )}
                <Link
                  href="/for-you"
                  className="mt-4 inline-block text-[13px] font-semibold text-accent hover:text-accent-ink"
                >
                  See all picks →
                </Link>
              </>
            ) : (
              <div className="text-[13.5px] leading-relaxed text-ink-2">
                {output.coldStart
                  ? 'Rate a few books you already know and the librarian will start picking for you.'
                  : 'Nothing passes your filters right now.'}{' '}
                <Link href="/for-you" className="font-semibold text-accent hover:text-accent-ink">
                  Go to For you →
                </Link>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-card border border-hairline bg-surface p-6">
            <div className="label-caps mb-4">Your taste so far</div>
            {strongestAxes && tasteAxes ? (
              <div className="flex flex-col gap-[9px]">
                {strongestAxes.map((a) => (
                  <div key={a} className="flex items-center gap-2.5 text-[11.5px] text-ink-2">
                    <span className="w-[86px] text-right">{AXIS_LABELS[a]}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-[3px] bg-hairline-2">
                      <div
                        className="h-full rounded-[3px] bg-accent"
                        style={{ width: `${(tasteAxes[a] ?? 0.5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13.5px] leading-relaxed text-ink-2">
                Rate a few books and your taste profile appears here.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
