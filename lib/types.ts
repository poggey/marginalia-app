// Source of truth for the schema — docs/03-ENGINEERING.md §1, verbatim.

export type Axis =
  | 'hardness' | 'pace' | 'tone' | 'scope' | 'character_depth' | 'prose_style'
  | 'problem_solving' | 'military' | 'humour' | 'structure' | 'darkness'
  | 'accessibility';

export const AXES: Axis[] = [
  'hardness', 'pace', 'tone', 'scope', 'character_depth', 'prose_style',
  'problem_solving', 'military', 'humour', 'structure', 'darkness',
  'accessibility',
];

export const AXIS_LABELS: Record<Axis, string> = {
  hardness: 'Hardness',
  pace: 'Pace',
  tone: 'Tone',
  scope: 'Scope',
  character_depth: 'Characters',
  prose_style: 'Prose',
  problem_solving: 'Problem-solving',
  military: 'Military',
  humour: 'Humour',
  structure: 'Structure',
  darkness: 'Darkness',
  accessibility: 'Accessibility',
};

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
  popularity?: number;        // additive vs ENGINEERING §1: Open Library readinglog count at fetch time — powers the recognition floor
}

export type ReadingStatus = 'queued' | 'reading' | 'finished' | 'abandoned' | 'paused';
export type DnfReason =
  | 'pacing' | 'tone' | 'characters' | 'prose' | 'lost_interest'
  | 'too_grim' | 'too_confusing' | 'wrong_mood';

export const DNF_LABELS: Record<DnfReason, string> = {
  pacing: 'Pacing',
  tone: 'Tone',
  characters: 'Characters',
  prose: 'Prose',
  lost_interest: 'Lost interest',
  too_grim: 'Too grim',
  too_confusing: 'Too confusing',
  wrong_mood: 'Wrong mood (no fault)',
};

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
  queuedAt?: string;           // additive vs ENGINEERING §1: powers the ≥1-year queue staleness prompt (§7.5)
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
  effect?:                    // machine-readable; absent = label-only, inert
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

// v1 single-reader constant — the multi-user seam.
export const USER_ID = 'local';
