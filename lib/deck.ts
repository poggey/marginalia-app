import deck from '@/seed/calibration-deck.json';
import type { Axis, Book } from './types';

// The 20-title calibration deck (white paper Appendix XIII.A) — the only data
// that ships with the app. User history never does: zero-knowledge start.

interface DeckEntry {
  title: string;
  author: string;
  year: number;
  audioHours: number;
  themeTags: string[];
  axes: Record<string, number>;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function deckBooks(): Book[] {
  return (deck.deck as DeckEntry[]).map((e) => ({
    id: `seed-${slug(e.title)}`,
    title: e.title,
    author: e.author,
    year: e.year,
    audioHours: e.audioHours,
    subjects: [],
    axes: e.axes as Record<Axis, number>,
    themeTags: e.themeTags,
    profileVerified: false,
    source: 'seed' as const,
  }));
}
