import type { BookSearchResult } from './types';

interface OLDoc {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  readinglog_count?: number;
}

export async function searchOpenLibrary(
  query: string,
  opts: { sort?: 'rating' | 'readinglog'; limit?: number } = {},
): Promise<BookSearchResult[]> {
  const url =
    `https://openlibrary.org/search.json?limit=${opts.limit ?? 10}` +
    (opts.sort ? `&sort=${opts.sort}` : '') +
    '&fields=title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject,readinglog_count&q=' +
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
      readinglog: d.readinglog_count,
      source: 'openlibrary' as const,
    }));
}
