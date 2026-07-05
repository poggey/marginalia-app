'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Book, Rating, ReadingRecord, ReadingStatus } from '@/lib/types';
import BookCover from '@/components/BookCover';

type Row = { book: Book; record?: ReadingRecord; rating?: Rating };
const STATUS_FILTERS: (ReadingStatus | 'all')[] = ['all', 'finished', 'reading', 'queued', 'paused', 'abandoned'];

import BookCard from '@/components/BookCard';

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <Library />
    </Suspense>
  );
}

function Library() {
  const initialQ = useSearchParams().get('q') ?? '';
  const [search, setSearch] = useState(initialQ);
  const q = search.trim().toLowerCase();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [format, setFormat] = useState<'all' | 'audio' | 'print' | 'ebook'>('all');
  const [table, setTable] = useState(false);

  useEffect(() => {
    const toggle = () => setTable((t) => !t);
    window.addEventListener('marginalia:toggle-view', toggle);
    return () => window.removeEventListener('marginalia:toggle-view', toggle);
  }, []);

  const rows = useLiveQuery(async () => {
    const [books, records, ratings] = await Promise.all([
      db.books.toArray(),
      db.records.toArray(),
      db.ratings.toArray(),
    ]);
    const booksById = new Map(books.map((b) => [b.id, b]));
    const recordsById = new Map(records.map((r) => [r.id, r]));
    // One review per book, whichever encounter it hangs off.
    const ratingByBook = new Map<string, Rating>();
    for (const rt of [...ratings].sort((a, b) => a.ratedAt.localeCompare(b.ratedAt))) {
      const rec = recordsById.get(rt.readingRecordId);
      if (rec) ratingByBook.set(rec.bookId, rt);
    }
    // The Library is the ledger: books with at least one encounter. Latest record wins.
    const latest = new Map<string, ReadingRecord>();
    const sorted = [...records].sort((a, b) =>
      (a.finishedAt ?? a.startedAt ?? '').localeCompare(b.finishedAt ?? b.startedAt ?? ''),
    );
    for (const r of sorted) latest.set(r.bookId, r);
    return [...latest.values()]
      .map((record) => ({
        book: booksById.get(record.bookId),
        record,
        rating: ratingByBook.get(record.bookId),
      }))
      .filter((r): r is { book: Book; record: ReadingRecord; rating: Rating | undefined } => !!r.book)
      .reverse();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => {
      if (status !== 'all' && r.record?.status !== status) return false;
      if (format !== 'all' && r.record?.format !== format) return false;
      if (q && !`${r.book.title} ${r.book.author} ${r.book.series ?? ''}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, status, format, q]);

  if (!filtered) return null;

  const readingNow = (rows ?? []).filter(
    (r) => r.record?.status === 'reading' || r.record?.status === 'paused',
  );

  return (
    <>
      {readingNow.length > 0 && (
        <section className="mt-11">
          <div className="label-caps mb-4">Reading now</div>
          <div className="flex flex-col gap-3">
            {readingNow.map(({ book, record }) => (
              <div
                key={record!.id}
                className="flex items-center gap-5 rounded-card border border-hairline bg-surface px-5 py-4"
              >
                <Link href={`/library/${book.id}`}>
                  <BookCover book={book} className="h-[66px] w-[44px]" titleSize={7} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/library/${book.id}`} className="truncate font-serif text-[17px] font-medium leading-tight">
                    {book.title}
                  </Link>
                  <div className="text-[12.5px] text-ink-2">
                    {book.author}
                    {record!.status === 'paused' ? ' · paused' : ''}
                    {record!.startedAt
                      ? ` · since ${new Date(record!.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                  </div>
                </div>
                <Link
                  href={`/review/${record!.id}`}
                  className="rounded-btn bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-[#DFE3FD]"
                >
                  Finished — rate it
                </Link>
                <Link
                  href={`/review/${record!.id}?mode=dnf`}
                  className="rounded-btn border border-hairline px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
                >
                  Stopping
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-11 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-serif text-[34px] font-medium tracking-[-0.01em]">Library</h1>
        <div className="flex items-center gap-3">
          <span className="tnum text-[13px] text-ink-3">
            {filtered.length} book{filtered.length === 1 ? '' : 's'}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter your library…"
            aria-label="Filter your library"
            className="w-[210px] rounded-input border border-hairline bg-surface px-3.5 py-[7px] text-[13.5px] outline-none placeholder:text-ink-3 focus:border-ink-3"
          />
          <button
            onClick={() => setTable((t) => !t)}
            className="rounded-btn border border-hairline px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
            aria-pressed={table}
          >
            {table ? 'Grid' : 'Table'} <kbd className="ml-1 text-[10.5px] text-ink-3">V</kbd>
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
              status === s
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-hairline bg-surface text-ink-2 hover:border-ink-3'
            }`}
          >
            {s === 'abandoned' ? 'Stopped' : s}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-hairline" />
        {(['all', 'audio', 'print', 'ebook'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
              format === f
                ? 'border-accent bg-accent-soft text-accent-ink'
                : 'border-hairline bg-surface text-ink-2 hover:border-ink-3'
            }`}
          >
            {f === 'all' ? 'Any format' : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-14 max-w-[48ch] text-[15px] leading-relaxed text-ink-2">
          {rows && rows.length === 0 ? (
            <>
              The ledger is empty — every account starts this way. Press{' '}
              <kbd className="rounded-[5px] border border-hairline bg-surface px-1.5 text-[12px]">N</kbd>{' '}
              to log your first book, or head to{' '}
              <Link href="/for-you" className="font-semibold text-accent">
                For you
              </Link>{' '}
              for a first pick.
            </>
          ) : q ? (
            <>
              Nothing in your library matches “{q}”.{' '}
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('marginalia:log-book', { detail: { query: q } }))
                }
                className="font-semibold text-accent hover:text-accent-ink"
              >
                Search the catalogues and log it →
              </button>
            </>
          ) : (
            'Nothing matches those filters.'
          )}
        </div>
      ) : table ? (
        <div className="mt-8 overflow-x-auto rounded-panel border border-hairline bg-surface">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                {['Title', 'Author', 'Year', 'Status', 'Rating', 'Format', 'Length'].map((h) => (
                  <th key={h} className="label-caps px-5 py-3.5 !text-[11px] font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ book, record, rating }) => (
                <tr key={book.id} className="border-b border-hairline-2 last:border-b-0 hover:bg-porcelain">
                  <td className="px-5 py-3">
                    <Link href={`/library/${book.id}`} className="font-serif text-[15px] font-medium">
                      {book.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-2">{book.author}</td>
                  <td className="tnum px-5 py-3 text-ink-2">{book.year ?? '—'}</td>
                  <td className="px-5 py-3 capitalize text-ink-2">
                    {record?.status === 'abandoned'
                      ? `Stopped${record.progressPct != null ? ` at ${record.progressPct}%` : ''}`
                      : record?.status}
                  </td>
                  <td className="tnum px-5 py-3">
                    {rating ? `★ ${rating.verdict.toFixed(1)}` : <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-5 py-3 capitalize text-ink-2">{record?.format ?? '—'}</td>
                  <td className="tnum px-5 py-3 text-ink-2">
                    {book.audioHours ? `${book.audioHours} h` : book.pages ? `${book.pages} pp` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map(({ book, record, rating }) => (
            <BookCard key={book.id} book={book} record={record} rating={rating} />
          ))}
        </div>
      )}
    </>
  );
}
