import type { BookSearchResult } from './types';

interface OLDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
}

export async function searchOpenLibrary(query: string): Promise<BookSearchResult[]> {
  const url =
    'https://openlibrary.org/search.json?limit=10&fields=title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject&q=' +
    encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const data = (await res.json()) as { docs?: OLDoc[] };
  return (data.docs ?? [])
    .filter((d) => d.title && d.author_name?.length)
    .map((d) => ({
      title: d.title!,
      author: d.author_name![0],
      year: d.first_publish_year,
      isbn: d.isbn?.[0],
      pages: d.number_of_pages_median,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
      subjects: (d.subject ?? []).slice(0, 20),
      source: 'openlibrary' as const,
    }));
}
