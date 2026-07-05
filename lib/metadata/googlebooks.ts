import type { BookSearchResult } from './types';

interface GBVolume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

export async function searchGoogleBooks(query: string): Promise<BookSearchResult[]> {
  const url =
    'https://www.googleapis.com/books/v1/volumes?maxResults=10&q=' + encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const data = (await res.json()) as { items?: GBVolume[] };
  return (data.items ?? [])
    .map((v) => v.volumeInfo)
    .filter((v): v is NonNullable<GBVolume['volumeInfo']> => !!v?.title && !!v.authors?.length)
    .map((v) => ({
      title: v.title!,
      author: v.authors![0],
      year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || undefined : undefined,
      isbn: v.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ??
        v.industryIdentifiers?.[0]?.identifier,
      pages: v.pageCount,
      coverUrl: v.imageLinks?.thumbnail?.replace(/^http:/, 'https:'),
      subjects: v.categories ?? [],
      source: 'googlebooks' as const,
    }));
}
