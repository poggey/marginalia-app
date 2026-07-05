'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ensureSeeded } from '@/lib/seed';
import { maybeWeeklySnapshot } from '@/lib/export';
import { searchBooks } from '@/lib/metadata/cache';
import type { BookSearchResult } from '@/lib/metadata/types';
import { toneGradient } from '@/lib/shelfTone';
import LogBookModal from '@/components/LogBookModal';

const NAV_LINKS = [
  { href: '/library', label: 'Library' },
  { href: '/for-you', label: 'For you' },
  { href: '/queue', label: 'Queue' },
];

export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logQuery, setLogQuery] = useState('');
  const [logPicked, setLogPicked] = useState<BookSearchResult | null>(null);

  useEffect(() => {
    ensureSeeded().then(() => maybeWeeklySnapshot()).catch(() => {});
  }, []);

  // The nav search finds any book — catalogue-wide, as a prelude to logging or
  // rating it. The Library page has its own filter field for the ledger.
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchBooks(query.trim());
      setResults(r);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // Close the dropdown when navigating.
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  function pickResult(r: BookSearchResult) {
    setLogPicked(r);
    setLogQuery('');
    setLogOpen(true);
    setDropdownOpen(false);
    setQuery('');
    setResults([]);
    searchRef.current?.blur();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing =
        t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setLogPicked(null);
        setLogOpen(true);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        router.push('/library');
      } else if (e.key === 'v' || e.key === 'V') {
        window.dispatchEvent(new CustomEvent('marginalia:toggle-view'));
      }
    }
    window.addEventListener('keydown', onKey);
    const openLog = (e: Event) => {
      setLogPicked(null);
      setLogQuery((e as CustomEvent<{ query?: string }>).detail?.query ?? '');
      setLogOpen(true);
    };
    window.addEventListener('marginalia:log-book', openLog);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('marginalia:log-book', openLog);
    };
  }, [router]);

  const onboarding = pathname === '/onboarding';

  return (
    <>
      {!onboarding && (
        <nav className="sticky top-0 z-10 border-b border-hairline bg-porcelain/[.88] backdrop-blur-md">
          <div className="mx-auto flex max-w-[1120px] items-center gap-8 px-7 pb-[18px] pt-5">
            <Link href="/for-you" className="font-serif text-[21px] font-medium italic tracking-[.01em]">
              Marginalia
            </Link>
            {NAV_LINKS.map((l) => {
              const on = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative py-1.5 text-[14px] font-medium transition-colors ${
                    on ? 'text-ink' : 'text-ink-2 hover:text-ink'
                  }`}
                >
                  {l.label}
                  {on && (
                    <span className="absolute inset-x-0 -bottom-[19px] h-0.5 rounded-sm bg-accent" />
                  )}
                </Link>
              );
            })}
            <div className="flex-1" />
            <div className="relative">
              <div className="flex min-w-[230px] items-center gap-2 rounded-input border border-hairline bg-surface px-3 py-[7px]">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => query && setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setQuery('');
                      setDropdownOpen(false);
                      searchRef.current?.blur();
                    } else if (e.key === 'Enter' && results.length > 0) {
                      pickResult(results[0]);
                    }
                  }}
                  placeholder="Find a book to log or rate"
                  aria-label="Find a book to log or rate"
                  role="combobox"
                  aria-expanded={dropdownOpen && (results.length > 0 || searching)}
                  className="w-full bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3"
                />
                <kbd className="rounded-[5px] border border-hairline bg-porcelain px-[5px] text-[11px] text-ink-3">
                  /
                </kbd>
              </div>
              {dropdownOpen && query.trim().length >= 3 && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[340px] overflow-hidden rounded-card border border-hairline bg-surface shadow-raised">
                  {searching && (
                    <div className="px-4 py-3 text-[13px] text-ink-3">Searching the catalogues…</div>
                  )}
                  {!searching && results.length === 0 && (
                    <div className="px-4 py-3 text-[13px] text-ink-2">
                      Nothing found in either catalogue.
                    </div>
                  )}
                  {!searching &&
                    results.slice(0, 6).map((r, i) => (
                      <button
                        key={i}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickResult(r)}
                        className="flex w-full items-center gap-3 border-b border-hairline-2 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-porcelain"
                      >
                        <div
                          className="h-11 w-[30px] shrink-0 overflow-hidden rounded-[4px]"
                          style={{ background: toneGradient(r.author) }}
                        >
                          {r.coverUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-serif text-[15px] font-medium leading-tight">
                            {r.title}
                          </div>
                          <div className="truncate text-[12px] text-ink-2">
                            {r.author}
                            {r.year ? ` · ${r.year}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <Link
              href="/settings"
              className={`py-1.5 text-[14px] font-medium transition-colors ${
                pathname === '/settings' ? 'text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              Settings
            </Link>
          </div>
        </nav>
      )}
      <main className={onboarding ? '' : 'mx-auto max-w-[1120px] px-7 pb-24'}>{children}</main>
      {logOpen && (
        <LogBookModal
          initialQuery={logQuery}
          initialPicked={logPicked}
          onClose={() => {
            setLogOpen(false);
            setLogQuery('');
            setLogPicked(null);
          }}
        />
      )}
    </>
  );
}
