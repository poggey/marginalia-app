import { AXES, type Axis } from '@/lib/types';

// Heuristic subject→axis seeding for on-demand additions. Auto-profiles are
// honest guesses: profileVerified=false, shown as "Unverified", user-adjustable
// on the book page (white paper §IV — the reader's perception is ground truth).

const NUDGES: { pattern: RegExp; axis: Axis; value: number }[] = [
  { pattern: /hard science|physics|engineering|space flight|astronaut/i, axis: 'hardness', value: 0.8 },
  { pattern: /hard science|engineering|problem/i, axis: 'problem_solving', value: 0.75 },
  { pattern: /thriller|suspense|adventure/i, axis: 'pace', value: 0.8 },
  { pattern: /literary|philosoph/i, axis: 'prose_style', value: 0.8 },
  { pattern: /literary|philosoph/i, axis: 'accessibility', value: 0.35 },
  { pattern: /humor|humour|comic|satire/i, axis: 'humour', value: 0.8 },
  { pattern: /military|war stories|soldiers/i, axis: 'military', value: 0.8 },
  { pattern: /space opera|galactic|interstellar|far future/i, axis: 'scope', value: 0.8 },
  { pattern: /dystopia|horror|apocalyp|grimdark/i, axis: 'darkness', value: 0.75 },
  { pattern: /dystopia|horror|apocalyp|grimdark/i, axis: 'tone', value: 0.3 },
  { pattern: /cozy|cosy|heartwarming|found family/i, axis: 'tone', value: 0.85 },
  { pattern: /cozy|cosy|heartwarming|found family/i, axis: 'darkness', value: 0.15 },
  { pattern: /character stud|coming of age|relationships|domestic/i, axis: 'character_depth', value: 0.75 },
  { pattern: /time travel|nonlinear|experimental/i, axis: 'structure', value: 0.7 },
  { pattern: /young adult|humor|popular/i, axis: 'accessibility', value: 0.8 },
];

const GENERIC = /^(fiction|science fiction|sci-fi|novel|general|literature|english|american|accessible book|protected daisy|in library|large type books|new york times bestseller|fiction, science fiction, general)$/i;

export function autoAxes(subjects: string[]): Record<Axis, number> {
  const axes = Object.fromEntries(AXES.map((a) => [a, 0.5])) as Record<Axis, number>;
  const hay = subjects.join(' · ');
  for (const { pattern, axis, value } of NUDGES) {
    if (pattern.test(hay)) axes[axis] = value;
  }
  return axes;
}

export function cleanThemeTags(subjects: string[]): string[] {
  const tags = subjects
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2 && s.length < 40 && !GENERIC.test(s))
    .map((s) => s.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  return [...new Set(tags)].slice(0, 8);
}
