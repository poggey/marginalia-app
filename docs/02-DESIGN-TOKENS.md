# Porcelain & Ink — Design Tokens

Implementation-ready distillation of white paper Chapter IX. The approved
visual reference is `reference/approved-ui-mock.html` — when in doubt, open it.

## 1. Colour

### Core
| Token | Hex | Role |
|---|---|---|
| `porcelain` | `#F7F7F4` | Page background. Never pure white, never cream. |
| `surface` | `#FFFFFF` | Panels/cards, on hairline borders. |
| `ink` | `#17181C` | Primary text, chart lines. |
| `ink-2` | `#5B5E66` | Secondary text: reasoning, metadata, captions. |
| `ink-3` | `#9A9DA6` | Tertiary: labels, placeholders, DNF states. |
| `hairline` | `#E7E7E2` | All borders/dividers, 1px. |
| `hairline-2` | `#EFEFEA` | Row separators, subtle grid. |
| `accent` | `#3546E8` | THE accent (ultramarine): primary buttons, current Discovery stop, active nav, links, wildcard tags, prediction ring. |
| `accent-ink` | `#2635B8` | Accent hover/pressed. |
| `accent-soft` | `#EDEFFE` | Accent fields: halo behind current stop, tag backgrounds. |
| `positive` | `#1D7A5F` | Trend-up deltas / success only. Never decorative. |

**Accent budget:** ultramarine ≤ a few % of any screen; if it appears more
than ~4 times in a viewport, remove some.

### Shelf tones (secondary palette)
Gradient pairs, rendered at 150° (`linear-gradient(150deg, HI, BASE)`):

| Token | Highlight → Base |
|---|---|
| `midnight` | `#33406B → #151B33` |
| `forest`   | `#1E5C4F → #0C2B24` |
| `sepia`    | `#7A4A2B → #3C2113` |
| `graphite` | `#5B5E66 → #26272B` |

Usage: cover placeholders (serif title set on the tone), categorical chart
series (fixed order above), dark diagram cards, empty states. Assign to a book
deterministically: `tone = tones[hash(author) % 4]`. Text on tones: `#EDEFF8`,
≥ 4.5:1. Shelf tones never carry UI controls. They are the only saturated
large surfaces in the product.

## 2. Typography

| Role | Face | Rules |
|---|---|---|
| Product UI | **Instrument Sans** (Google Fonts) | Everything functional. Weights 400/500/600 only. Uppercase labels: 11–12px, `.12em` tracking, weight 600, `ink-3`. |
| Editorial | **Newsreader** (Google Fonts) | Book titles, hero headline, big numbers, pull-quotes, Discovery stop name. Weight 500, tight leading, `-0.01em`+ at display sizes. Italic for librarian asides. Nowhere else. |
| Data | tabular numerals | `font-variant-numeric: tabular-nums` on every rating, similarity, delta, hour. No monospace in the UI. |

Base: 15px/1.6 body · scale roughly 12 / 13.5 / 15 / 17 / 22 / 26 / 34 / 46.

## 3. Shape & elevation

- Radii: **20px** panels · **16px** cards · **10px** buttons · **9px** inputs · **999px** pills · **8px** covers.
- Two elevations only:
  - Resting: `border: 1px solid hairline`, shadow ≈ none.
  - Raised (hero, hover): `0 1px 2px rgba(23,24,28,.03), 0 24px 48px -32px rgba(23,24,28,.1)`.
- Cover on hero additionally: `0 24px 40px -20px rgba(23,24,28,.4)`.
- No inner shadows, no glows, no gradients on chrome (shelf tones only).

## 4. Spacing & layout

4px base grid. Content max-width ~1120px. 64px+ between major sections.
Top navigation (sticky, blurred porcelain, active link = 2px accent underline):
Library · For you · Reading · Queue · Atlas — search field right, `/` focuses.

## 5. Motion

| Moment | Spec |
|---|---|
| Shortlist re-rank | rows fade + 5px translate-in, 45ms stagger — the one orchestrated moment |
| Card hover | lift 3px + raised shadow, 200ms ease |
| Button hover | lift 1px, 150ms |
| Discovery fill | width change, 300ms `cubic-bezier(.3,1,.4,1)` (soft spring) |
| Everything else | instant or 150ms fade |

Full `prefers-reduced-motion` fallback: all of the above become crossfades.

## 6. Accessibility floor

WCAG AA on every pair (ink/porcelain ≈15:1; ink-2 ≈6.5:1; accent only ≥14px
semibold). Focus: 2px accent ring, 2px offset. Full keyboard operation.
Touch targets ≥ 44px. Charts encode with position/label in addition to colour.

## 7. Tailwind theme (drop-in)

```ts
// tailwind.config.ts (excerpt)
extend: {
  colors: {
    porcelain:'#F7F7F4', surface:'#FFFFFF',
    ink:{ DEFAULT:'#17181C', 2:'#5B5E66', 3:'#9A9DA6' },
    hairline:{ DEFAULT:'#E7E7E2', 2:'#EFEFEA' },
    accent:{ DEFAULT:'#3546E8', ink:'#2635B8', soft:'#EDEFFE' },
    positive:'#1D7A5F',
    midnight:{ hi:'#33406B', base:'#151B33' },
    forest:{ hi:'#1E5C4F', base:'#0C2B24' },
    sepia:{ hi:'#7A4A2B', base:'#3C2113' },
    graphite:{ hi:'#5B5E66', base:'#26272B' },
  },
  fontFamily: {
    sans:['"Instrument Sans"','system-ui','sans-serif'],
    serif:['Newsreader','Georgia','serif'],
  },
  borderRadius:{ panel:'20px', card:'16px', btn:'10px', input:'9px' },
  boxShadow:{
    resting:'0 0 0 0 transparent',
    raised:'0 1px 2px rgba(23,24,28,.03), 0 24px 48px -32px rgba(23,24,28,.1)',
    cover:'0 24px 40px -20px rgba(23,24,28,.4)',
  },
}
```
