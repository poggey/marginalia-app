// Shelf tones — the secondary palette. Assigned deterministically:
// tone = tones[hash(author) % 4] (docs/02-DESIGN-TOKENS.md §1).

export interface ShelfTone {
  name: 'midnight' | 'forest' | 'sepia' | 'graphite';
  hi: string;
  base: string;
}

export const SHELF_TONES: ShelfTone[] = [
  { name: 'midnight', hi: '#33406B', base: '#151B33' },
  { name: 'forest', hi: '#1E5C4F', base: '#0C2B24' },
  { name: 'sepia', hi: '#7A4A2B', base: '#3C2113' },
  { name: 'graphite', hi: '#5B5E66', base: '#26272B' },
];

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

export function shelfTone(author: string): ShelfTone {
  return SHELF_TONES[hashString(author) % 4];
}

export function toneGradient(author: string): string {
  const t = shelfTone(author);
  return `linear-gradient(150deg, ${t.hi}, ${t.base})`;
}
