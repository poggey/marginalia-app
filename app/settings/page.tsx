'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, setMeta, getRuntimeWindow, DEFAULT_RUNTIME, type RuntimeWindow } from '@/lib/db';
import { buildExport, downloadExport, importPayload, type ExportPayload } from '@/lib/export';
import { chipToPreference, parsePreference, PREF_CHIPS } from '@/lib/preferences';

export default function SettingsPage() {
  const prefs = useLiveQuery(() => db.prefs.toArray(), []);
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('takenAt').reverse().toArray(), []);
  const notForMe = useLiveQuery(async () => {
    const ids = (await getMeta<string[]>('notForMe')) ?? [];
    const books = await db.books.bulkGet(ids);
    return ids.map((id, i) => ({ id, title: books[i]?.title ?? id }));
  }, []);

  const [runtime, setRuntime] = useState<RuntimeWindow>(DEFAULT_RUNTIME);
  useEffect(() => {
    getRuntimeWindow().then(setRuntime);
  }, []);
  const [freeText, setFreeText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveRuntime(next: RuntimeWindow) {
    setRuntime(next);
    await setMeta('runtimeWindow', next);
  }

  async function addFreeText() {
    if (!freeText.trim()) return;
    await db.prefs.add(parsePreference(freeText));
    setFreeText('');
  }

  async function onImportFile(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as ExportPayload;
      await importPayload(payload);
      setImportMsg(`Imported ${payload.books.length} books, ${payload.ratings.length} ratings — ledger restored.`);
    } catch (e) {
      setImportMsg(`Import failed: ${e instanceof Error ? e.message : 'unreadable file'}`);
    }
  }

  if (!prefs) return null;
  const activeChipLabels = new Set(prefs.map((p) => p.label));

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mt-11 font-serif text-[34px] font-medium tracking-[-0.01em]">Settings</h1>

      <section className="mt-9 rounded-panel border border-hairline bg-surface p-8">
        <h2 className="text-[16px] font-semibold">Standing rules</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Filters and nudges applied before any mathematics — never fake ratings. Pin a preference
          here and the recommender obeys it at every Discovery stop.
        </p>
        {prefs.length > 0 && (
          <ul className="mt-5 flex flex-col gap-2">
            {prefs.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 rounded-input border border-hairline bg-porcelain px-4 py-2.5"
              >
                <span className="text-[13.5px]">
                  <span className="label-caps mr-2.5 !text-[10.5px]">{p.kind}</span>
                  {p.label}
                  {!p.effect && <span className="ml-2 text-[12px] text-ink-3">noted, not enforced</span>}
                </span>
                <button
                  onClick={() => db.prefs.delete(p.id)}
                  aria-label={`Remove rule: ${p.label}`}
                  className="text-[12.5px] font-semibold text-ink-3 hover:text-ink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          {PREF_CHIPS.filter((c) => !activeChipLabels.has(c.label)).map((chip) => (
            <button
              key={chip.label}
              onClick={() => db.prefs.add(chipToPreference(chip))}
              className="rounded-full border border-hairline bg-porcelain px-3.5 py-1.5 text-[12.5px] font-medium text-ink-2 hover:border-ink-3"
            >
              + {chip.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2.5">
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFreeText()}
            placeholder="Your own rule — “no horror”, “under 12 h”…"
            className="w-full max-w-[380px] rounded-input border border-hairline bg-porcelain px-4 py-2 text-[13.5px] outline-none placeholder:text-ink-3 focus:border-ink-3"
          />
          <button
            onClick={addFreeText}
            className="rounded-btn border border-hairline px-4 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            Add
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-panel border border-hairline bg-surface p-8">
        <h2 className="text-[16px] font-semibold">Runtime window</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Hard filter on audio length. Books without a known runtime pass through; series
          continuations are exempt.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-[14px]">
            <input
              type="checkbox"
              checked={runtime.enabled}
              onChange={(e) => saveRuntime({ ...runtime, enabled: e.target.checked })}
              className="h-4 w-4 accent-[#3546E8]"
            />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-[14px] text-ink-2">
            From
            <input
              type="number"
              min={0}
              max={runtime.maxHours}
              value={runtime.minHours}
              onChange={(e) => saveRuntime({ ...runtime, minHours: Number(e.target.value) })}
              className="tnum w-16 rounded-input border border-hairline bg-porcelain px-2.5 py-1.5 text-[14px]"
            />
          </label>
          <label className="flex items-center gap-2 text-[14px] text-ink-2">
            to
            <input
              type="number"
              min={runtime.minHours}
              value={runtime.maxHours}
              onChange={(e) => saveRuntime({ ...runtime, maxHours: Number(e.target.value) })}
              className="tnum w-16 rounded-input border border-hairline bg-porcelain px-2.5 py-1.5 text-[14px]"
            />
            hours
          </label>
        </div>
      </section>

      {notForMe && notForMe.length > 0 && (
        <section className="mt-6 rounded-panel border border-hairline bg-surface p-8">
          <h2 className="text-[16px] font-semibold">Dismissed picks</h2>
          <p className="mt-1 text-[13.5px] text-ink-2">Books you marked “not for me”. Restore to make them eligible again.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {notForMe.map((b) => (
              <li key={b.id} className="flex items-center justify-between rounded-input border border-hairline bg-porcelain px-4 py-2.5 text-[13.5px]">
                {b.title}
                <button
                  onClick={async () => {
                    const ids = (await getMeta<string[]>('notForMe')) ?? [];
                    await setMeta('notForMe', ids.filter((x) => x !== b.id));
                  }}
                  className="text-[12.5px] font-semibold text-accent hover:text-accent-ink"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-panel border border-hairline bg-surface p-8">
        <h2 className="text-[16px] font-semibold">Your ledger</h2>
        <p className="mt-1 text-[13.5px] text-ink-2">
          You own the data. One-click export, tested round-trip import, and a weekly snapshot kept
          inside the browser
          {snapshots?.length
            ? ` — last taken ${new Date(snapshots[0].takenAt).toLocaleDateString('en-GB')}.`
            : ' — first snapshot lands on next load.'}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={async () => downloadExport(await buildExport())}
            className="rounded-btn bg-accent px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-btn border border-hairline px-5 py-2.5 text-[14px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])}
          />
        </div>
        <p aria-live="polite" className="mt-3 min-h-[20px] text-[13px] text-ink-2">{importMsg}</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Importing replaces the current ledger wholesale — export first if in doubt.
        </p>
      </section>
    </div>
  );
}
