import { db } from '@/lib/db';
import type { Book } from '@/lib/types';
import { searchOpenLibrary } from './openlibrary';
import { searchGoogleBooks } from './googlebooks';
import { cleanThemeTags, inferAxes } from './autoProfile';
import type { BookSearchResult } from './types';

// Open Library first, Google Books fallback (white paper §X).
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  try {
    const ol = await searchOpenLibrary(query);
    if (ol.length) return ol;
  } catch {
    // fall through to Google Books
  }
  try {
    return await searchGoogleBooks(query);
  } catch {
    return [];
  }
}

// Cache-at-write: the book row and its cover are stored locally the moment a
// result is chosen — API mortality never orphans the ledger.
export async function cacheBookFromResult(result: BookSearchResult): Promise<Book> {
  const existing = await db.books
    .where('title')
    .equalsIgnoreCase(result.title)
    .filter((b) => b.author.toLowerCase() === result.author.toLowerCase())
    .first();
  if (existing) return existing;

  const corpus = await db.books.toArray();
  const themeTags = cleanThemeTags(result.subjects);
  const book: Book = {
    id: crypto.randomUUID(),
    isbn: result.isbn,
    title: result.title,
    author: result.author,
    year: result.year,
    pages: result.pages,
    coverUrl: result.coverUrl,
    subjects: result.subjects,
    axes: inferAxes(result.subjects, themeTags, corpus, { author: result.author }),
    themeTags,
    profileVerified: false,
    source: result.source,
  };
  await db.books.put(book);

  if (result.coverUrl) {
    try {
      const res = await fetch(result.coverUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 0) await db.covers.put({ id: book.id, blob });
      }
    } catch {
      // remote cover stays as URL; shelf-tone placeholder covers the gap
    }
  }
  return book;
}
