# Marginalia — Engineering Notes

Condensed engineering companion to the white paper. Where this document and
the white paper disagree, the white paper wins — and flag the disagreement.

## 1. Types (source of truth for the schema)

```ts
export type Axis =
  | 'hardness' | 'pace' | 'tone' | 'scope' | 'character_depth' | 'prose_style'
  | 'problem_solving' | 'military' | 'humour' | 'structure' | 'darkness'
  | 'accessibility';

export const AXES: Axis[] = [/* the 12 above, in this order */];

export interface Book {
  id: string;                 // internal uuid
  isbn?: string;
  title: string;
  author: string;             // canonical author name
  series?: string;
  seriesIndex?: number;
  year?: number;
  pages?: number;
  audioHours?: number;
  narrator?: string;
  coverUrl?: string;          // cached blob key preferred
  subjects: string[];         // raw API tags, provenance only
  axes: Record<Axis, number>; // 0..1
  themeTags: string[];        // cleaned theme vocabulary
  profileVerified: boolean;   // false when auto-seeded → show "Unverified"
  source: 'seed' | 'openlibrary' | 'googlebooks' | 'manual';
}

export type ReadingStatus = 'queued' | 'reading' | 'finished' | 'abandoned' | 'paused';
export type DnfReason =
  | 'pacing' | 'tone' | 'characters' | 'prose' | 'lost_interest'
  | 'too_grim' | 'too_confusing' | 'wrong_mood';

export interface ReadingRecord {
  id: string;
  userId: string;             // constant in v1 — the multi-user seam
  bookId: string;
  status: ReadingStatus;
  format?: 'audio' | 'print' | 'ebook';
  startedAt?: string;         // ISO dates
  finishedAt?: string;
  progressPct?: number;
  dnfReason?: DnfReason;
  sessions: { date: string; minutes?: number; pages?: number }[];
  recommendedAtDelta?: number; // δ when surfaced, for range-returns
}

export interface Rating {
  id: string;
  userId: string;
  readingRecordId: string;
  axes: { ideas: number; pace: number; characters: number; prose: number; ending: number }; // 0..10
  verdict: number;            // 0.5..5.0 in halves
  wouldReread: boolean;
  moods: string[];            // ≤3
  note?: string;
  ratedAt: string;
}

export interface StandingPreference {
  id: string;
  userId: string;
  kind: 'aversion' | 'love' | 'constraint';
  label: string;              // "no military SF"
  effect:                     // machine-readable
    | { type: 'axisCap'; axis: Axis; max: number }
    | { type: 'axisFloor'; axis: Axis; min: number }
    | { type: 'axisBias'; axis: Axis; delta: number }
    | { type: 'runtime'; minHours?: number; maxHours?: number }
    | { type: 'excludeTag'; tag: string };
}

export interface TasteProfile {       // always computed, never edited
  userId: string;
  vector: number[];           // axes(×2 weight) ⊕ tf-idf tags, L2-normalised
  sensitivities?: Record<Axis, number>; // from ridge regression, ≥25 ratings
  ratedCount: number;
  computedAt: string;
}
```

## 2. Algorithm constants — one table, no improvisation

| Constant | Value | Where |
|---|---|---|
| Axis weight vs tags | ×2 | §5.1 |
| Recency decay τ | 24 months | §5.2 |
| Verdict→strength s(r) | 5.0→+1.0 · 4.5→+0.8 · 4.0→+0.55 · 3.5→+0.3 · 3.0→+0.1 · 2.5→−0.2 · 2.0→−0.5 · 1.5→−0.75 · 1.0→−1.0 | §5.2 (half-steps interpolated) |
| DNF weight | −0.75 (any reason except wrong_mood) | §5.2 |
| wrong_mood | w = 0; suppress book 6 months | §5.2 |
| Re-read multiplier | ×1.3 | §5.2 |
| k (neighbours) | 7 | §5.4 |
| Similarity exponent | sim³ | §5.4 |
| Shrinkage λ | 1.5 toward user mean r̄ | §5.4 |
| Confidence band | from neighbour agreement (weighted std) + mean neighbour distance; render as ±x rounded to 0.1 | §5.4 |
| Novelty | nov(c) = 1 − maxᵦ cos(x_c, x_b) over read books | §5.5 |
| Final score | (1−δ)·r̂/5 + δ·nov | §5.5 |
| δ stops | 0.00 / 0.12 / 0.25 / 0.42 / 0.60 (Comfort/Familiar/Adjacent/Far/Unknown; default Familiar) | Ch. VI |
| Wildcard | at Far & Unknown, slot 5 = argmax nov among filtered pool; render "unscored" | Ch. VI |
| MMR | pick = argmax [0.75·Score − 0.25·max cos to already-picked]; shortlist n=5 | §5.5 |
| Learning state | < 10 ratings: Learning tag, widened bands, progress line | §5.7 |
| Sensitivity regression | ridge of verdicts on axes, fit at ≥25 ratings, refit each new rating | §5.8 |
| Default runtime filter | 8–14 audio hours (user-editable) | §5.6 |

**Pipeline order (per request):** hard filters (read/series-order/runtime/
suppressions/standing rules) → sim → r̂ + band → nov → Score(δ) → MMR →
wildcard swap if δ ≥ 0.42 → render with reasoning.

**Reasoning strings** are generated from real intermediate values (top
neighbours + top sensitivity-weighted axis matches + drift distance), never
hand-waved. Template-based is fine.

## 3. Suggested structure

```
app/                    # Next.js App Router
  (surfaces)/library/  for-you/  reading/  queue/  review/[recordId]/
  onboarding/          # the first run (§7.9)
lib/
  db.ts                # Dexie schema, userId-keyed
  metadata/            # openlibrary.ts, googlebooks.ts, cache.ts
  recommender/         # vector.ts, weights.ts, predict.ts, select.ts, reasoning.ts
  recommender.worker.ts
  export.ts            # JSON export/import, weekly snapshot
components/            # tokens-only styling
seed/calibration-deck.json
```

## 4. First run (§7.9) — implementation notes

Route `/onboarding`, four steps, all after step 1 skippable:
1. Welcome & contract (3 sentences, one button).
2. Stated preferences: chips + free text → `StandingPreference[]` (map the
   obvious phrases; unrecognised free text stored as label-only, inert).
3. Calibration: deal `seed/calibration-deck.json` one cover at a time
   (shelf-tone placeholder + serif title); half-star rate or skip; live
   mini-polygon (12-axis radar) grows as ratings land.
4. Backfill invitation → rapid-fire log flow (search → year → verdict → next),
   resumable later from Library.
Exit → For You in Learning state.

## 5. Build 1 scope & acceptance criteria

**In scope:** onboarding, Library (grid + hover profile + book page + table
view), logging via Open Library (Google Books fallback) with cache-at-write,
Review flow, Queue (score-ordered, staleness prompt), full recommender +
Discovery Range + shortlist + hero with reasoning, standing rules settings,
JSON export/import + weekly snapshot, keyboard shortcuts (/ N L V).

**Acceptance:**
1. Fresh profile → onboarding → rate 12 calibration titles → For You shows a
   hero with prediction ± band, 3 evidence chips, ≥2 reasoning sentences.
2. Moving Discovery Range visibly re-ranks; at Far/Unknown slot 5 is a
   wildcard labelled unscored.
3. Rating a book immediately changes T (verify: a 5.0★ pulls the next
   shortlist toward that book's axes).
4. DNF with wrong_mood does NOT move T; DNF with pacing does (negative).
5. Series order: book n+1 never offered before n is finished.
6. Export → wipe IndexedDB → import → identical state (deep-equal).
7. <10 ratings shows Learning state with progress line; ≥10 removes it.
8. Zero skeuomorphism; tokens only; AA contrast; keyboard operable;
   `prefers-reduced-motion` respected.
9. `npm run build` clean; recommender unit-tested against a small fixture
   (deterministic expected ranking committed to the repo).

**Non-goals for Build 1:** Atlas charts, Not-for-you, Ask parsing, narrator
intelligence, Annual Report, imports from Goodreads, PWA, auth, embeddings.
Leave seams (e.g., recommender returns full intermediate values so Atlas can
consume them later); do not build placeholder screens.
