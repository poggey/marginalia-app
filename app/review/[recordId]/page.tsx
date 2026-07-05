'use client';

import { Suspense, use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { DNF_LABELS, USER_ID, type DnfReason } from '@/lib/types';
import StarPicker from '@/components/StarPicker';
import BookCover from '@/components/BookCover';

const RATING_AXES = [
  { key: 'ideas', label: 'Ideas' },
  { key: 'pace', label: 'Pace' },
  { key: 'characters', label: 'Characters' },
  { key: 'prose', label: 'Prose' },
  { key: 'ending', label: 'Ending' },
] as const;

const MOODS = [
  'gripped', 'cosy', 'awed', 'moved', 'amused',
  'unsettled', 'nostalgic', 'challenged', 'soothed', 'electrified',
];

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

  const data = useLiveQuery(async () => {
    const record = await db.records.get(recordId);
    const book = record ? await db.books.get(record.bookId) : undefined;
    return { record, book };
  }, [recordId]);

  const [axes, setAxes] = useState({ ideas: 5, pace: 5, characters: 5, prose: 5, ending: 5 });
  const [verdict, setVerdict] = useState<number | null>(null);
  const [wouldReread, setWouldReread] = useState(false);
  const [moods, setMoods] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState<DnfReason | null>(null);
  const [progress, setProgress] = useState<number>(50);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (!data) return null;
  const { record, book } = data;
  if (!record || !book) {
    return <div className="pt-16 text-[14px] text-ink-3">That reading record no longer exists.</div>;
  }

  async function confirmRating() {
    if (verdict === null || saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    await db.transaction('rw', [db.records, db.ratings], async () => {
      await db.records.update(recordId, {
        status: 'finished',
        finishedAt: record!.finishedAt ?? now,
      });
      await db.ratings.add({
        id: crypto.randomUUID(),
        userId: USER_ID,
        readingRecordId: recordId,
        axes,
        verdict,
        wouldReread,
        moods,
        note: note.trim() || undefined,
        ratedAt: now,
      });
    });
    setConfirmed(true);
    setTimeout(() => router.push('/for-you'), 700); // the one clean transition
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
          {dnfMode ? 'Stopping is data, not defeat.' : 'The model just got a little sharper.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-11 max-w-[640px]">
      <div className="flex items-center gap-6">
        <BookCover book={book} className="h-[120px] w-[80px] shrink-0" titleSize={11} />
        <div>
          <div className="label-caps mb-1.5">{dnfMode ? 'Stopping' : 'The sixty-second review'}</div>
          <h1 className="font-serif text-[28px] font-medium leading-[1.15]">{book.title}</h1>
          <div className="text-[14px] text-ink-2">{book.author}</div>
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

          <div className="mt-6">
            <div className="label-caps mb-2.5">Mood — up to three</div>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const on = moods.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() =>
                      setMoods(on ? moods.filter((x) => x !== m) : moods.length < 3 ? [...moods, m] : moods)
                    }
                    aria-pressed={on}
                    className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                      on
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-hairline bg-porcelain text-ink-2 hover:border-ink-3'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A line for your future self (optional)…"
            rows={2}
            className="mt-6 w-full rounded-input border border-hairline bg-porcelain px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-ink-3"
          />

          <button
            onClick={confirmRating}
            disabled={verdict === null || saving}
            className="mt-6 rounded-btn bg-accent px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm
          </button>
        </section>
      )}
    </div>
  );
}
