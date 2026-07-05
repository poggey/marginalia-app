'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta } from '@/lib/db';
import { useRecommendations } from '@/lib/useRecommendations';
import { DEFAULT_STOP_INDEX, DELTA_STOPS, LEARNING_THRESHOLD } from '@/lib/recommender/constants';
import type { ScoredCandidate } from '@/lib/recommender';
import { USER_ID } from '@/lib/types';
import BookCover from '@/components/BookCover';
import RingGauge from '@/components/RingGauge';
import DiscoveryRange from '@/components/DiscoveryRange';

export default function ForYou() {
  const [stopIndex, setStopIndex] = useState<number>(DEFAULT_STOP_INDEX);
  useEffect(() => {
    getMeta<number>('discoveryStop').then((v) => {
      if (v !== undefined) setStopIndex(v);
    });
  }, []);

  const delta = DELTA_STOPS[stopIndex].delta;
  const { output } = useRecommendations(delta);

  // Range returns: your real average rating at this δ (Ch. VI).
  const rangeReturns = useLiveQuery(async () => {
    const records = (await db.records.toArray()).filter((r) => r.recommendedAtDelta === delta);
    const ids = new Set(records.map((r) => r.id));
    const ratings = (await db.ratings.toArray()).filter((r) => ids.has(r.readingRecordId));
    if (!ratings.length) return null;
    return {
      avg: ratings.reduce((s, r) => s + r.verdict, 0) / ratings.length,
      n: ratings.length,
    };
  }, [delta]);

  function changeStop(i: number) {
    const clamped = Math.max(0, Math.min(4, i));
    setStopIndex(clamped);
    setMeta('discoveryStop', clamped);
  }

  async function startReading(c: ScoredCandidate) {
    await db.records.add({
      id: crypto.randomUUID(),
      userId: USER_ID,
      bookId: c.book.id,
      status: 'reading',
      startedAt: new Date().toISOString(),
      sessions: [],
      recommendedAtDelta: delta,
    });
  }

  async function addToQueue(c: ScoredCandidate) {
    await db.records.add({
      id: crypto.randomUUID(),
      userId: USER_ID,
      bookId: c.book.id,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      sessions: [],
      recommendedAtDelta: delta,
    });
  }

  async function notForMe(c: ScoredCandidate) {
    const list = (await getMeta<string[]>('notForMe')) ?? [];
    if (!list.includes(c.book.id)) await setMeta('notForMe', [...list, c.book.id]);
  }

  if (!output) {
    return <div className="pt-16 text-[14px] text-ink-3">Consulting the ledger…</div>;
  }

  const hero = output.hero;
  const toGo = Math.max(0, LEARNING_THRESHOLD - output.ratedCount);

  return (
    <>
      {output.learning && (
        <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-card border border-hairline bg-surface px-5 py-3.5">
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[.08em] text-accent-ink">
            Learning
          </span>
          <span className="text-[13.5px] text-ink-2">
            {output.coldStart
              ? 'No ratings yet — these picks come from your stated preferences, not your taste.'
              : `Rate ${toGo} more book${toGo === 1 ? '' : 's'} to unlock confident predictions.`}
          </span>
          <span className="tnum text-[12.5px] text-ink-3">
            {output.ratedCount} / {LEARNING_THRESHOLD}
          </span>
          <span className="flex-1" />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('marginalia:log-book'))}
            className="rounded-btn bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            Log a book you’ve read
          </button>
          <span className="text-[12px] text-ink-3">
            or press{' '}
            <kbd className="rounded-[5px] border border-hairline bg-porcelain px-1.5 text-[11px]">N</kbd>{' '}
            anywhere
          </span>
        </div>
      )}

      {hero ? (
        <section className="mt-11 grid grid-cols-1 items-center gap-12 rounded-panel border border-hairline bg-surface p-8 shadow-raised md:grid-cols-[1fr_300px] md:px-12 md:py-11">
          <div>
            <div className="label-caps mb-3.5 !tracking-[.14em]">
              Next up · <b className="font-semibold text-accent">chosen for you</b>
            </div>
            <h1 className="mb-2 mt-1.5 font-serif text-[clamp(32px,4.6vw,46px)] font-medium leading-[1.06] tracking-[-0.01em]">
              {hero.book.title}
            </h1>
            <div className="mb-[18px] text-[15.5px] text-ink-2">
              {hero.book.author}
              {hero.book.year ? ` · ${hero.book.year}` : ''}
            </div>
            <div className="mb-[22px] flex flex-wrap gap-2">
              <span className="rounded-full border border-hairline bg-porcelain px-3 py-1 text-[12.5px] font-medium text-ink-2">
                {hero.book.series
                  ? `${hero.book.series} #${hero.book.seriesIndex ?? '?'}`
                  : 'Standalone'}
              </span>
              {hero.book.audioHours && (
                <span className="tnum rounded-full border border-hairline bg-porcelain px-3 py-1 text-[12.5px] font-medium text-ink-2">
                  Audio · {formatHours(hero.book.audioHours)}
                </span>
              )}
              {hero.book.narrator && (
                <span className="rounded-full border border-hairline bg-porcelain px-3 py-1 text-[12.5px] font-medium text-ink-2">
                  Narrated by {hero.book.narrator}
                </span>
              )}
              {!hero.book.profileVerified && (
                <span className="rounded-full border border-hairline bg-porcelain px-3 py-1 text-[12.5px] font-medium text-ink-3">
                  Unverified profile
                </span>
              )}
            </div>
            <div className="mb-5 max-w-[52ch] border-l-2 border-hairline pl-4 text-[15px] leading-[1.7] text-ink-2">
              {hero.reasons.map((r, i) => (
                <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                  {r}
                </p>
              ))}
            </div>
            {hero.prediction && (
              <div className="mb-7 flex flex-wrap gap-2">
                {hero.prediction.neighbours.slice(0, 3).map((n) => (
                  <span
                    key={n.bookId}
                    className="flex items-baseline gap-[7px] rounded-input border border-hairline bg-porcelain px-[11px] py-1.5 text-[12.5px] text-ink-2"
                  >
                    <b className="font-semibold text-ink">{n.title}</b>
                    <span className="tnum text-ink-3">{n.sim.toFixed(2)}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => startReading(hero)}
                className="rounded-btn bg-accent px-5 py-[11px] text-[14px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-accent-ink"
              >
                Start reading
              </button>
              <button
                onClick={() => addToQueue(hero)}
                className="rounded-btn bg-accent-soft px-5 py-[11px] text-[14px] font-semibold text-accent-ink transition-colors hover:bg-[#DFE3FD]"
              >
                Want to read
              </button>
              <button
                onClick={() => notForMe(hero)}
                className="rounded-btn border border-hairline px-5 py-[11px] text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
              >
                Not for me
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-[26px]">
            <Link href={`/library/${hero.book.id}`} className="block">
              <BookCover book={hero.book} className="h-[258px] w-[172px] shadow-cover" titleSize={17} />
            </Link>
            <div className="flex items-center gap-4">
              <RingGauge value={hero.prediction ? hero.prediction.rHat : null} />
              <div>
                <div className="label-caps !text-[12px]">Predicted rating</div>
                <div className="mt-0.5 text-[14px] text-ink-2">
                  {hero.prediction ? (
                    <>
                      <b className="tnum font-semibold text-ink">{hero.prediction.rHat.toFixed(1)}</b>{' '}
                      ± {hero.prediction.band.toFixed(1)} · {hero.prediction.confidence} confidence
                    </>
                  ) : (
                    'unscored — no ratings yet'
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-11 rounded-panel border border-hairline bg-surface p-10 text-[15px] text-ink-2">
          Nothing passes your filters right now. Loosen a standing rule in Settings, widen the
          runtime window, or log a few books to give the librarian more shelf to work with.
        </section>
      )}

      <div className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[380px_1fr]">
        <DiscoveryRange
          stopIndex={stopIndex}
          onChange={changeStop}
          note={
            rangeReturns ? (
              <>
                Your hit rate at this range:{' '}
                <b className="tnum font-semibold text-ink">{rangeReturns.avg.toFixed(1)} avg</b> across{' '}
                {rangeReturns.n} book{rangeReturns.n === 1 ? '' : 's'}. The list re-ranks as you move.
              </>
            ) : (
              <>No finished books from this range yet — its record starts with your next pick.</>
            )
          }
        />

        <div className="rounded-panel border border-hairline bg-surface p-8">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">The shortlist</h2>
          <div className="mb-6 text-[13.5px] text-ink-2">
            Five picks, ranked — each different from the last.
          </div>
          <div>
            {output.shortlist.map((c, i) => (
              <Link
                key={`${stopIndex}-${c.book.id}`}
                href={`/library/${c.book.id}`}
                className="row-in grid grid-cols-[26px_1fr_auto] items-center gap-4 border-b border-hairline-2 px-1.5 py-[15px] last:border-b-0 hover:bg-porcelain"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <div className="tnum text-[12.5px] font-medium text-ink-3">0{i + 1}</div>
                <div>
                  <div className="font-serif text-[17px] font-medium leading-[1.3]">
                    {c.book.title}
                    {c.wildcard && (
                      <span className="relative -top-0.5 ml-2 rounded-md bg-accent-soft px-[7px] py-0.5 font-sans text-[10.5px] font-semibold uppercase tracking-[.06em] text-accent">
                        Wildcard
                      </span>
                    )}
                  </div>
                  <div className="mt-px text-[12.5px] text-ink-2">
                    {c.book.author}
                    {c.book.audioHours ? ` · ${formatHours(c.book.audioHours)}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tnum text-[15px] font-semibold">
                    {c.wildcard || !c.prediction ? '—' : c.prediction.rHat.toFixed(1)}
                  </div>
                  <div className="tnum text-[11.5px] text-ink-3">
                    {c.wildcard || !c.prediction ? 'unscored' : `± ${c.prediction.band.toFixed(1)}`}
                  </div>
                </div>
              </Link>
            ))}
            {output.shortlist.length === 0 && (
              <div className="py-6 text-[14px] text-ink-3">Nothing passes the filters.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
}
