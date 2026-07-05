export interface BookSearchResult {
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  pages?: number;
  coverUrl?: string;
  subjects: string[];
  source: 'openlibrary' | 'googlebooks';
}
