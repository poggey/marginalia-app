# Kickstart prompt for Claude Code

Paste the following as your first message, run from the folder containing
this kit:

---

Build **Marginalia**, a personal book-tracking and mathematical recommendation
app, from the specification in this folder.

**Read in this order before writing any code:**
1. `README.md` — ground rules
2. `docs/01-WHITE-PAPER.md` — the full spec (single source of truth)
3. `docs/02-DESIGN-TOKENS.md` — the Porcelain & Ink design system
4. `docs/03-ENGINEERING.md` — types, algorithm constants, Build 1 scope and
   acceptance criteria
5. Open `reference/approved-ui-mock.html` in a browser — this is the approved
   look for the For You surface; the built app must be recognisably this.

**Then build Build 1 exactly as scoped in ENGINEERING.md §5:** a Next.js
(App Router) + TypeScript + Tailwind app, local-first via Dexie/IndexedDB,
comprising: the four-step first run (onboarding, using
`seed/calibration-deck.json`), Library, logging via Open Library with Google
Books fallback and cache-at-write, the Review flow, Queue, the full
recommender with Discovery Range / shortlist / hero pick with generated
reasoning, standing rules, JSON export/import, and keyboard shortcuts.

**Hard constraints:**
- Every account starts from zero knowledge. No seeded user history anywhere.
- Implement the recommendation mathematics exactly per the constants table in
  ENGINEERING.md §2 — do not substitute values or simplify the pipeline. Put
  the recommender in `lib/recommender/` as pure, unit-tested functions with a
  committed fixture test that asserts a deterministic expected ranking.
- Style exclusively with the design tokens. No skeuomorphism. Accent budget
  and two-elevation rules apply. Respect `prefers-reduced-motion`.
- Every recommendation must render its predicted rating ± band, its three
  driving neighbours with similarities, and reasoning sentences generated
  from real intermediate values.
- Do not build Build 2/3 features (Atlas, Not-for-you, Ask, PWA, imports) or
  placeholder screens for them — leave clean seams only.

**Working method:** start by proposing the file structure and a short build
plan for my approval; then implement in vertical slices (onboarding →
recommender core with tests → For You → Library/Review → Queue/export),
running the dev server and checking each slice against the acceptance
criteria in ENGINEERING.md §5 before moving on. Finish by walking through all
nine acceptance criteria and reporting pass/fail on each.
