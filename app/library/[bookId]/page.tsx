'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { AXES, AXIS_LABELS, DNF_LABELS, USER_ID, type Axis, type ReadingRecord } from '@/lib/types';
import BookCover from '@/components/BookCover';

// Button hierarchy: one filled-accent primary per state; accent-soft for
// constructive secondaries; hairline for neutral/quiet actions.
const BTN = {
  primary: 'rounded-btn bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-ink',
  soft: 'rounded-btn bg-accent-soft px-4 py-2.5 text-[13.5px] font-semibold text-accent-ink transition-colors hover:bg-[#DFE3FD]',
  quiet: 'rounded-btn border border-hairline px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink',
};

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

  const ordered = [...records].sort((a, b) =>
    (a.startedAt ?? a.finishedAt ?? a.queuedAt ?? '').localeCompare(
      b.startedAt ?? b.finishedAt ?? b.queuedAt ?? '',
    ),
  );
  const latest: ReadingRecord | undefined = ordered[ordered.length - 1];
  const latestRating = latest
    ? ratings.find((r) => r.readingRecordId === latest.id)
    : undefined;
  const readCount = records.filter((r) => r.status === 'finished').length;

  const state: 'unread' | 'queued' | 'reading' | 'finished' | 'abandoned' =
    !latest ? 'unread'
    : latest.status === 'queued' ? 'queued'
    : latest.status === 'reading' || latest.status === 'paused' ? 'reading'
    : latest.status === 'finished' ? 'finished'
    : 'abandoned';

  async function saveAxes() {
    if (!axes) return;
    // The reader's perception is ground truth (§IV): editing verifies the profile.
    await db.books.update(bookId, { axes, profileVerified: true });
    setDirty(false);
  }

  async function startReading() {
    if (latest && latest.status === 'queued') {
      await db.records.update(latest.id, { status: 'reading', startedAt: new Date().toISOString() });
    } else {
      // Re-reads are new records (§IV).
      await db.records.add({
        id: crypto.randomUUID(),
        userId: USER_ID,
        bookId,
        status: 'reading',
        startedAt: new Date().toISOString(),
        sessions: [],
      });
    }
  }

  async function wantToRead() {
    await db.records.add({
      id: crypto.randomUUID(),
      userId: USER_ID,
      bookId,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      sessions: [],
    });
  }

  // "Already read it" — turn the current encounter (or a fresh one) into a
  // finished record and open the review.
  async function alreadyRead() {
    let id: string;
    if (latest && (latest.status === 'queued' || latest.status === 'reading' || latest.status === 'paused')) {
      id = latest.id;
    } else {
      id = crypto.randomUUID();
      await db.records.add({ id, userId: USER_ID, bookId, status: 'reading', sessions: [] });
    }
    router.push(`/review/${id}`);
  }

  return (
    <div className="mt-11 grid grid-cols-1 gap-12 md:grid-cols-[220px_1fr]">
      <div>
        <BookCover book={book} className="h-[330px] w-[220px] shadow-cover" titleSize={17} />
        <div className="mt-6 flex flex-col gap-2.5">
          {state === 'unread' && (
            <>
              <button onClick={startReading} className={BTN.primary}>Start reading</button>
              <button onClick={wantToRead} className={BTN.soft}>Want to read</button>
              <button onClick={alreadyRead} className={BTN.quiet}>Already read it? Rate it</button>
            </>
          )}
          {state === 'queued' && (
            <>
              <button onClick={startReading} className={BTN.primary}>Start reading</button>
              <button onClick={() => db.records.delete(latest!.id)} className={BTN.quiet}>
                Remove from queue
              </button>
              <button onClick={alreadyRead} className={BTN.quiet}>Already read it? Rate it</button>
            </>
          )}
          {state === 'reading' && (
            <>
              <button onClick={() => router.push(`/review/${latest!.id}`)} className={BTN.primary}>
                Finished — rate it
              </button>
              <button onClick={() => router.push(`/review/${latest!.id}?mode=dnf`)} className={BTN.quiet}>
                Stopping here
              </button>
              <button
                onClick={() =>
                  db.records.update(latest!.id, {
                    status: latest!.status === 'paused' ? 'reading' : 'paused',
                  })
                }
                className={BTN.quiet}
              >
                {latest!.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
            </>
          )}
          {state === 'finished' && (
            <>
              <button onClick={() => router.push(`/review/${latest!.id}`)} className={BTN.soft}>
                {latestRating ? 'Edit your review' : 'Rate it'}
              </button>
              <button onClick={startReading} className={BTN.quiet}>Read it again</button>
            </>
          )}
          {state === 'abandoned' && (
            <>
              <button onClick={startReading} className={BTN.soft}>Give it another go</button>
              <button onClick={alreadyRead} className={BTN.quiet}>Finished it after all? Rate it</button>
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

        {/* Your history with this book — always first, always unambiguous. */}
        {state === 'finished' && (
          <div className="mt-5 rounded-card border border-hairline bg-surface px-5 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] font-semibold uppercase tracking-[.08em] text-positive">
                ✓ Read{readCount > 1 ? ` ×${readCount}` : ''}
              </span>
              {latestRating ? (
                <span className="tnum text-[16px] font-semibold">★ {latestRating.verdict.toFixed(1)}</span>
              ) : (
                <span className="text-[13.5px] text-ink-2">finished, not yet rated</span>
              )}
              {latest?.finishedAt && (
                <span className="text-[13px] text-ink-3">
                  {new Date(latest.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {latest?.format && (
                <span className="text-[13px] text-ink-2">
                  {latest.format === 'audio' ? 'listened' : latest.format}
                </span>
              )}
              {latestRating?.wouldReread && (
                <span className="text-[13px] text-ink-2">would re-read</span>
              )}
              {latestRating && latestRating.moods.length > 0 && (
                <span className="text-[13px] text-ink-3">{latestRating.moods.join(' · ')}</span>
              )}
            </div>
            {latestRating?.note && (
              <p className="mt-2.5 max-w-[52ch] border-l-2 border-hairline pl-4 text-[14px] italic text-ink-2">
                {latestRating.note}
              </p>
            )}
          </div>
        )}
        {state === 'abandoned' && (
          <div className="mt-5 rounded-card border border-hairline bg-surface px-5 py-4 text-[14px] text-ink-2">
            <span className="text-ink-3">
              Stopped{latest?.progressPct != null ? ` at ${latest.progressPct}%` : ''}
            </span>
            {latest?.dnfReason && <> · {DNF_LABELS[latest.dnfReason]}</>} — noted without penalty to
            similar themes you might still enjoy.
          </div>
        )}
        {state === 'reading' && (
          <div className="mt-5 text-[14px] text-ink-2">
            {latest!.status === 'paused' ? 'Paused' : 'Reading now'}
            {latest?.startedAt &&
              ` · since ${new Date(latest.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`}
          </div>
        )}
        {state === 'queued' && (
          <div className="mt-5 text-[14px] text-ink-2">On your want-to-read shortlist.</div>
        )}

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

        <section className="mt-10 max-w-[560px]">
          <div className="flex items-baseline justify-between">
            <h2 className="label-caps">Tone profile — describes the book, not your rating</h2>
            {dirty && (
              <button onClick={saveAxes} className="rounded-btn bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-accent-ink">
                Save profile
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Where this book sits on twelve axes — the coordinates the recommender navigates by.
            Your perception is ground truth; adjust freely
            {book.profileVerified ? '' : ' (saving marks the profile verified)'}.
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
