'use client';

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Book, ReadingRecord } from '@/lib/types';
import BookCover from './BookCover';

// The books currently underway (or paused), each with the two exits: rate it
// or stop it. Shown on Home and at the top of the Library ledger.
export default function ReadingNowList() {
  const rows = useLiveQuery(async () => {
    const records = await db.records.where('status').anyOf('reading', 'paused').toArray();
    const books = await db.books.bulkGet(records.map((r) => r.bookId));
    return records
      .map((record, i) => ({ record, book: books[i] }))
      .filter((r): r is { record: ReadingRecord; book: Book } => !!r.book)
      .sort((a, b) => (b.record.startedAt ?? '').localeCompare(a.record.startedAt ?? ''));
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="mt-11">
      <div className="label-caps mb-4">Reading now</div>
      <div className="flex flex-col gap-3">
        {rows.map(({ book, record }) => (
          <div
            key={record.id}
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
                {record.status === 'paused' ? ' · paused' : ''}
                {record.startedAt
                  ? ` · since ${new Date(record.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : ''}
              </div>
            </div>
            <Link
              href={`/review/${record.id}`}
              className="rounded-btn bg-accent-soft px-4 py-2 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-[#DFE3FD]"
            >
              Finished — rate it
            </Link>
            <Link
              href={`/review/${record.id}?mode=dnf`}
              className="rounded-btn border border-hairline px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
            >
              Stopping
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
