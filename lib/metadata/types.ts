export interface BookSearchResult {
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  pages?: number;
  coverUrl?: string;
  subjects: string[];
  readinglog?: number; // Open Library only — how many readers have logged it
  source: 'openlibrary' | 'googlebooks';
}
