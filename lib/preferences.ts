import { USER_ID, type StandingPreference } from './types';

// Stated preferences (§5.7, onboarding step 2): entered as standing
// preferences and filters, never as fake ratings. Chips map the obvious
// phrases to machine-readable effects; unrecognised free text is stored
// label-only and stays inert.

type PrefSeed = Omit<StandingPreference, 'id' | 'userId'>;

export const PREF_CHIPS: PrefSeed[] = [
  { kind: 'aversion', label: 'No military SF', effect: { type: 'axisCap', axis: 'military', max: 0.5 } },
  { kind: 'aversion', label: 'Nothing too grim', effect: { type: 'axisCap', axis: 'darkness', max: 0.65 } },
  { kind: 'aversion', label: 'No mosaic structure', effect: { type: 'axisCap', axis: 'structure', max: 0.75 } },
  { kind: 'love', label: 'Problem-solving stories', effect: { type: 'axisBias', axis: 'problem_solving', delta: 0.3 } },
  { kind: 'love', label: 'Humour matters', effect: { type: 'axisBias', axis: 'humour', delta: 0.3 } },
  { kind: 'love', label: 'Deep characters', effect: { type: 'axisBias', axis: 'character_depth', delta: 0.3 } },
  { kind: 'love', label: 'Big ideas, big scope', effect: { type: 'axisBias', axis: 'scope', delta: 0.3 } },
  { kind: 'love', label: 'Literary prose', effect: { type: 'axisBias', axis: 'prose_style', delta: 0.3 } },
  { kind: 'love', label: 'Fast pace', effect: { type: 'axisBias', axis: 'pace', delta: 0.3 } },
  { kind: 'constraint', label: 'Easy entry points', effect: { type: 'axisFloor', axis: 'accessibility', min: 0.4 } },
];

const PHRASES: { pattern: RegExp; make: (m: RegExpMatchArray) => PrefSeed }[] = [
  {
    pattern: /no (military|war)/i,
    make: () => ({ kind: 'aversion', label: 'No military SF', effect: { type: 'axisCap', axis: 'military', max: 0.5 } }),
  },
  {
    pattern: /(nothing|not).*(grim|dark|bleak)/i,
    make: () => ({ kind: 'aversion', label: 'Nothing too grim', effect: { type: 'axisCap', axis: 'darkness', max: 0.65 } }),
  },
  {
    pattern: /no (horror|gore)/i,
    make: () => ({ kind: 'aversion', label: 'No horror', effect: { type: 'axisCap', axis: 'darkness', max: 0.6 } }),
  },
  {
    pattern: /(love|like|more).*(humour|humor|funny)/i,
    make: () => ({ kind: 'love', label: 'Humour matters', effect: { type: 'axisBias', axis: 'humour', delta: 0.3 } }),
  },
  {
    pattern: /(fast|pacy|page.?turner)/i,
    make: () => ({ kind: 'love', label: 'Fast pace', effect: { type: 'axisBias', axis: 'pace', delta: 0.3 } }),
  },
  {
    pattern: /under (\d+) ?h/i,
    make: (m) => ({
      kind: 'constraint',
      label: `Under ${m[1]} hours`,
      effect: { type: 'runtime', maxHours: Number(m[1]) },
    }),
  },
  {
    pattern: /no ([a-z-]+)$/i,
    make: (m) => ({
      kind: 'aversion',
      label: `No ${m[1]}`,
      effect: { type: 'excludeTag', tag: m[1].toLowerCase() },
    }),
  },
];

/** Map free text to a machine-readable preference, or store it label-only. */
export function parsePreference(text: string): StandingPreference {
  const trimmed = text.trim();
  for (const { pattern, make } of PHRASES) {
    const m = trimmed.match(pattern);
    if (m) return { id: crypto.randomUUID(), userId: USER_ID, ...make(m) };
  }
  return { id: crypto.randomUUID(), userId: USER_ID, kind: 'constraint', label: trimmed };
}

export function chipToPreference(chip: PrefSeed): StandingPreference {
  return { id: crypto.randomUUID(), userId: USER_ID, ...chip };
}
