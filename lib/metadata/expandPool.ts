import { db } from '@/lib/db';
import type { Book } from '@/lib/types';
import { searchOpenLibrary } from './openlibrary';
import { autoAxes, cleanThemeTags } from './autoProfile';

// On-demand candidate expansion (white paper §X): when the local pool runs
// thin, consult Open Library for books matching the reader's loved theme tags
// and authors. Auto-profiles, tagged Unverified, reader-adjustable. Purely
// additive — never touches records, ratings or existing books.

const LOVED_VERDICT = 4.0;
const MAX_TAG_QUERIES = 4;
const MAX_AUTHOR_QUERIES = 3;
const PER_QUERY = 10;
const EXPANSION_CAP = 36;

export async function expandCandidatePool(): Promise<number> {
  const [books, records, ratings] = await Promise.all([
    db.books.toArray(),
    db.records.toArray(),
    db.ratings.toArray(),
  ]);
  const recordsById = new Map(records.map((r) => [r.id, r]));
  const booksById = new Map(books.map((b) => [b.id, b]));

  const loved = ratings
    .filter((r) => r.verdict >= LOVED_VERDICT)
    .map((r) => booksById.get(recordsById.get(r.readingRecordId)?.bookId ?? ''))
    .filter((b): b is Book => !!b);
  if (!loved.length) return 0;

  const tagCounts = new Map<string, number>();
  const authorCounts = new Map<string, number>();
  for (const b of loved) {
    for (const t of b.themeTags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    authorCounts.set(b.author, (authorCounts.get(b.author) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAG_QUERIES)
    .map(([t]) => t.replace(/-/g, ' '));
  const topAuthors = [...authorCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_AUTHOR_QUERIES)
    .map(([a]) => a);

  const known = new Set(books.map((b) => `${b.title.toLowerCase()}|${b.author.toLowerCase()}`));
  // Tag queries stay inside fiction (subject searches otherwise surface
  // textbooks); everything sorts by how widely read it is.
  const queries = [
    ...topTags.map((t) => `subject:"${t}" subject:fiction`),
    ...topAuthors.map((a) => `author:"${a}"`),
  ];

  const additions: Book[] = [];
  for (const q of queries) {
    if (additions.length >= EXPANSION_CAP) break;
    try {
      const results = await searchOpenLibrary(q + ' language:eng', {
        sort: 'readinglog',
        limit: PER_QUERY,
      });
      for (const r of results.slice(0, PER_QUERY)) {
        if (!r.year || r.subjects.length === 0) continue; // metadata too thin to trust
        // The query-level fiction constraint is loose; require the record
        // itself to carry a fiction marker ("Nonfiction" contains "fiction" —
        // the subject must match without being a nonfiction tag).
        const fictionMarker = r.subjects.some(
          (s) => !/non-?fiction/i.test(s) && /fiction|novel|fantasy|thriller|romance/i.test(s),
        );
        const nonfictionMarker = r.subjects.some((s) => /^non-?fiction$/i.test(s.trim()));
        if (!fictionMarker || nonfictionMarker) continue;
        const key = `${r.title.toLowerCase()}|${r.author.toLowerCase()}`;
        if (known.has(key)) continue;
        known.add(key);
        additions.push({
          id: crypto.randomUUID(),
          isbn: r.isbn,
          title: r.title,
          author: r.author,
          year: r.year,
          pages: r.pages,
          coverUrl: r.coverUrl,
          subjects: r.subjects,
          axes: autoAxes(r.subjects),
          themeTags: cleanThemeTags(r.subjects),
          profileVerified: false,
          source: 'openlibrary',
        });
        if (additions.length >= EXPANSION_CAP) break;
      }
    } catch {
      // one failed query never blocks the rest
    }
  }

  if (additions.length) await db.books.bulkPut(additions);
  return additions.length;
}
