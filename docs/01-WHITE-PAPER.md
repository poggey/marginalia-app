# Marginalia
### A mathematical librarian for a reader of science fiction — White Paper v2.0
*July 2026 · supersedes v1.0 · single-reader deployment, user-agnostic by design · Status: specification, approved design direction, pre-build*

---

## Abstract

Marginalia is a personal reading system with one conviction: a good librarian does not guess. It tracks a personal library, captures multi-axis ratings, builds a quantified model of one reader's taste, and recommends the next book by explicit mathematics — with a Discovery Range control trading familiarity for adventure. **v2.0 replaces the v1.0 design language in full.** The librarian remains the *concept* — memory, judgement, transparency — but the interface is a quiet modern product: porcelain surfaces, hairline structure, restrained ultramarine, editorial serif reserved for book titles, and four deep shelf tones. **The system opens knowing nothing:** every account — including the author's own — begins as an empty ledger and earns its model through a designed first run (§5.7, §7.9), so the tool works identically for any reader from day zero. The mathematics, data model, features, architecture and risks carry forward in substance and are restated here as the single source of truth for the build.

## I. Vision & principles

The librarian is a concept, not a costume — it lives in behaviour (memory, judgement, transparency, honest uncertainty), never in skeuomorphic decoration. Principles: (1) the librarian shows their working — every pick ships with similarity scores, driving neighbours, confidence interval; (2) sub-15-second logging or none; (3) taste is multi-dimensional; (4) negative data is data — DNFs are first-class, recorded without guilt or theatre; (5) comfort is a setting, not a cage; (6) the reader owns the ledger (one-click JSON export); (7) quiet confidence — few colours, typography does the work, the accent marks decisions only.

## II. The problem

Untracked reading creates the rediscovery problem (why a book landed decays from memory), choice paralysis (retail engines serve the shop), the rut problem (engines converge on clones with no user-facing deviation control), and the evidence problem ("4 stars" is lossy). Goodreads tracks but recommends poorly; StoryGraph is opaque; retail serves retail. The gap: a personal, transparent, mathematically explicit librarian with one client.

## III. System overview

A loop: **log → rate → model → recommend (moderated by the Discovery Range) → read → repeat.** Six primary surfaces off a single top nav, plus one secondary: **Library** (the full ledger), **For you** (hero pick + shortlist + Discovery Range), **Reading** (progress, pace, projected finish), **Queue** (TBR by live model score), **Atlas** (all charts), **Review** (the 60-second rating flow), and **Not for you** (anti-recommendations with overrides).

## IV. The data model

**Book** — fetched via Open Library / Google Books (title, author, ISBN, cover cached locally, pages, year, subjects), plus `series/series_index`, `audio_hours`, `narrator`, and the **book profile**.

**Book profile: twelve tone axes (0→1)** — hardness, pace, tone (bleak→hopeful), scope, character_depth, prose_style, problem_solving, military, humour, structure (linear→mosaic), darkness, accessibility. Auto-seeded, reader-adjustable; the reader's perception is ground truth. Axes are general to the genre, stress-tested against one concrete profile (Weir/Bobiverse propulsion vs. big-idea epics vs. common aversions land at distinct coordinates) — the space carries no assumptions about whose taste will fill it.

**Reading Record** — one encounter; re-reads are new records. Status `queued → reading → finished | abandoned | paused`; format; optional sessions; dates. **DNF taxonomy:** pacing, tone, characters, prose, lost interest, too grim, too confusing, *wrong mood (no fault — suppress, don't punish)*. UI treats stopping as neutral: "Stopped at 31%", quiet grey.

**Rating** — five axis sliders (Ideas, Pace, Characters, Prose, Ending), a half-star **verdict** (0.5–5.0), the binary **"would you re-read?"**, up to three mood tags, optional note.

**Taste Profile** — always computed, never entered; recomputable from the ledger; what makes multi-user cheap later.

## V. The mathematics of taste

Content-based, transparent, effective from ~15 rated books.

1. **Represent.** `x_b = [12 tone axes | TF-IDF theme tags]`, L2-normalised; axes ×2 vs tags; representation opaque to the rest of the pipeline (embeddings addable later).
2. **Weigh.** `w_b = s(r_b)·exp(−Δt/τ)`; s(5★)=+1.0 … s(1★)=−1.0; DNF=−0.75 (wrong-mood=0, suppressed 6 months); τ=24 months; ×1.3 for re-read-yes.
3. **Compare.** **T** = signed weighted centroid (aversions push T away). `sim(c)=cos(T,x_c)`.
4. **Predict.** k-NN (k=7, sim³ weights) over the reader's own rated books, shrunk toward their mean (λ=1.5). Every prediction carries a confidence band — **4.5 ± 0.3** on the hero's ring gauge — from neighbour agreement and distance.
5. **Select.** `nov(c)=1−max_b cos(x_c,x_b)`; `Score=(1−δ)·r̂/5+δ·nov`, δ from the Discovery Range. Shortlist of five by MMR: `argmax[0.75·Score − 0.25·max sim-to-picked]`.

**Hard filters first:** already-read, series order, runtime window (default 8–14 audio hours), suppressions, reader-written standing rules.

**Cold start — day zero:** every account starts at exactly zero; no pre-loaded history, no assumed taste, no special path for anyone (the author's account is created like any other). Three input channels, usable in any mix: (1) the ~20-title **calibration deck** spanning all axes — rate what you recognise, skip freely; (2) **backfill** of real history via a rapid-fire flow (search → year read → verdict → next); (3) **stated preferences** — likes, aversions and constraints entered as standing preferences and filters, never as fake ratings, constraining picks before any ratings exist. Below ~10 rated books, For You carries a visible **Learning** state: deliberately wide bands, preference-and-popularity picks labelled as such, and a progress line ("Rate 6 more books to unlock confident predictions").

**Sensitivity learning:** after ~25 ratings, ridge regression of verdicts on axes learns which dimensions drive this reader's joy, re-weights similarity, shown openly as "What actually moves you."

## VI. The Discovery Range

One parameter δ on a clean five-stop slider (hairline track, filled segment, ringed current stop):

| Stop | δ | Posture |
|---|---|---|
| Comfort | 0.00 | surest bets only |
| Familiar | 0.12 | default; gentle variation |
| Adjacent | 0.25 | neighbouring subgenres open |
| Far | 0.42 | one wildcard guaranteed in five |
| Unknown | 0.60 | filters apply; taste doesn't |

At Far/Unknown, slot five is a pure-novelty **wildcard**, honestly shown *unscored* with a small tag. Every pick records its δ; the panel beneath the control shows the reader's real average rating at that range ("4.3 avg across 61 books"). The system never moves δ itself — at most one quiet, dismissible suggestion.

## VII. Features & surfaces

- **Library:** card grid — real cover or shelf-tone placeholder with serif title, rating, format; hover reveals the tone-axis profile; click opens the full book page with editable axes; instant search, combinable filters, table view on `V`.
- **For you:** the **hero pick** — one book with serif title, meta pills, a ring-gauge prediction (4.5 ± 0.3, "high confidence"), two sentences of plain-English reasoning generated from the actual maths, evidence chips (*Project Hail Mary · 0.91*), and actions (Start reading / Add to queue / Not for me). Below: Discovery Range beside the live-re-ranking shortlist; an **Ask** field for natural-language moods.
- **Reading:** progress, pace sparkline, projected finish date; concurrent books without judgement.
- **Review:** the <60-second flow — five sliders, half-star verdict, re-read question, mood chips, optional note; one clean transition on confirm. DNF asks only the reason.
- **Queue:** ordered by live model score; ≥1-year-stale entries get a quiet one-tap remove. Target 10–25.
- **Not for you:** anti-recommendations with reasoning and an "I'd try this anyway" override — the anti-bubble valve.
- **First run (§7.9):** the front door — empty ledger to first defensible pick in under ten minutes. Four steps: (1) welcome & the contract, three sentences; (2) optional stated preferences as chips + free text; (3) the calibration deck, dealt one cover at a time with a live miniature taste polygon forming as ratings land; (4) optional backfill invitation. Every step after the welcome is skippable; a skip-everything reader starts with a blank model and the same path to precision as everyone else. This flow *is* the universal onboarding — the public edition needs no new design.
- **Cross-cutting:** series intelligence (n+1 auto-surfaces, range-exempt), Goodreads/StoryGraph import + backfill mode, narrator intelligence, the Annual Report, weekly auto-export, keyboard-first (`/`, `N`, `L`, `V`).

## VIII. The Atlas

Taste radar (today vs a year ago, drift as a picture) · the map (PCA scatter, shelf-tone coloured) · sensitivity bars (which axes predict your ratings) · hours & books timeline · rating distribution · range returns (ratings grouped by the δ that surfaced them) · author map (network; unread neighbours faint) · **the report card** (predicted vs actual, MAE printed without excuses). All D3, house-styled; hover reveals books, click pins, SVG export.

## IX. Design system: Porcelain & Ink

**The lesson from v1.0, recorded so it isn't relearned: the concept belongs in the logic, not the chrome.** The skeuomorphic card-catalogue read as costume. v2 is a quiet modern product; warmth comes from typography and the books themselves.

**Core palette** — Porcelain `#F7F7F4` (page) · Surface `#FFFFFF` (panels, hairline-bordered) · Ink `#17181C` · Ink-2 `#5B5E66` · Ink-3 `#9A9DA6` (labels, DNF states) · Hairline `#E7E7E2` · **Ultramarine `#3546E8`** (the single accent: primary actions, current stop, active nav, wildcard tags, prediction ring; hover `#2635B8`, soft field `#EDEFFE`) · Positive `#1D7A5F` (trend-up only). Accent budget: a few percent of any screen, max.

**Shelf tones (secondary palette, from the approved cover blocks)** — gradient pairs at 150°:
- Midnight `#33406B → #151B33`
- Forest `#1E5C4F → #0C2B24`
- Sepia `#7A4A2B → #3C2113`
- Graphite `#5B5E66 → #26272B`

Usage: cover placeholders (serif title on tone), categorical chart series in fixed order, dark diagram cards, Annual Report themes, empty states. Assigned deterministically (hash of author). The only saturated large surfaces; never carry UI controls; text on them is off-white `#EDEFF8` at ≥4.5:1.

**Type** — Instrument Sans for everything functional (400/500/600; uppercase labels 11–12px, .12em tracking). Newsreader (500, tight, slightly negative tracking) for book titles, hero headlines, big numbers, pull-quotes, stop names — the entire "library" note, used with restraint. Tabular numerals everywhere data appears; no monospace in the UI.

**Shape & depth** — radii 20/16/10/9/999; two elevations only (hairline resting; soft large low-opacity shadow raised); 4px grid; 64px+ between sections; covers 8px radius, strong shadow on hero only.

**Motion** — functional and brief: shortlist re-rank with 45ms stagger (the one orchestrated moment), 3px card lift on hover, soft-spring range fill, everything else instant or 150ms; full reduced-motion fallback.

**Dark appearance** — deferred; if built, derived from shelf tones (Graphite surfaces, Midnight accents), never an inversion. **Accessibility** — WCAG AA throughout, position/label alongside colour, 2px ultramarine focus ring, full keyboard, ≥44px touch targets.

## X. Technical architecture

Next.js + Tailwind (tokens = design source of truth) on Vercel free tier · IndexedDB via Dexie, weekly auto-snapshot · Open Library + Google Books fallback, cache-at-write · recommender in pure TypeScript in a web worker · D3 charts · rule-based Ask parsing in v1 · installable offline-capable PWA. **Candidate pool:** Queue → curated ~500-title seed corpus with hand-checked profiles → on-demand Open Library expansion, auto-profiles tagged *Unverified*. **Multi-user seam:** all user data behind `userId` from day one; every account already starts from zero and the first run assumes nothing about its reader, so going multi-user adds auth + hosted Postgres and no new onboarding. **Embeddings:** additive later, adopted only if the report card's MAE improves.

## XI. Risk register

| Risk | Mitigation |
|---|---|
| Logging fatigue | 15-s logging, 60-s review, backfill, minimal mandatory fields |
| Cold start | three-channel first run, visible Learning state with honest wide bands, explicit progress line |
| Filter bubble | Discovery Range, MMR, wildcard, range-returns evidence, Not-for-you override |
| Mood overfitting | gentle decay (τ=24mo), drift visible on radar, profile pinning |
| Metadata quality | curated corpus, Unverified tags, user-adjustable axes |
| Data loss | weekly auto-snapshot, tested round-trip export/import |
| API mortality | cache-at-write, fallback API, graceful manual-entry degradation |
| Cover licensing (public) | hotlink per API terms; shelf-tone placeholders mean design never depends on covers |
| Self-gaming ratings | "pin this preference" standing rules |
| Scope creep | staged editions, each shipped whole |
| Design drift | Porcelain & Ink tokens as single source; accent-budget and two-elevation rules enforced; §9.1 lesson recorded |
| Metric myopia | felt-experience axes; the Annual Report's one unquantified question |

## XII. Roadmap

- **First build (wks 1–3):** the complete loop — Library, logging, Review, full recommender + Discovery Range, Queue, export, calibration — shipped in the approved design from day one.
- **Second build (wks 4–6):** the Atlas, sensitivity regression, Reading sessions, Not-for-you, PWA.
- **Third build (mo 2–3):** Ask, narrator intelligence, Annual Report, imports, range analytics.
- **Public edition:** auth + hosted storage across the seam, per-user librarians, sync, shareable reports — gated on a proven season of report-card performance.
- **Speculative:** friend-blend picks, book-club mode, non-SF wings, embeddings, monthly librarian's letter, a designed dark appearance from the shelf tones.

## XIII. Appendix

**The calibration deck:** chosen so any reader can shape the model from nothing — titles must span the twelve axes, be widely read (recognition likely), and vary in length and register. Illustrative twenty: *Project Hail Mary*, *The Martian*, *We Are Legion (We Are Bob)*, *Children of Time*, *The Player of Games*, *A Fire Upon the Deep*, *Blindsight*, *The Long Way to a Small, Angry Planet*, *Recursion*, *Dark Matter*, *Old Man's War*, *The Left Hand of Darkness*, *Seveneves*, *To Sleep in a Sea of Stars*, *The First Fifteen Lives of Harry August*, *All Systems Red*, *Hyperion*, *The Three-Body Problem*, *Annihilation*, *Dune*. Skipped cards cost nothing.

**Glossary:** book profile · taste vector **T** · verdict · shrinkage · Discovery Range δ · MMR · wildcard · standing rule · shelf tones · MAE.

---

*The catalogue remembers so the reader can wander.*
