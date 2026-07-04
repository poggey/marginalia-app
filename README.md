# Marginalia — Build Kit

A mathematical librarian: track your reading, rate on multiple axes, and get
next-book recommendations from an explicit, inspectable model — with a
Discovery Range control that trades familiarity for adventure.

## What's in this kit

| Path | Purpose |
|---|---|
| `docs/01-WHITE-PAPER.md` | **The spec.** Single source of truth: vision, data model, the full recommendation mathematics, every surface, design system, architecture, risks, roadmap. Read first. |
| `docs/02-DESIGN-TOKENS.md` | Porcelain & Ink as implementation-ready tokens: Tailwind theme, type rules, elevation, motion, accessibility floor. |
| `docs/03-ENGINEERING.md` | TypeScript interfaces, every algorithm constant in one table, pipeline order, suggested project structure, Build 1 scope + acceptance criteria, explicit non-goals. |
| `reference/approved-ui-mock.html` | **The approved look.** Open in a browser. The built app's For You surface should be recognisably this. |
| `reference/white-paper.html` | The designed edition of the spec (same content as 01, nicer to read). |
| `seed/calibration-deck.json` | The 20-title calibration deck with pre-authored 12-axis profiles — first-run data, ready to import. |
| `KICKSTART-PROMPT.md` | The prompt that starts the build. |

## Ground rules (non-negotiable)

1. **Zero-knowledge start.** Every account begins as an empty ledger. No
   pre-loaded history, no assumed taste. The first run (§7.9) is the only
   way the model learns.
2. **The maths is the spec.** Constants and formulas in white paper §V /
   ENGINEERING.md are not suggestions. If a change seems necessary, flag it —
   don't silently substitute.
3. **The concept lives in the logic, not the chrome.** No skeuomorphism,
   ever (white paper §9.1 records why). Porcelain & Ink tokens only.
4. **Show the working.** Every recommendation renders with its predicted
   rating ± band, its driving neighbours, and plain-English reasoning.
5. **Local-first.** IndexedDB (Dexie), one-click JSON export, no backend in v1.

## Build order

Build 1 (this engagement): the complete loop — first run → Library → Review →
recommender + Discovery Range → Queue → export. See ENGINEERING.md §5 for the
precise scope and acceptance criteria. Atlas, Not-for-you, Ask, PWA are later
builds; leave clean seams, don't stub UIs.
