'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { searchBooks, cacheBookFromResult } from '@/lib/metadata/cache';
import type { BookSearchResult } from '@/lib/metadata/types';
import { USER_ID, type ReadingRecord, type ReadingStatus } from '@/lib/types';
import { toneGradient } from '@/lib/shelfTone';

type Format = 'audio' | 'print' | 'ebook';

// Sub-15-second logging: search → pick → one status tap. Cache-at-write.
export default function LogBookModal({
  onClose,
  initialQuery = '',
  initialPicked = null,
}: {
  onClose: () => void;
  initialQuery?: string;
  initialPicked?: BookSearchResult | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<BookSearchResult | null>(initialPicked);
  const [format, setFormat] = useState<Format>('audio');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchBooks(query.trim());
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function save(status: ReadingStatus) {
    if (!picked || saving) return;
    setSaving(true);
    const book = await cacheBookFromResult(picked);
    const now = new Date().toISOString();
    const record: ReadingRecord = {
      id: crypto.randomUUID(),
      userId: USER_ID,
      bookId: book.id,
      status,
      format,
      startedAt: status === 'reading' || status === 'finished' ? now : undefined,
      finishedAt: status === 'finished' ? now : undefined,
      queuedAt: status === 'queued' ? now : undefined,
      sessions: [],
    };
    await db.records.add(record);
    onClose();
    if (status === 'finished') router.push(`/review/${record.id}`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Log a book"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 p-6 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] rounded-panel border border-hairline bg-surface p-7 shadow-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="label-caps mb-3">Log a book</div>
        {!picked && (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicked(null);
            }}
            placeholder="Search by title or author…"
            className="w-full rounded-input border border-hairline bg-porcelain px-4 py-2.5 text-[15px] outline-none placeholder:text-ink-3 focus:border-ink-3"
          />
        )}
        {!picked && searching && <div className="mt-4 text-[13.5px] text-ink-3">Searching…</div>}

        {!picked && results.length > 0 && (
          <ul className="mt-4 max-h-[320px] overflow-y-auto">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  onClick={() => setPicked(r)}
                  className="flex w-full items-center gap-4 border-b border-hairline-2 px-2 py-2.5 text-left last:border-b-0 hover:bg-porcelain"
                >
                  <div
                    className="h-12 w-8 shrink-0 overflow-hidden rounded-[4px]"
                    style={{ background: toneGradient(r.author) }}
                  >
                    {r.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-serif text-[16px] font-medium">{r.title}</div>
                    <div className="text-[12.5px] text-ink-2">
                      {r.author}
                      {r.year ? ` · ${r.year}` : ''}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!picked && !searching && query.trim().length >= 3 && results.length === 0 && (
          <div className="mt-4 text-[13.5px] text-ink-2">
            Nothing found — both catalogues came back empty.
          </div>
        )}

        {picked && (
          <div className="mt-1">
            <div className="font-serif text-[20px] font-medium leading-tight">{picked.title}</div>
            <div className="mb-4 text-[13.5px] text-ink-2">
              {picked.author}
              {picked.year ? ` · ${picked.year}` : ''}
              <button
                onClick={() => {
                  setPicked(null);
                  setQuery('');
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="ml-3 text-[12.5px] font-semibold text-accent hover:text-accent-ink"
              >
                Different book?
              </button>
            </div>
            <div className="label-caps mb-2">Format</div>
            <div className="mb-5 flex gap-2">
              {(['audio', 'print', 'ebook'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium capitalize transition-colors ${
                    format === f
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-hairline bg-porcelain text-ink-2 hover:border-ink-3'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => save('reading')}
                disabled={saving}
                className="rounded-btn bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink"
              >
                Start reading
              </button>
              <button
                onClick={() => save('queued')}
                disabled={saving}
                className="rounded-btn border border-hairline px-5 py-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
              >
                Add to queue
              </button>
              <button
                onClick={() => save('finished')}
                disabled={saving}
                className="rounded-btn border border-hairline px-5 py-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
              >
                Finished — rate it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
