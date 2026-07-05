'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { AXES, AXIS_LABELS, DNF_LABELS, USER_ID, type Axis } from '@/lib/types';
import BookCover from '@/components/BookCover';

export default function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  const router = useRouter();

  const data = useLiveQuery(async () => {
    const book = await db.books.get(bookId);
    if (!book) return { book: undefined, records: [], ratings: [] };
    const records = await db.records.where('bookId').equals(bookId).toArray();
    const ratings = (await db.ratings.toArray()).filter((r) =>
      records.some((rec) => rec.id === r.readingRecordId),
    );
    return { book, records, ratings };
  }, [bookId]);

  const [axes, setAxes] = useState<Record<Axis, number> | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (data?.book && !dirty) setAxes({ ...data.book.axes });
  }, [data?.book, dirty]);

  if (!data) return null;
  const { book, records, ratings } = data;
  if (!book) return <div className="pt-16 text-[14px] text-ink-3">No such book in the catalogue.</div>;

  const latest = [...records].sort((a, b) =>
    (a.startedAt ?? a.finishedAt ?? '').localeCompare(b.startedAt ?? b.finishedAt ?? ''),
  )[records.length - 1] as (typeof records)[number] | undefined;

  async function saveAxes() {
    if (!axes) return;
    // The reader's perception is ground truth (§IV): editing verifies the profile.
    await db.books.update(bookId, { axes, profileVerified: true });
    setDirty(false);
  }

  async function createRecord(status: 'reading' | 'queued') {
    await db.records.add({
      id: crypto.randomUUID(),
      userId: USER_ID,
      bookId,
      status,
      startedAt: status === 'reading' ? new Date().toISOString() : undefined,
      queuedAt: status === 'queued' ? new Date().toISOString() : undefined,
      sessions: [],
    });
  }

  async function toReview(mode: 'rate' | 'dnf') {
    let record = latest;
    if (!record || ['finished', 'abandoned'].includes(record.status)) {
      const id = crypto.randomUUID();
      await db.records.add({ id, userId: USER_ID, bookId, status: 'reading', sessions: [] });
      record = await db.records.get(id);
    }
    router.push(`/review/${record!.id}${mode === 'dnf' ? '?mode=dnf' : ''}`);
  }

  const verdicts = ratings.sort((a, b) => a.ratedAt.localeCompare(b.ratedAt));

  return (
    <div className="mt-11 grid grid-cols-1 gap-12 md:grid-cols-[220px_1fr]">
      <div>
        <BookCover book={book} className="h-[330px] w-[220px] shadow-cover" titleSize={17} />
        <div className="mt-6 flex flex-col gap-2.5">
          {(!latest || ['finished', 'abandoned'].includes(latest.status)) && (
            <>
              <button onClick={() => createRecord('reading')} className="rounded-btn bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-ink">
                Start reading
              </button>
              <button onClick={() => createRecord('queued')} className="rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
                Add to queue
              </button>
              <button onClick={() => toReview('rate')} className="rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
                Read it — rate
              </button>
            </>
          )}
          {latest && ['reading', 'paused', 'queued'].includes(latest.status) && (
            <>
              {latest.status === 'queued' ? (
                <>
                  <button
                    onClick={() => db.records.update(latest.id, { status: 'reading', startedAt: new Date().toISOString() })}
                    className="rounded-btn bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-ink"
                  >
                    Start reading
                  </button>
                  <button onClick={() => db.records.delete(latest.id)} className="rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
                    Remove from queue
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => toReview('rate')} className="rounded-btn bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-ink">
                    Finished — rate it
                  </button>
                  <button onClick={() => toReview('dnf')} className="rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
                    Stopping here
                  </button>
                  <button
                    onClick={() => db.records.update(latest.id, { status: latest.status === 'paused' ? 'reading' : 'paused' })}
                    className="rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
                  >
                    {latest.status === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h1 className="font-serif text-[clamp(28px,4vw,40px)] font-medium leading-[1.1] tracking-[-0.01em]">
          {book.title}
        </h1>
        <div className="mt-1.5 text-[15px] text-ink-2">
          {book.author}
          {book.year ? ` · ${book.year}` : ''}
          {book.series ? ` · ${book.series} #${book.seriesIndex ?? '?'}` : ''}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {book.audioHours && (
            <span className="tnum rounded-full border border-hairline bg-surface px-3 py-1 text-[12.5px] text-ink-2">
              Audio · {book.audioHours} h
            </span>
          )}
          {book.pages && (
            <span className="tnum rounded-full border border-hairline bg-surface px-3 py-1 text-[12.5px] text-ink-2">
              {book.pages} pages
            </span>
          )}
          {book.narrator && (
            <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12.5px] text-ink-2">
              Narrated by {book.narrator}
            </span>
          )}
          <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12.5px] capitalize text-ink-3">
            {book.source === 'seed' ? 'calibration deck' : book.source}
          </span>
          {!book.profileVerified && (
            <span className="rounded-full border border-hairline bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-3">
              Unverified profile
            </span>
          )}
        </div>

        {book.themeTags.length > 0 && (
          <div className="mt-3 text-[13px] text-ink-3">{book.themeTags.join(' · ')}</div>
        )}

        {latest && (
          <div className="mt-6 text-[14px] text-ink-2">
            {latest.status === 'abandoned' ? (
              <>
                <span className="text-ink-3">
                  Stopped{latest.progressPct != null ? ` at ${latest.progressPct}%` : ''}
                </span>
                {latest.dnfReason && <> · {DNF_LABELS[latest.dnfReason]}</>}
              </>
            ) : (
              <span className="capitalize">{latest.status}</span>
            )}
            {verdicts.length > 0 && (
              <span className="tnum"> · ★ {verdicts[verdicts.length - 1].verdict.toFixed(1)}</span>
            )}
            {verdicts.length > 0 && verdicts[verdicts.length - 1].note && (
              <p className="mt-2 max-w-[52ch] border-l-2 border-hairline pl-4 text-[14px] italic text-ink-2">
                {verdicts[verdicts.length - 1].note}
              </p>
            )}
          </div>
        )}

        <section className="mt-10 max-w-[560px]">
          <div className="flex items-baseline justify-between">
            <h2 className="label-caps">Tone profile — twelve axes</h2>
            {dirty && (
              <button onClick={saveAxes} className="rounded-btn bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-ink">
                Save profile
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Your perception is ground truth — adjust freely{book.profileVerified ? '' : '; saving marks the profile verified'}.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            {axes &&
              AXES.map((a) => (
                <label key={a} className="grid grid-cols-[120px_1fr_44px] items-center gap-4 text-[12.5px] text-ink-2">
                  <span className="text-right">{AXIS_LABELS[a]}</span>
                  {/* Displayed 0–10 to match the Review sliders; stored 0..1 per the schema. */}
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={axes[a] * 10}
                    onChange={(e) => {
                      setAxes({ ...axes, [a]: Number(e.target.value) / 10 });
                      setDirty(true);
                    }}
                    className="accent-[#3546E8]"
                    aria-label={AXIS_LABELS[a]}
                    aria-valuetext={`${(axes[a] * 10).toFixed(1)} out of 10`}
                  />
                  <span className="tnum text-ink-3">{(axes[a] * 10).toFixed(1)}</span>
                </label>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
