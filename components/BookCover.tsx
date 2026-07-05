'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { toneGradient } from '@/lib/shelfTone';
import type { Book } from '@/lib/types';

// Real cover when cached (blob preferred) or hotlinkable; else the shelf-tone
// placeholder — serif title on the deterministic author tone.
export default function BookCover({
  book,
  className = '',
  titleSize = 15,
}: {
  book: Book;
  className?: string;
  titleSize?: number;
}) {
  const cover = useLiveQuery(() => db.covers.get(book.id), [book.id]);
  const [blobUrl, setBlobUrl] = useState<string>();

  useEffect(() => {
    if (!cover?.blob) return;
    const url = URL.createObjectURL(cover.blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  const src = blobUrl ?? book.coverUrl;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Cover of ${book.title}`}
        className={`rounded-cover object-cover ${className}`}
      />
    );
  }
  return (
    <div
      aria-label={`Cover of ${book.title}`}
      className={`relative flex flex-col justify-end overflow-hidden rounded-cover p-[7%] ${className}`}
      style={{ background: toneGradient(book.author) }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(115deg, rgba(255,255,255,.14), transparent 38%)' }}
      />
      <div
        className="relative font-serif font-medium leading-[1.25] text-tone-text"
        style={{ fontSize: titleSize }}
      >
        {book.title}
      </div>
      <div className="label-caps relative mt-2 !text-[10px]" style={{ color: '#B8BDD4' }}>
        {book.author}
      </div>
    </div>
  );
}
