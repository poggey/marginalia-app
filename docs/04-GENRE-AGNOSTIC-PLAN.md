# Marginalia — Genre-Agnostic Plan

*Status: **proposed, not scheduled**. Nothing in this document is built. It amends
the white paper's SF-only scope ("a mathematical librarian for a reader of
science fiction"), so it needs sign-off before any code changes — per ground
rule 2, this is a flagged spec change, not a silent substitution.*

## Goal

A reader of any genre — romance, thriller, fantasy, literary, non-fiction —
gets the same first-class experience the SF reader gets today: a calibration
deck they recognise, axes that describe their books, preference chips in their
vocabulary, and a candidate pool in their genre. The mathematics (§V) does not
change; only the furniture around it does.

## Current state (what's SF-tuned today)

| Piece | Today | Severity for a non-SF reader |
|---|---|---|
| Calibration deck | 20 SF titles | High — skips all 20, loses the fast on-ramp |
| Candidate pool | Queue + unread local books (= the SF deck at first) | High — For You recommends SF until they queue their own books |
| The 12 axes | `hardness`, `problem_solving`, `military` are SF-specific | Medium — model runs on ~8 useful dimensions |
| Preference chips + free-text parser | "No military SF", "hard science" phrasing | Low — skippable |
| Auto-profile heuristics | SF-leaning keyword map | Low–medium — non-SF auto-profiles sit near neutral |
| Default runtime window 8–14 h | Audio-first SF reader default | Low — user-editable |

Everything else — taste vector, k-NN, Discovery Range, MMR, wildcard, filters,
review flow, library, queue, export — is already genre-blind.

## Design decision 0 (blocks everything): one axis space, relabelled

Three options considered:

- **(a) One universal 12-axis set** — replace the SF-specific axes with
  genre-neutral equivalents. All the maths assumes a single fixed vector
  space; this keeps T, novelty, k-NN, the fixture and the export format
  structurally intact. **Recommended.**
- (b) Per-genre axis sets — sharpest descriptions, but fragments the vector
  space: cross-genre readers can't be compared to their own history, and the
  pipeline, tests and export all assume one axis vocabulary. Rejected.
- (c) Hybrid (core axes + sparse per-genre flavour axes) — middle ground,
  double the complexity of (a) for marginal gain. Deferred; (a) leaves room
  to add this later.

Proposed universal set (draft — needs sign-off; keep exactly 12 so vector
dimensionality, tests and the deck format are unchanged):

| Today (SF) | Universal replacement | Reads as |
|---|---|---|
| hardness | `grounding` | fantastical/heightened → realistic/grounded |
| pace | `pace` | unchanged |
| tone | `tone` | bleak → hopeful (unchanged) |
| scope | `scope` | intimate → epic (unchanged) |
| character_depth | `character_depth` | unchanged |
| prose_style | `prose_style` | plain → literary (unchanged) |
| problem_solving | `plot_drive` | vibes/character-led → plot-propelled |
| military | `intensity` | gentle/cosy → high-stakes/violent |
| humour | `humour` | unchanged |
| structure | `structure` | linear → mosaic (unchanged) |
| darkness | `darkness` | unchanged |
| accessibility | `accessibility` | demanding → easy entry (unchanged) |

Nine of twelve carry over untouched; `grounding`, `plot_drive`, `intensity`
replace the three SF-specific axes and still describe SF well (hard SF =
high grounding + high plot_drive; military SF = high intensity), so the
existing deck re-authors cleanly. Romance lands at distinct coordinates
(tone/character_depth/intensity/darkness do the work the genre needs); per
white paper §IV, stress-test the set against one concrete romance profile and
one thriller profile before sign-off.

## Phase 1 — Plumbing (genre awareness)

1. **`Book.genres: string[]`** (additive schema field, like `queuedAt`) —
   populated from deck provenance, API subjects/categories at cache-time, and
   user-editable on the book page. Canonical genre slugs: `sf`, `fantasy`,
   `romance`, `thriller-crime`, `literary`, `historical`, `horror`,
   `nonfiction` (launch set — extendable).
2. **Reader genres in meta** (`readerGenres: string[]`), captured at a new
   onboarding step between welcome and preferences: "What do you read?" —
   multi-select chips, skippable (skip = all genres, current behaviour).
   Editable later in Settings.
3. **Candidate-pool genre filter**: the hard-filter stage excludes unread
   books whose `genres` don't intersect `readerGenres` — with two exceptions:
   the Queue is always eligible (explicit intent beats inference), and at
   Far/Unknown the wildcard may cross genres (that's the point of the
   wildcard). Recorded in `excluded[]` with reason `genre` for transparency.
4. **Deck loading**: `ensureSeeded` seeds only the decks for the reader's
   genres (plus lazily when genres change in Settings).

## Phase 2 — Content (the real lift)

1. **Per-genre calibration decks** — 20 widely-read titles per genre with
   authored 12-axis profiles, same JSON shape as today
   (`seed/decks/<genre>.json`; current deck becomes `sf.json`, its axis keys
   migrated to the universal set). Authoring quality gates: axis spread
   across the space, recognition likelihood, length/register variety —
   white paper Appendix XIII rules apply per genre. Multi-genre readers get
   decks interleaved (alternating genres, same "skips cost nothing" rule).
   Launch with 4 decks (SF, fantasy, romance, thriller/crime); others follow.
2. **Per-genre preference chips** (`lib/preferences.ts` becomes keyed by
   genre): e.g. romance — "No cliffhangers between books" (excludeTag),
   "Closed-door only" (axisCap intensity), "Slow burn is the point"
   (axisBias pace −), "Guaranteed HEA" (excludeTag). Free-text parser gains
   the obvious per-genre phrases.
3. **Auto-profile heuristics per genre** (`autoProfile.ts`): keyword→axis
   maps keyed by detected genre so romance/thriller auto-profiles stop
   sitting at neutral. Still `profileVerified: false` + user-adjustable.

## Phase 3 — Migration & compatibility

1. **Axis key migration**: Dexie upgrade (version bump) renaming
   `hardness→grounding`, `problem_solving→plot_drive`, `military→intensity`
   in every stored `Book.axes`; values carry over 1:1 (semantics were chosen
   to make this defensible). `AXES`/`AXIS_LABELS` in `lib/types.ts` updated.
2. **Export format v2**: bump payload version; importer accepts v1 and
   migrates keys on the way in (round-trip test for both versions).
3. **Standing preferences**: migrate stored `effect.axis` keys the same way.
4. **Fixture & tests**: regenerate `expected.json` after the deck re-author
   (ranking values shift because axis values shift — this is expected and
   reviewed, not silent); add per-genre filter tests and a mixed-genre
   reader test (romance + SF ratings in one T).

## Phase 4 — Acceptance (per-persona walkthrough)

1. Fresh profile → picks Romance only → onboarding deals the romance deck →
   rates 12 → For You hero is a romance title with band, chips, reasoning.
2. Same reader: no SF deck title ever appears in shortlist slots 1–4;
   wildcard may cross genres at Far/Unknown, labelled as today.
3. Mixed reader (SF + romance) → both decks dealt interleaved; shortlist
   draws from both; MMR keeps it varied.
4. Genre change in Settings → new deck seeds; pool re-filters live.
5. v1 export imports cleanly into the migrated app (deep-equal after key
   migration).
6. All existing Build 1 acceptance criteria still pass for the SF persona.

## Explicit non-goals (this plan)

- Per-genre axis *sets* (option b) and reader-defined custom axes.
- The ~500-title curated corpus per genre (separate content effort; pool
  still grows via search/queue as today).
- Any change to the recommender constants or pipeline order.
- Auto-detecting reader genres from behaviour (they choose; the model learns
  taste, not demographics).

## Estimated shape

Phase 1 is a day of plumbing. Phase 2 is dominated by deck authoring
(≈20 titles × 12 axes × per genre — needs care, not code). Phase 3 is
half a day plus test regeneration. The critical path is Design decision 0:
nothing should start until the universal axis set is approved, because the
deck authoring, migration and fixture all hang off it.
