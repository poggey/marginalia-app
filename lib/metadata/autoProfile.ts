import { AXES, type Axis, type Book } from '@/lib/types';

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

// Bring frequent Open Library subject phrasings onto the deck's vocabulary
// so tag-overlap inference actually connects.
const TAG_ALIASES: Record<string, string> = {
  'artificial-intelligence': 'ai',
  'extraterrestrial-beings': 'aliens',
  'human-alien-encounters': 'first-contact',
  'life-on-other-planets': 'aliens',
  'interplanetary-voyages': 'space-opera',
  'space-warfare': 'military-sf',
  'time-travel': 'time',
  'space-ships': 'space-opera',
  'science-fiction-adventure': 'space-opera',
};

export function cleanThemeTags(subjects: string[]): string[] {
  const tags = subjects
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 2 && s.length < 40 && !GENERIC.test(s))
    .map((s) => s.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    .map((s) => TAG_ALIASES[s] ?? s);
  return [...new Set(tags)].slice(0, 8);
}

export interface ProfileHint {
  tag?: string;    // the loved theme tag this book was fetched for
  author?: string; // the loved author this book was fetched for
}

/**
 * Infer a real tone profile instead of shipping neutral guesses. Evidence,
 * strongest first: (1) trusted books by the same author, (2) trusted books
 * carrying the provenance tag, (3) trusted books sharing any theme tag —
 * blended with the keyword nudges from the subjects. Trusted = deck-authored
 * or reader-verified. With no evidence at all the profile stays neutral,
 * and the recommender's knowledge gate keeps the book out of recommendations.
 */
export function inferAxes(
  subjects: string[],
  themeTags: string[],
  corpus: Book[],
  hint: ProfileHint = {},
): Record<Axis, number> {
  const keyword = autoAxes(subjects);
  const trusted = corpus.filter((b) => b.profileVerified || b.source === 'seed');

  const weights = new Map<string, { book: Book; w: number }>();
  const add = (book: Book, w: number) => {
    const cur = weights.get(book.id);
    if (!cur || cur.w < w) weights.set(book.id, { book, w });
  };
  if (hint.author) {
    const a = hint.author.toLowerCase();
    trusted.filter((b) => b.author.toLowerCase() === a).forEach((b) => add(b, 3));
  }
  if (hint.tag) {
    trusted.filter((b) => b.themeTags.includes(hint.tag!)).forEach((b) => add(b, 2));
  }
  const tags = new Set(themeTags);
  for (const b of trusted) {
    const overlap = b.themeTags.filter((t) => tags.has(t)).length;
    if (overlap > 0) add(b, overlap);
  }

  const neighbours = [...weights.values()];
  if (!neighbours.length) return keyword;

  const total = neighbours.reduce((s, n) => s + n.w, 0);
  const out = {} as Record<Axis, number>;
  for (const a of AXES) {
    const fromNeighbours = neighbours.reduce((s, n) => s + n.w * (n.book.axes[a] ?? 0.5), 0) / total;
    // Where a subject keyword fired, split the difference with it.
    out[a] = keyword[a] !== 0.5 ? (keyword[a] + fromNeighbours) / 2 : fromNeighbours;
  }
  return out;
}
