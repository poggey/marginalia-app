// Every algorithm constant, verbatim from docs/03-ENGINEERING.md §2.
// "The maths is the spec" — no improvisation. Where the spec leaves a formula
// open, the concretization is marked CONCRETIZED and flagged in the build report.

/** Axis block weight vs theme tags in the book vector (§5.1). */
export const AXIS_WEIGHT = 2;

/** Recency decay time constant, months (§5.2). */
export const TAU_MONTHS = 24;

/** Verdict→strength s(r), half-steps as tabled (§5.2). */
export const VERDICT_STRENGTH: [verdict: number, s: number][] = [
  [5.0, 1.0], [4.5, 0.8], [4.0, 0.55], [3.5, 0.3], [3.0, 0.1],
  [2.5, -0.2], [2.0, -0.5], [1.5, -0.75], [1.0, -1.0],
];
// CONCRETIZED: verdicts can be 0.5 but the table stops at 1.0 → s(0.5) clamps to −1.0.

/** DNF weight (any reason except wrong_mood) (§5.2). */
export const DNF_WEIGHT = -0.75;

/** wrong_mood: no fault — weight 0, book suppressed 6 months (§5.2). */
export const WRONG_MOOD_SUPPRESS_MONTHS = 6;

/** Re-read-yes multiplier (§5.2). */
export const REREAD_MULTIPLIER = 1.3;

/** k-NN neighbour count (§5.4). */
export const K_NEIGHBOURS = 7;

/** Similarity exponent for neighbour weights (§5.4). */
export const SIM_EXPONENT = 3;

/** Shrinkage λ toward the user mean r̄ (§5.4). */
export const SHRINKAGE_LAMBDA = 1.5;

/**
 * Confidence band (§5.4): "from neighbour agreement (weighted std) + mean
 * neighbour distance; render as ±x rounded to 0.1".
 * CONCRETIZED: band = clamp(σ_w + 0.6·mean(1−sim_i), 0.2, 1.2), rounded to 0.1;
 * in the Learning state the band is widened ×1.5 (re-clamped) per §5.7.
 */
export const BAND_DISTANCE_WEIGHT = 0.6;
export const BAND_MIN = 0.2;
export const BAND_MAX = 1.2;
export const LEARNING_BAND_MULTIPLIER = 1.5;

/** Discovery Range stops (Ch. VI). Default Familiar. */
export const DELTA_STOPS = [
  { name: 'Comfort shelf', short: 'Comfort', delta: 0.0, desc: 'Only the surest bets' },
  { name: 'Familiar ground', short: 'Familiar', delta: 0.12, desc: 'Gentle variation on what you love' },
  { name: 'Adjacent shelves', short: 'Adjacent', delta: 0.25, desc: 'Neighbouring subgenres open up' },
  { name: 'Far shelves', short: 'Far', delta: 0.42, desc: 'One wildcard guaranteed in five' },
  { name: 'Terra incognita', short: 'Unknown', delta: 0.6, desc: "Your filters apply. Your taste doesn't" },
] as const;
export const DEFAULT_STOP_INDEX = 1;

/** Wildcard threshold: at Far & Unknown, slot 5 = argmax nov (Ch. VI). */
export const WILDCARD_MIN_DELTA = 0.42;

/** MMR: argmax [0.75·Score − 0.25·max cos to picked]; shortlist n=5 (§5.5). */
export const MMR_SCORE_WEIGHT = 0.75;
export const MMR_DIVERSITY_WEIGHT = 0.25;
export const SHORTLIST_SIZE = 5;

/** Learning state below 10 ratings (§5.7). */
export const LEARNING_THRESHOLD = 10;

/** Sensitivity ridge regression: fit at ≥25 ratings, refit each rating (§5.8). */
export const SENSITIVITY_MIN_RATINGS = 25;
/** CONCRETIZED: ridge α (the spec fixes the method, not the penalty). */
export const RIDGE_ALPHA = 1.0;

/** Default runtime filter, audio hours, user-editable (§5.6). */
export const DEFAULT_RUNTIME_MIN_HOURS = 8;
export const DEFAULT_RUNTIME_MAX_HOURS = 14;

export const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
