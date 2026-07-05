import type { Rating, ReadingRecord } from '@/lib/types';
import {
  DNF_WEIGHT, MS_PER_MONTH, REREAD_MULTIPLIER, TAU_MONTHS, VERDICT_STRENGTH,
} from './constants';

// §5.2 Weigh: w_b = s(r_b)·exp(−Δt/τ); DNF −0.75 (wrong_mood 0); ×1.3 re-read-yes.

/** Verdict→strength; table covers 1.0–5.0 in halves, s(0.5) clamps to −1.0. */
export function verdictStrength(verdict: number): number {
  if (verdict >= 5) return 1.0;
  if (verdict <= 1) return -1.0;
  for (let i = 0; i < VERDICT_STRENGTH.length - 1; i++) {
    const [hi, sHi] = VERDICT_STRENGTH[i];
    const [lo, sLo] = VERDICT_STRENGTH[i + 1];
    if (verdict <= hi && verdict >= lo) {
      if (verdict === hi) return sHi;
      if (verdict === lo) return sLo;
      return sLo + ((verdict - lo) / (hi - lo)) * (sHi - sLo); // half-steps interpolated
    }
  }
  return 0;
}

export function recencyDecay(whenISO: string, now: Date): number {
  const dtMonths = Math.max(0, (now.getTime() - new Date(whenISO).getTime()) / MS_PER_MONTH);
  return Math.exp(-dtMonths / TAU_MONTHS);
}

/** Weight of a rated encounter. */
export function ratingWeight(rating: Rating, now: Date): number {
  let w = verdictStrength(rating.verdict) * recencyDecay(rating.ratedAt, now);
  if (rating.wouldReread) w *= REREAD_MULTIPLIER;
  return w;
}

/** Weight of a DNF encounter (no rating). wrong_mood carries no weight. */
export function dnfWeight(record: ReadingRecord, now: Date): number {
  if (record.status !== 'abandoned' || !record.dnfReason) return 0;
  if (record.dnfReason === 'wrong_mood') return 0;
  const when = record.finishedAt ?? record.startedAt;
  return DNF_WEIGHT * (when ? recencyDecay(when, now) : 1);
}
