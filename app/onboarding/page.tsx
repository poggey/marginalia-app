'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, setMeta } from '@/lib/db';
import { deckBooks } from '@/lib/deck';
import { chipToPreference, parsePreference, PREF_CHIPS } from '@/lib/preferences';
import { tasteAxes } from '@/lib/recommender/taste';
import { verdictStrength } from '@/lib/recommender/weights';
import { searchBooks, cacheBookFromResult } from '@/lib/metadata/cache';
import type { BookSearchResult } from '@/lib/metadata/types';
import { USER_ID, type Book, type Rating, type ReadingRecord } from '@/lib/types';
import BookCover from '@/components/BookCover';
import RadarMini from '@/components/RadarMini';
import StarPicker from '@/components/StarPicker';

type Step = 1 | 2 | 3 | 4;

const NEUTRAL_AXES = { ideas: 5, pace: 5, characters: 5, prose: 5, ending: 5 };

async function saveCalibrationRating(book: Book, verdict: number, when = new Date()) {
  const iso = when.toISOString();
  const record: ReadingRecord = {
    id: crypto.randomUUID(),
    userId: USER_ID,
    bookId: book.id,
    status: 'finished',
    sessions: [],
  };
  const rating: Rating = {
    id: crypto.randomUUID(),
    userId: USER_ID,
    readingRecordId: record.id,
    axes: NEUTRAL_AXES, // verdict-only capture; the five axis sliders belong to the Review flow
    verdict,
    wouldReread: false,
    moods: [],
    ratedAt: iso,
  };
  await db.transaction('rw', [db.records, db.ratings], async () => {
    await db.records.add(record);
    await db.ratings.add(rating);
  });
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  async function finish() {
    await setMeta('onboarded', true);
    router.replace('/for-you');
  }

  return (
    <div className="mx-auto max-w-[760px] px-7 pb-24">
      <header className="flex items-baseline justify-between pt-10">
        <span className="font-serif text-[21px] font-medium italic">Marginalia</span>
        {step > 1 && <span className="label-caps">Step {step} of 4</span>}
      </header>
      {step === 1 && <Welcome onNext={() => setStep(2)} />}
      {step === 2 && <Preferences onNext={() => setStep(3)} />}
      {step === 3 && <Calibration onNext={() => setStep(4)} />}
      {step === 4 && <Backfill onFinish={finish} />}
    </div>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <section className="pt-[16vh] text-center">
      <h1 className="mx-auto max-w-[18ch] font-serif text-[clamp(32px,5vw,46px)] font-medium leading-[1.1] tracking-[-0.01em]">
        A librarian who never guesses.
      </h1>
      <div className="mx-auto mt-7 max-w-[52ch] text-left text-[16px] leading-[1.75] text-ink-2">
        <p>Marginalia opens knowing nothing about you — no assumed taste, no borrowed history.</p>
        <p className="mt-3">
          Everything it learns comes from what you tell it and what you rate, and it will always
          show you the working behind every recommendation.
        </p>
        <p className="mt-3">The next three steps are optional; skipping costs you nothing but precision.</p>
      </div>
      <button
        onClick={onNext}
        className="mt-10 rounded-btn bg-accent px-7 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-px hover:bg-accent-ink"
      >
        Begin
      </button>
    </section>
  );
}

function Preferences({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [freeText, setFreeText] = useState('');
  const [added, setAdded] = useState<string[]>([]);
  const [pending, setPending] = useState<ReturnType<typeof parsePreference>[]>([]);

  function addFreeText() {
    const t = freeText.trim();
    if (!t) return;
    const pref = parsePreference(t);
    setPending((p) => [...p, pref]);
    setAdded((a) => [...a, pref.effect ? pref.label : `${pref.label} (noted, not yet enforced)`]);
    setFreeText('');
  }

  async function save() {
    const prefs = [...selected].map((i) => chipToPreference(PREF_CHIPS[i]));
    await db.prefs.bulkAdd([...prefs, ...pending]);
    onNext();
  }

  return (
    <section className="pt-14">
      <div className="label-caps mb-3">Stated preferences</div>
      <h2 className="font-serif text-[30px] font-medium leading-tight">
        Anything the librarian should know already?
      </h2>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">
        These become standing rules — filters and nudges, never fake ratings. Edit them any time in
        Settings.
      </p>
      <div className="mt-7 flex flex-wrap gap-2.5">
        {PREF_CHIPS.map((chip, i) => {
          const on = selected.has(i);
          return (
            <button
              key={chip.label}
              onClick={() => {
                const next = new Set(selected);
                if (on) next.delete(i);
                else next.add(i);
                setSelected(next);
              }}
              aria-pressed={on}
              className={`rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors ${
                on
                  ? 'border-accent bg-accent-soft text-accent-ink'
                  : 'border-hairline bg-surface text-ink-2 hover:border-ink-3'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex gap-2.5">
        <input
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addFreeText()}
          placeholder="Or say it your way — “no horror”, “under 12 h”…"
          className="w-full max-w-[420px] rounded-input border border-hairline bg-surface px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-ink-3"
        />
        <button
          onClick={addFreeText}
          className="rounded-btn border border-hairline px-5 text-[14px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
        >
          Add
        </button>
      </div>
      {added.length > 0 && (
        <div className="mt-3 text-[13px] text-ink-2">Noted: {added.join(' · ')}</div>
      )}
      <div className="mt-10 flex items-center gap-5">
        <button
          onClick={save}
          className="rounded-btn bg-accent px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink"
        >
          Continue
        </button>
        <button onClick={onNext} className="text-[14px] font-medium text-ink-2 hover:text-ink">
          Skip this step
        </button>
      </div>
    </section>
  );
}

function Calibration({ onNext }: { onNext: () => void }) {
  const deck = useMemo(() => deckBooks(), []);
  const [index, setIndex] = useState(0);
  const [rated, setRated] = useState<{ book: Book; verdict: number }[]>([]);
  const [verdict, setVerdict] = useState<number | null>(null);

  const axes = useMemo(
    () =>
      tasteAxes(
        rated.map((r) => ({ book: r.book, weight: Math.max(0, verdictStrength(r.verdict)) })),
      ),
    [rated],
  );

  const done = index >= deck.length;
  const book = done ? null : deck[index];

  async function submit() {
    if (!book || verdict === null) return;
    await saveCalibrationRating(book, verdict);
    setRated((r) => [...r, { book, verdict }]);
    setVerdict(null);
    setIndex((i) => i + 1);
  }

  function skip() {
    setVerdict(null);
    setIndex((i) => i + 1);
  }

  return (
    <section className="pt-14">
      <div className="label-caps mb-3">The calibration deck</div>
      <h2 className="font-serif text-[30px] font-medium leading-tight">Rate what you recognise.</h2>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">
        Twenty well-travelled titles spanning all twelve axes. Skipped cards cost nothing.
      </p>
      <div className="mt-9 grid grid-cols-1 items-start gap-10 sm:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          {book ? (
            <div className="rounded-panel border border-hairline bg-surface p-8 shadow-raised">
              <div className="flex items-start gap-7">
                <BookCover book={book} className="h-[186px] w-[124px] shrink-0" titleSize={13} />
                <div className="min-w-0">
                  <div className="tnum text-[12.5px] text-ink-3">
                    {index + 1} / {deck.length}
                  </div>
                  <div className="mt-1 font-serif text-[26px] font-medium leading-[1.15]">
                    {book.title}
                  </div>
                  <div className="mt-1 text-[14px] text-ink-2">
                    {book.author}
                    {book.year ? ` · ${book.year}` : ''}
                  </div>
                  <div className="mt-5">
                    <StarPicker value={verdict} onChange={setVerdict} />
                  </div>
                  <div className="mt-6 flex items-center gap-4">
                    <button
                      onClick={submit}
                      disabled={verdict === null}
                      className="rounded-btn bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rate it
                    </button>
                    <button onClick={skip} className="text-[14px] font-medium text-ink-2 hover:text-ink">
                      Haven’t read it
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-panel border border-hairline bg-surface p-8 text-[15px] text-ink-2">
              Deck complete — {rated.length} rating{rated.length === 1 ? '' : 's'} banked.
            </div>
          )}
          <div className="mt-8 flex items-center gap-5">
            <button
              onClick={onNext}
              className="rounded-btn bg-accent px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink"
            >
              {done ? 'Continue' : rated.length > 0 ? `Continue with ${rated.length}` : 'Skip this step'}
            </button>
            {!done && rated.length === 0 && (
              <span className="text-[13px] text-ink-3">You can backfill real history next.</span>
            )}
          </div>
        </div>
        <div className="justify-self-center">
          <RadarMini values={axes} />
          <div className="label-caps mt-2 text-center">Your taste, forming</div>
        </div>
      </div>
    </section>
  );
}

function Backfill({ onFinish }: { onFinish: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<BookSearchResult | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [verdict, setVerdict] = useState<number | null>(null);
  const [logged, setLogged] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function search() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setResults(await searchBooks(query.trim()));
    setSearching(false);
  }

  async function saveAndNext() {
    if (!picked || verdict === null || saving) return;
    setSaving(true);
    const book = await cacheBookFromResult(picked);
    // Year read anchors recency decay honestly — an old five-star counts less.
    await saveCalibrationRating(book, verdict, new Date(Date.UTC(year, 6, 1)));
    setLogged((l) => [...l, book.title]);
    setPicked(null);
    setVerdict(null);
    setQuery('');
    setResults([]);
    setSaving(false);
  }

  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

  return (
    <section className="pt-14">
      <div className="label-caps mb-3">Backfill</div>
      <h2 className="font-serif text-[30px] font-medium leading-tight">
        Want to log books you’ve already read?
      </h2>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-2">
        Rapid fire: search, year read, verdict, next. Resume any time from the Library — the model
        sharpens with every one.
      </p>
      <div className="mt-7 max-w-[480px]">
        {!picked && (
          <>
            <div className="flex gap-2.5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="Search by title or author…"
                className="w-full rounded-input border border-hairline bg-surface px-4 py-2.5 text-[14px] outline-none placeholder:text-ink-3 focus:border-ink-3"
              />
              <button
                onClick={search}
                className="rounded-btn border border-hairline px-5 text-[14px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
              >
                Search
              </button>
            </div>
            {searching && <div className="mt-3 text-[13.5px] text-ink-3">Searching…</div>}
            {results.length > 0 && (
              <ul className="mt-4 max-h-[260px] overflow-y-auto rounded-card border border-hairline bg-surface">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      onClick={() => setPicked(r)}
                      className="w-full border-b border-hairline-2 px-4 py-2.5 text-left last:border-b-0 hover:bg-porcelain"
                    >
                      <span className="font-serif text-[15.5px] font-medium">{r.title}</span>
                      <span className="ml-2 text-[12.5px] text-ink-2">
                        {r.author}
                        {r.year ? ` · ${r.year}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {picked && (
          <div className="rounded-panel border border-hairline bg-surface p-6">
            <div className="font-serif text-[20px] font-medium leading-tight">{picked.title}</div>
            <div className="text-[13.5px] text-ink-2">{picked.author}</div>
            <div className="mt-4 flex items-center gap-4">
              <label className="label-caps" htmlFor="yearRead">
                Year read
              </label>
              <select
                id="yearRead"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-input border border-hairline bg-surface px-3 py-1.5 text-[14px]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <StarPicker value={verdict} onChange={setVerdict} />
            </div>
            <div className="mt-5 flex gap-4">
              <button
                onClick={saveAndNext}
                disabled={verdict === null || saving}
                className="rounded-btn bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink disabled:opacity-40"
              >
                Save · next
              </button>
              <button
                onClick={() => setPicked(null)}
                className="text-[14px] font-medium text-ink-2 hover:text-ink"
              >
                Back
              </button>
            </div>
          </div>
        )}
        {logged.length > 0 && (
          <div className="mt-4 text-[13px] text-ink-2">Logged: {logged.join(' · ')}</div>
        )}
      </div>
      <div className="mt-10">
        <button
          onClick={onFinish}
          className="rounded-btn bg-accent px-7 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-accent-ink"
        >
          {logged.length > 0 ? 'Finish — to your picks' : 'Skip — take me to my picks'}
        </button>
      </div>
    </section>
  );
}
