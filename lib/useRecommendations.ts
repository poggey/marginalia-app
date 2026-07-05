'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, DEFAULT_RUNTIME, type RuntimeWindow } from './db';
import { recommend, type RecommenderInput, type RecommenderOutput } from './recommender';

/**
 * Reactive recommendations: re-runs whenever the ledger changes or δ moves.
 * Uses the web worker when available, falling back to inline computation.
 */
export function useRecommendations(delta: number): {
  output: RecommenderOutput | null;
  ready: boolean;
} {
  const data = useLiveQuery(async () => {
    const [books, records, ratings, prefs, runtime, notForMe] = await Promise.all([
      db.books.toArray(),
      db.records.toArray(),
      db.ratings.toArray(),
      db.prefs.toArray(),
      getMeta<RuntimeWindow>('runtimeWindow'),
      getMeta<string[]>('notForMe'),
    ]);
    return { books, records, ratings, prefs, runtime: runtime ?? DEFAULT_RUNTIME, notForMe: notForMe ?? [] };
  }, []);

  const [output, setOutput] = useState<RecommenderOutput | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const input: RecommenderInput | null = useMemo(() => {
    if (!data) return null;
    return {
      books: data.books,
      records: data.records,
      ratings: data.ratings,
      prefs: data.prefs,
      runtime: data.runtime,
      notForMe: data.notForMe,
      delta,
      now: new Date().toISOString(),
    };
  }, [data, delta]);

  useEffect(() => {
    if (!input) return;
    let cancelled = false;
    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('./recommender.worker.ts', import.meta.url));
      }
      const worker = workerRef.current;
      worker.onmessage = (e: MessageEvent<RecommenderOutput>) => {
        if (!cancelled) setOutput(e.data);
      };
      worker.onerror = () => {
        if (!cancelled) setOutput(recommend(input));
      };
      worker.postMessage(input);
    } catch {
      setOutput(recommend(input));
    }
    return () => {
      cancelled = true;
    };
  }, [input]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  return { output, ready: output !== null };
}
