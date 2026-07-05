'use client';

import Link from 'next/link';
import { AXES, AXIS_LABELS, DNF_LABELS, type Book, type Rating, type ReadingRecord } from '@/lib/types';
import BookCover from './BookCover';

// Library card: cover, serif title on tone, rating or quiet DNF state; hover
// reveals the tone-axis profile (the five axes furthest from neutral).
export default function BookCard({
  book,
  record,
  rating,
}: {
  book: Book;
  record?: ReadingRecord;
  rating?: Rating;
}) {
  const profileAxes = [...AXES]
    .sort((a, b) => Math.abs((book.axes[b] ?? 0.5) - 0.5) - Math.abs((book.axes[a] ?? 0.5) - 0.5))
    .slice(0, 5);

  const dnf = record?.status === 'abandoned';

  return (
    <Link
      href={`/library/${book.id}`}
      className="group relative block rounded-card border border-hairline bg-surface p-[18px] transition-all duration-200 hover:-translate-y-[3px] hover:border-[#DCDCD6] hover:shadow-[0_20px_36px_-24px_rgba(23,24,28,.18)]"
    >
      <BookCover book={book} className="mb-3.5 h-[118px] w-full" titleSize={13.5} />
      <div className="text-[14.5px] font-semibold leading-[1.35]">{book.title}</div>
      <div className="mt-0.5 text-[12.5px] text-ink-2">
        {book.author}
        {book.series ? ` · ${book.series} #${book.seriesIndex ?? ''}` : ''}
      </div>
      <div className="mt-3 flex items-center justify-between">
        {dnf ? (
          <span className="text-[13px] font-medium text-ink-3">
            Stopped{record?.progressPct != null ? ` at ${record.progressPct}%` : ''}
          </span>
        ) : rating ? (
          <span className="tnum text-[13px] font-semibold">★ {rating.verdict.toFixed(1)}</span>
        ) : (
          <span className="text-[13px] text-ink-3 capitalize">{record?.status ?? 'unread'}</span>
        )}
        {record?.format && (
          <span className="label-caps !text-[11px] !tracking-[.08em]">{record.format}</span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-[9px] rounded-card bg-surface/[.97] p-5 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100 group-focus-visible:opacity-100">
        {dnf && record?.dnfReason ? (
          <>
            <div className="label-caps">Reason</div>
            <div className="text-[12.5px] leading-normal text-ink">
              {DNF_LABELS[record.dnfReason]} — noted without penalty to similar themes you might
              still enjoy.
            </div>
          </>
        ) : (
          profileAxes.map((a) => (
            <div key={a} className="flex items-center gap-2.5 text-[11.5px] text-ink-2">
              <span className="w-[86px] text-right">{AXIS_LABELS[a]}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-[3px] bg-hairline-2">
                <div
                  className="h-full rounded-[3px] bg-accent"
                  style={{ width: `${(book.axes[a] ?? 0.5) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
