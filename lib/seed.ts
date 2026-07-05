import { db } from './db';
import { deckBooks } from './deck';

export { deckBooks };

// Idempotent: the deck ships with the app; user data never does (zero-knowledge start).
export async function ensureSeeded(): Promise<void> {
  const books = deckBooks();
  const existing = await db.books.where('source').equals('seed').count();
  if (existing >= books.length) return;
  await db.books.bulkPut(books);
}
