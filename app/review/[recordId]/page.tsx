'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { AXES, AXIS_LABELS, DNF_LABELS, USER_ID, type Axis, type DnfReason } from '@/lib/types';
import StarPicker from '@/components/StarPicker';
import BookCover from '@/components/BookCover';

const RATING_AXES = [
  { key: 'ideas', label: 'Ideas' },
  { key: 'pace', label: 'Pace' },
  { key: 'characters', label: 'Characters' },
  { key: 'prose', label: 'Prose' },
  { key: 'ending', label: 'Ending' },
] as const;

export default function ReviewPage({ params }: { params: Promise<{ recordId: string }> }) {
  return (
    <Suspense fallback={null}>
      <Review params={params} />
    </Suspense>
  );
}

function Review({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = use(params);
  const router = useRouter();
  const dnfMode = useSearchParams().get('mode') === 'dnf';

  // One review per book: whatever encounter opened this page, we load and
  // update the book's single review — a re-read edits it, never duplicates it.
  const data = useLiveQuery(async () => {
    const record = await db.records.get(recordId);
    const book = record ? await db.books.get(record.bookId) : undefined;
    let existing;
    let bookRecordIds: string[] = [];
    if (record) {
      const recs = await db.records.where('bookId').equals(record.bookId).toArray();
      bookRecordIds = recs.map((r) => r.id);
      const bookRatings = (await db.ratings.toArray())
        .filter((r) => bookRecordIds.includes(r.readingRecordId))
        .sort((a, b) => a.ratedAt.localeCompare(b.ratedAt));
      existing = bookRatings[bookRatings.length - 1];
    }
    return { record, book, existing, bookRecordIds };
  }, [recordId]);

  const [axes, setAxes] = useState({ ideas: 5, pace: 5, characters: 5, prose: 5, ending: 5 });
  const [format, setFormat] = useState<'audio' | 'print' | 'ebook' | null>(null);
  const [verdict, setVerdict] = useState<number | null>(null);
  const [wouldReread, setWouldReread] = useState(false);
  const [moods, setMoods] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [toneOpen, setToneOpen] = useState(false);
  const [toneAxes, setToneAxes] = useState<Record<Axis, number> | null>(null);
  const [toneTouched, setToneTouched] = useState(false);
  const [reason, setReason] = useState<DnfReason | null>(null);
  const [progress, setProgress] = useState<number>(50);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Editing an existing review prefills every field, once.
  useEffect(() => {
    if (prefilled || !data) return;
    if (data.existing) {
      setAxes(data.existing.axes);
      setVerdict(data.existing.verdict);
      setWouldReread(data.existing.wouldReread);
      setMoods(data.existing.moods);
      setNote(data.existing.note ?? '');
    }
    if (data.record?.format) setFormat(data.record.format);
    if (data.book) setToneAxes({ ...data.book.axes });
    if (data.record || data.existing) setPrefilled(true);
  }, [data, prefilled]);

  if (!data) return null;
  const { record, book, existing, bookRecordIds } = data;
  if (!record || !book) {
    return <div className="pt-16 text-[14px] text-ink-3">That reading record no longer exists.</div>;
  }
  const editing = !!existing;
  // Finishing an encounter now (first read or a re-read) refreshes the
  // review's recency; a pure edit of an already-finished read does not.
  const finishingNow = record.status !== 'finished';

  async function confirmRating() {
    if (verdict === null || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.transaction('rw', [db.records, db.ratings, db.books], async () => {
      await db.records.update(recordId, {
        status: 'finished',
        finishedAt: record!.finishedAt ?? now,
        format: format ?? undefined,
      });
      let keptId: string;
      if (existing) {
        keptId = existing.id;
        await db.ratings.update(existing.id, {
          axes, verdict, wouldReread, moods, note: note.trim() || undefined,
          ...(finishingNow ? { readingRecordId: recordId, ratedAt: now } : {}),
        });
      } else {
        keptId = crypto.randomUUID();
        await db.ratings.add({
          id: keptId,
          userId: USER_ID,
          readingRecordId: recordId,
          axes,
          verdict,
          wouldReread,
          moods,
          note: note.trim() || undefined,
          ratedAt: now,
        });
      }
      // Enforce one review per book: clear strays left by older versions.
      const strays = (await db.ratings.toArray()).filter(
        (r) => r.id !== keptId && bookRecordIds.includes(r.readingRecordId),
      );
      if (strays.length) await db.ratings.bulkDelete(strays.map((r) => r.id));
      if (toneTouched && toneAxes) {
        // The reader's perception is ground truth (§IV).
        await db.books.update(book!.id, { axes: toneAxes, profileVerified: true });
      }
    });
    setConfirmed(true);
    setTimeout(() => router.push(editing ? `/library/${book!.id}` : '/for-you'), 700);
  }

  async function confirmDnf() {
    if (!reason || saving) return;
    setSaving(true);
    await db.records.update(recordId, {
      status: 'abandoned',
      finishedAt: new Date().toISOString(),
      progressPct: progress,
      dnfReason: reason,
    });
    setConfirmed(true);
    setTimeout(() => router.push('/library'), 700);
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center pt-[24vh] text-center">
        <div className="font-serif text-[30px] font-medium">Noted.</div>
        <div className="mt-2 text-[14px] text-ink-2">
          {dnfMode
            ? 'Stopping is data, not defeat.'
            : editing
              ? 'Your review is updated.'
              : 'The model just got a little sharper.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-11 max-w-[640px]">
      <div className="flex items-center gap-6">
        <BookCover book={book} className="h-[120px] w-[80px] shrink-0" titleSize={11} />
        <div>
          <div className="label-caps mb-1.5">
            {dnfMode
              ? 'Stopping'
              : editing
                ? finishingNow
                  ? 'Back again — your review'
                  : 'Editing your review'
                : 'The sixty-second review'}
          </div>
          <h1 className="font-serif text-[28px] font-medium leading-[1.15]">{book.title}</h1>
          <div className="text-[14px] text-ink-2">{book.author}</div>
          {editing && !dnfMode && (
            <div className="mt-1 text-[13px] text-ink-3">
              {finishingNow
                ? `You've read this before (★ ${existing!.verdict.toFixed(1)}) — update your review if this read changed your mind.`
                : `You rated this ★ ${existing!.verdict.toFixed(1)} — changes replace that review.`}
            </div>
          )}
        </div>
      </div>

      {dnfMode ? (
        <section className="mt-9 rounded-panel border border-hairline bg-surface p-8">
          <p className="text-[15px] text-ink-2">
            One question only: why? No guilt — negative data is data, and{' '}
            <em>wrong mood</em> carries no penalty at all.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(DNF_LABELS) as DnfReason[]).map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors ${
                  reason === r
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-hairline bg-porcelain text-ink-2 hover:border-ink-3'
                }`}
              >
                {DNF_LABELS[r]}
              </button>
            ))}
          </div>
          <label className="mt-6 flex items-center gap-4 text-[13px] text-ink-2">
            Stopped at
            <input
              type="range"
              min={0}
              max={95}
              step={1}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-48 accent-[#3546E8]"
            />
            <span className="tnum w-10 font-medium text-ink">{progress}%</span>
          </label>
          <button
            onClick={confirmDnf}
            disabled={!reason || saving}
            className="mt-7 rounded-btn bg-accent px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-40"
          >
            Log it
          </button>
        </section>
      ) : (
        <section className="mt-9 rounded-panel border border-hairline bg-surface p-8">
          <div className="label-caps mb-4">How it landed for you</div>
          <div className="flex flex-col gap-4">
            {RATING_AXES.map(({ key, label }) => (
              <label key={key} className="grid grid-cols-[96px_1fr_36px] items-center gap-4 text-[13px] text-ink-2">
                <span className="text-right font-medium">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={axes[key]}
                  onChange={(e) => setAxes({ ...axes, [key]: Number(e.target.value) })}
                  className="accent-[#3546E8]"
                  aria-label={label}
                />
                <span className="tnum text-ink-3">{axes[key]}</span>
              </label>
            ))}
          </div>

          <div className="mt-8 border-t border-hairline-2 pt-6">
            <div className="label-caps mb-2.5">How did you read it?</div>
            <div className="flex gap-2">
              {(['audio', 'print', 'ebook'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  aria-pressed={format === f}
                  className={`rounded-full border px-4 py-1.5 text-[13px] font-medium capitalize transition-colors ${
                    format === f
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-hairline bg-porcelain text-ink-2 hover:border-ink-3'
                  }`}
                >
                  {f === 'audio' ? 'Listened' : f === 'print' ? 'Print' : 'Ebook'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 border-t border-hairline-2 pt-6">
            <div className="label-caps mb-2.5">The verdict</div>
            <StarPicker value={verdict} onChange={setVerdict} />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="text-[14px] font-medium">Would you re-read it?</span>
            <button
              onClick={() => setWouldReread(!wouldReread)}
              aria-pressed={wouldReread}
              className={`rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                wouldReread
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-hairline bg-porcelain text-ink-2 hover:border-ink-3'
              }`}
            >
              {wouldReread ? 'Yes — gladly' : 'Probably not'}
            </button>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A line for your future self (optional)…"
            rows={2}
            className="mt-6 w-full rounded-input border border-hairline bg-porcelain px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-ink-3"
          />

          <div className="mt-8 border-t border-hairline-2 pt-6">
            <button
              onClick={() => setToneOpen(!toneOpen)}
              aria-expanded={toneOpen}
              className="flex w-full items-baseline justify-between text-left"
            >
              <span className="label-caps">Tone profile — optional</span>
              <span className="text-[12.5px] font-semibold text-accent">
                {toneOpen ? 'Hide' : 'Describe the book'}
              </span>
            </button>
            <p className="mt-1.5 text-[13px] text-ink-2">
              Not part of your rating — these twelve axes describe the book itself, and sharpen
              recommendations. Skip freely; you can adjust them any time from the book page.
            </p>
            {toneOpen && toneAxes && (
              <div className="mt-5 flex flex-col gap-3">
                {AXES.map((a) => (
                  <label key={a} className="grid grid-cols-[110px_1fr_36px] items-center gap-4 text-[12.5px] text-ink-2">
                    <span className="text-right">{AXIS_LABELS[a]}</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={toneAxes[a] * 10}
                      onChange={(e) => {
                        setToneAxes({ ...toneAxes, [a]: Number(e.target.value) / 10 });
                        setToneTouched(true);
                      }}
                      className="accent-[#3546E8]"
                      aria-label={AXIS_LABELS[a]}
                    />
                    <span className="tnum text-ink-3">{(toneAxes[a] * 10).toFixed(1)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={confirmRating}
            disabled={verdict === null || saving}
            className="mt-6 rounded-btn bg-accent px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing ? 'Save changes' : 'Confirm'}
          </button>
        </section>
      )}
    </div>
  );
}
