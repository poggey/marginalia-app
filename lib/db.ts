import Dexie, { type Table } from 'dexie';
import type { Book, Rating, ReadingRecord, StandingPreference } from './types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

export interface Snapshot {
  id: string;
  takenAt: string; // ISO
  payload: string; // full export JSON
}

export interface CoverBlob {
  id: string; // book id
  blob: Blob;
}

export class MarginaliaDB extends Dexie {
  books!: Table<Book, string>;
  records!: Table<ReadingRecord, string>;
  ratings!: Table<Rating, string>;
  prefs!: Table<StandingPreference, string>;
  meta!: Table<MetaEntry, string>;
  snapshots!: Table<Snapshot, string>;
  covers!: Table<CoverBlob, string>;

  constructor() {
    super('marginalia');
    this.version(1).stores({
      books: 'id, title, author, series, source',
      records: 'id, userId, bookId, status, finishedAt',
      ratings: 'id, userId, readingRecordId, ratedAt',
      prefs: 'id, userId',
      meta: 'key',
      snapshots: 'id, takenAt',
      covers: 'id',
    });
  }
}

export const db = new MarginaliaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

// Runtime window — default 8–14 audio hours, user-editable (ENGINEERING §2).
export interface RuntimeWindow {
  enabled: boolean;
  minHours: number;
  maxHours: number;
}

export const DEFAULT_RUNTIME: RuntimeWindow = { enabled: true, minHours: 8, maxHours: 14 };

export async function getRuntimeWindow(): Promise<RuntimeWindow> {
  return (await getMeta<RuntimeWindow>('runtimeWindow')) ?? DEFAULT_RUNTIME;
}
