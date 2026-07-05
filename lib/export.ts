import { db, getMeta, setMeta, type MetaEntry, type Snapshot } from './db';
import type { Book, Rating, ReadingRecord, StandingPreference } from './types';

export interface ExportPayload {
  app: 'marginalia';
  version: 1;
  exportedAt: string;
  books: Book[];
  records: ReadingRecord[];
  ratings: Rating[];
  prefs: StandingPreference[];
  meta: MetaEntry[];
  covers?: { id: string; dataUrl: string }[];
}

function sortById<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function buildExport(includeCovers = true): Promise<ExportPayload> {
  const [books, records, ratings, prefs, meta] = await Promise.all([
    db.books.toArray(),
    db.records.toArray(),
    db.ratings.toArray(),
    db.prefs.toArray(),
    db.meta.toArray(),
  ]);
  const payload: ExportPayload = {
    app: 'marginalia',
    version: 1,
    exportedAt: new Date().toISOString(),
    books: sortById(books),
    records: sortById(records),
    ratings: sortById(ratings),
    prefs: sortById(prefs),
    meta: [...meta].sort((a, b) => a.key.localeCompare(b.key)),
  };
  if (includeCovers) {
    const covers = await db.covers.toArray();
    payload.covers = await Promise.all(
      covers.map(async (c) => ({ id: c.id, dataUrl: await blobToDataUrl(c.blob) })),
    );
    payload.covers.sort((a, b) => a.id.localeCompare(b.id));
  }
  return payload;
}

export async function importPayload(payload: ExportPayload): Promise<void> {
  if (payload.app !== 'marginalia' || payload.version !== 1) {
    throw new Error('Not a Marginalia v1 export.');
  }
  const covers = payload.covers
    ? await Promise.all(
        payload.covers.map(async (c) => ({ id: c.id, blob: await dataUrlToBlob(c.dataUrl) })),
      )
    : [];
  await db.transaction('rw', [db.books, db.records, db.ratings, db.prefs, db.meta, db.covers], async () => {
    await Promise.all([
      db.books.clear(), db.records.clear(), db.ratings.clear(),
      db.prefs.clear(), db.meta.clear(), db.covers.clear(),
    ]);
    await db.books.bulkPut(payload.books);
    await db.records.bulkPut(payload.records);
    await db.ratings.bulkPut(payload.ratings);
    await db.prefs.bulkPut(payload.prefs);
    await db.meta.bulkPut(payload.meta);
    if (covers.length) await db.covers.bulkPut(covers);
  });
}

export function downloadExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marginalia-export-${payload.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const SNAPSHOT_KEEP = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Weekly auto-snapshot, stored inside IndexedDB (no surprise downloads).
export async function maybeWeeklySnapshot(): Promise<void> {
  const last = await getMeta<string>('lastSnapshotAt');
  if (last && Date.now() - new Date(last).getTime() < WEEK_MS) return;
  const payload = await buildExport(false);
  const snap: Snapshot = {
    id: crypto.randomUUID(),
    takenAt: payload.exportedAt,
    payload: JSON.stringify(payload),
  };
  await db.snapshots.add(snap);
  await setMeta('lastSnapshotAt', payload.exportedAt);
  const all = await db.snapshots.orderBy('takenAt').toArray();
  if (all.length > SNAPSHOT_KEEP) {
    await db.snapshots.bulkDelete(all.slice(0, all.length - SNAPSHOT_KEEP).map((s) => s.id));
  }
}
